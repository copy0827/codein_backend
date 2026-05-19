import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Optional


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))



from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import ( # Changed from app.api.deps to app.core.deps based on original code
    get_db,
    get_current_user,
    get_current_user_optional, # Added this import
    require_roles,
)
from app.models.codetest import (
    LanguageRuntime,
    Test,
    Problem,
    Submission,
    TestCase,
    ProblemBank,
    ProblemBankTestCase,
)
from app.models.user import User
from app.models.activity import ActivityLog, ACTIVITY_POINTS
from app.models.board import Board, Post
from app.schemas.codetest import (
    LanguageRuntimePublic,
    LanguageRuntimeCreate,
    LanguageRuntimeUpdate,
    TestCreate,
    TestUpdate,
    TestOut,
    TestDetail,
    ProblemCreate,
    ProblemUpdate,
    ProblemOut,
    ProblemDetail,
    SubmissionCreate,
    SubmissionOut,
    TestCaseCreate,
    TestCaseOut,
    TestCasePublic,
    ProblemBankOut,
    ProblemBankDetail,
    ProblemBankCreate,
    ProblemBankUpdate,
    ProblemBankTestCaseCreate,
    ProblemBankTestCaseUpdate,
    ProblemBankTestCaseOut,
    ProblemBankTestCasePublic,
    PracticeSubmissionCreate,
    PracticeSubmissionResult,
    ProblemFromBankCreate,
    ProblemFromBankResponse,
    TestParticipantStats,
)
from app.services.grader import Grader

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/languages", response_model=List[LanguageRuntimePublic])
async def list_languages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LanguageRuntime)
        .where(LanguageRuntime.enabled.is_(True))
        .order_by(LanguageRuntime.language_key)
    )
    return result.scalars().all()


@router.post(
    "/languages",
    response_model=LanguageRuntimePublic,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def create_language(
    data: LanguageRuntimeCreate, db: AsyncSession = Depends(get_db)
):
    runtime = LanguageRuntime(**data.model_dump())
    db.add(runtime)
    await db.commit()
    await db.refresh(runtime)
    return runtime


@router.put(
    "/languages/{language_key}",
    response_model=LanguageRuntimePublic,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def update_language(
    language_key: str,
    data: LanguageRuntimeUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LanguageRuntime).where(LanguageRuntime.language_key == language_key)
    )
    runtime = result.scalar_one_or_none()
    if not runtime:
        raise HTTPException(status_code=404, detail="Language runtime not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(runtime, key, value)

    await db.commit()
    await db.refresh(runtime)
    return runtime


@router.get("/tests", response_model=List[TestOut])
async def list_tests(
    language: str | None = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Test, func.count(Problem.id).label("problem_count"))
        .outerjoin(Problem, Test.id == Problem.test_id)
        .group_by(Test.id)
        .order_by(Test.start_time.desc())
    )

    if language and language != "all":
        query = query.having(
            func.sum(
                case(
                    (Problem.language == language, 1),
                    else_=0,
                )
            ) > 0
        )

    result = await db.execute(query)
    rows = result.all()

    test_ids = [test.id for test, _ in rows]
    language_map: dict[int, list[str]] = {tid: [] for tid in test_ids}
    if test_ids:
        lang_rows = await db.execute(
            select(Problem.test_id, Problem.language)
            .where(Problem.test_id.in_(test_ids))
            .group_by(Problem.test_id, Problem.language)
        )
        for test_id, lang in lang_rows.all():
            if lang:
                language_map.setdefault(test_id, []).append(lang)

    return [
        TestOut(
            id=test.id,
            title=test.title,
            start_time=test.start_time,
            end_time=test.end_time,
            problem_count=problem_count,
            languages=sorted(language_map.get(test.id, [])),
        )
        for test, problem_count in rows
    ]


@router.get("/tests/{test_id}", response_model=TestDetail)
async def get_test(
    test_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = select(Test).options(selectinload(Test.problems)).where(Test.id == test_id)
    result = await db.execute(query)
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    problem_ids = [p.id for p in test.problems]
    sample_cases_dict = {pid: [] for pid in problem_ids}
    if problem_ids:
        tc_query = select(TestCase).where(TestCase.problem_id.in_(problem_ids), TestCase.is_sample == True)
        tc_result = await db.execute(tc_query)
        for tc in tc_result.scalars().all():
            sample_cases_dict[tc.problem_id].append(tc)

    solved_problem_ids = set()
    attempted_problem_ids = set()
    if current_user and problem_ids:
        # Get correct submissions for 'is_solved'
        sub_query = select(Submission.problem_id).where(
            Submission.user_id == current_user.id,
            Submission.problem_id.in_(problem_ids),
            Submission.result == "correct"
        )
        sub_result = await db.execute(sub_query)
        solved_problem_ids = set(sub_result.scalars().all())

        # Get all attempts for 'all_problems_attempted'
        attempt_query = select(Submission.problem_id).where(
            Submission.user_id == current_user.id,
            Submission.problem_id.in_(problem_ids)
        )
        attempt_result = await db.execute(attempt_query)
        attempted_problem_ids = set(attempt_result.scalars().all())

    all_problems_attempted = False
    if problem_ids and len(attempted_problem_ids) == len(problem_ids):
        all_problems_attempted = True

    # Get problem statistics
    stats_dict = {pid: {"participants": 0, "successful": 0} for pid in problem_ids}
    if problem_ids:
        # Participant count (unique users per problem)
        part_query = select(
            Submission.problem_id, 
            func.count(Submission.user_id.distinct()).label("count")
        ).where(Submission.problem_id.in_(problem_ids)).group_by(Submission.problem_id)
        part_result = await db.execute(part_query)
        for row in part_result.all():
            stats_dict[row[0]]["participants"] = row[1]

        # Successful user count (unique users who solved correctly per problem)
        succ_query = select(
            Submission.problem_id, 
            func.count(Submission.user_id.distinct()).label("count")
        ).where(
            Submission.problem_id.in_(problem_ids),
            Submission.result == "correct"
        ).group_by(Submission.problem_id)
        succ_result = await db.execute(succ_query)
        for row in succ_result.all():
            stats_dict[row[0]]["successful"] = row[1]

    problems_out = []
    for problem in test.problems:
        sample_cases = sample_cases_dict.get(problem.id, [])
        is_solved = problem.id in solved_problem_ids
        
        stats = stats_dict.get(problem.id, {"participants": 0, "successful": 0})
        p_count = stats["participants"]
        s_count = stats["successful"]
        s_rate = (s_count / p_count * 100) if p_count > 0 else 0.0

        problems_out.append(
            ProblemOut(
                id=problem.id,
                test_id=problem.test_id,
                title=problem.title,
                description=problem.description,
                language=problem.language,
                time_limit=problem.time_limit,
                memory_limit=problem.memory_limit,
                difficulty=problem.difficulty,
                points=problem.points,
                is_solved=is_solved,
                participant_count=p_count,
                success_rate=round(s_rate, 1),
                sample_test_cases=[
                    TestCasePublic(
                        id=tc.id,
                        input_data=tc.input_data,
                        expected_output=tc.expected_output,
                        is_sample=tc.is_sample,
                        order=tc.order,
                    )
                    for tc in sorted(sample_cases, key=lambda x: x.order if x.order is not None else 0)
                ],
            )
        )

    return TestDetail(
        id=test.id,
        title=test.title,
        start_time=test.start_time,
        end_time=test.end_time,
        problems=problems_out,
        all_problems_attempted=all_problems_attempted
    )


@router.get(
    "/tests/{test_id}/participants",
    response_model=List[TestParticipantStats],
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def get_test_participants(test_id: int, db: AsyncSession = Depends(get_db)):
    # Verify test exists
    test_result = await db.execute(select(Test).where(Test.id == test_id))
    if not test_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Test not found")

    # Query participant stats
    # Group by user and count distinct problems attempted and solved
    query = (
        select(
            User.id,
            User.name,
            User.student_id,
            func.count(Submission.problem_id.distinct()).label("total_submissions"),
            func.count(distinct(case((Submission.result == "correct", Submission.problem_id), else_=None))).label("correct_count"),
        )
        .select_from(Submission)
        .join(Problem, Submission.problem_id == Problem.id)
        .join(User, Submission.user_id == User.id)
        .where(Problem.test_id == test_id)
        .group_by(User.id, User.name, User.student_id)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        TestParticipantStats(
            user_id=row[0],
            user_name=row[1],
            student_id=row[2],
            total_submissions=row[3],  # This is actually problems attempted
            correct_count=row[4],
            wrong_count=row[3] - row[4],
        )
        for row in rows
    ]


@router.get("/practice/problems", response_model=List[ProblemBankOut])
async def list_practice_problems(
    level: int = Query(1, ge=1, le=5),
    count: int = Query(3, ge=1, le=10),
    language: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ProblemBank)
        .where(ProblemBank.level == level)
        .where(ProblemBank.is_public == True)
        .order_by(func.random())
        .limit(count)
    )
    if language and language != "all":
        query = query.where(ProblemBank.language == language)

    result = await db.execute(query)
    problems = result.scalars().all()
    if not problems:
        raise HTTPException(status_code=404, detail="No problems available")

    problem_ids = [p.id for p in problems]
    sample_cases_dict = {pid: [] for pid in problem_ids}
    if problem_ids:
        tc_query = select(ProblemBankTestCase).where(
            ProblemBankTestCase.problem_id.in_(problem_ids),
            ProblemBankTestCase.is_sample == True
        )
        tc_result = await db.execute(tc_query)
        for tc in tc_result.scalars().all():
            sample_cases_dict[tc.problem_id].append(tc)

    problems_out = []
    for problem in problems:
        sample_cases = sample_cases_dict.get(problem.id, [])
        problems_out.append(
            ProblemBankOut(
                id=problem.id,
                title=problem.title,
                description=problem.description,
                level=problem.level,
                language=problem.language,
                time_limit=problem.time_limit,
                memory_limit=problem.memory_limit,
                difficulty=problem.difficulty,
                points=problem.points,
                is_public=problem.is_public,
                sample_test_cases=[
                    ProblemBankTestCasePublic(
                        id=tc.id,
                        input_data=tc.input_data,
                        expected_output=tc.expected_output,
                        is_sample=tc.is_sample,
                        order=tc.order,
                    )
                    for tc in sorted(sample_cases, key=lambda x: x.order)
                ],
            )
        )

    return problems_out


@router.get(
    "/problem-bank",
    response_model=List[ProblemBankOut],
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def list_problem_bank(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    level: int | None = Query(None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ProblemBank)
        .offset(skip)
        .limit(limit)
        .order_by(ProblemBank.id.desc())
    )
    if level is not None:
        query = query.where(ProblemBank.level == level)

    result = await db.execute(query)
    problems = result.scalars().all()

    problem_ids = [p.id for p in problems]
    sample_cases_dict = {pid: [] for pid in problem_ids}
    if problem_ids:
        tc_query = select(ProblemBankTestCase).where(
            ProblemBankTestCase.problem_id.in_(problem_ids),
            ProblemBankTestCase.is_sample == True
        )
        tc_result = await db.execute(tc_query)
        for tc in tc_result.scalars().all():
            sample_cases_dict[tc.problem_id].append(tc)

    problems_out = []
    for problem in problems:
        sample_cases = sample_cases_dict.get(problem.id, [])
        problems_out.append(
            ProblemBankOut(
                id=problem.id,
                title=problem.title,
                description=problem.description,
                level=problem.level,
                language=problem.language,
                time_limit=problem.time_limit,
                memory_limit=problem.memory_limit,
                difficulty=problem.difficulty,
                points=problem.points,
                is_public=problem.is_public,
                sample_test_cases=[
                    ProblemBankTestCasePublic(
                        id=tc.id,
                        input_data=tc.input_data,
                        expected_output=tc.expected_output,
                        is_sample=tc.is_sample,
                        order=tc.order,
                    )
                    for tc in sorted(sample_cases, key=lambda x: x.order)
                ],
            )
        )

    return problems_out


@router.get(
    "/problem-bank/{problem_id}",
    response_model=ProblemBankDetail,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def get_problem_bank_detail(problem_id: int, db: AsyncSession = Depends(get_db)):
    query = (
        select(ProblemBank)
        .options(selectinload(ProblemBank.test_cases))
        .where(ProblemBank.id == problem_id)
    )
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="ProblemBank not found")

    sample_cases = [tc for tc in problem.test_cases if tc.is_sample]

    return ProblemBankDetail(
        id=problem.id,
        title=problem.title,
        description=problem.description,
        level=problem.level,
        language=problem.language,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        difficulty=problem.difficulty,
        points=problem.points,
        is_public=problem.is_public,
        sample_test_cases=[
            ProblemBankTestCasePublic(
                id=tc.id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_sample=tc.is_sample,
                order=tc.order,
            )
            for tc in sorted(sample_cases, key=lambda x: x.order)
        ],
        test_cases=[
            ProblemBankTestCaseOut(
                id=tc.id,
                problem_id=tc.problem_id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_sample=tc.is_sample,
                order=tc.order,
            )
            for tc in sorted(problem.test_cases, key=lambda x: x.order)
        ],
    )


@router.post(
    "/problem-bank",
    response_model=ProblemBankDetail,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def create_problem_bank(
    data: ProblemBankCreate, db: AsyncSession = Depends(get_db)
):
    if data.language == "all":
        raise HTTPException(status_code=400, detail="'all' language is not allowed")
    problem = ProblemBank(**data.model_dump())
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return ProblemBankDetail(
        id=problem.id,
        title=problem.title,
        description=problem.description,
        level=problem.level,
        language=problem.language,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        difficulty=problem.difficulty,
        points=problem.points,
        is_public=problem.is_public,
        sample_test_cases=[],
        test_cases=[],
    )


@router.put(
    "/problem-bank/{problem_id}",
    response_model=ProblemBankDetail,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def update_problem_bank(
    problem_id: int,
    data: ProblemBankUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProblemBank)
        .options(selectinload(ProblemBank.test_cases))
        .where(ProblemBank.id == problem_id)
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="ProblemBank not found")

    payload = data.model_dump(exclude_unset=True)
    if payload.get("language") == "all":
        raise HTTPException(status_code=400, detail="'all' language is not allowed")

    for key, value in payload.items():
        setattr(problem, key, value)

    await db.commit()
    await db.refresh(problem)

    sample_cases = [tc for tc in problem.test_cases if tc.is_sample]

    return ProblemBankDetail(
        id=problem.id,
        title=problem.title,
        description=problem.description,
        level=problem.level,
        language=problem.language,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        difficulty=problem.difficulty,
        points=problem.points,
        is_public=problem.is_public,
        sample_test_cases=[
            ProblemBankTestCasePublic(
                id=tc.id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_sample=tc.is_sample,
                order=tc.order,
            )
            for tc in sorted(sample_cases, key=lambda x: x.order)
        ],
        test_cases=[
            ProblemBankTestCaseOut(
                id=tc.id,
                problem_id=tc.problem_id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_sample=tc.is_sample,
                order=tc.order,
            )
            for tc in sorted(problem.test_cases, key=lambda x: x.order)
        ],
    )


@router.delete(
    "/problem-bank/{problem_id}",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def delete_problem_bank(problem_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProblemBank).where(ProblemBank.id == problem_id))
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="ProblemBank not found")

    await db.delete(problem)
    await db.commit()
    return {"status": "problem_bank deleted"}


@router.post(
    "/problem-bank/{problem_id}/testcases",
    response_model=ProblemBankTestCaseOut,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def add_problem_bank_testcase(
    problem_id: int,
    data: ProblemBankTestCaseCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProblemBank).where(ProblemBank.id == problem_id))
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="ProblemBank not found")

    testcase = ProblemBankTestCase(problem_id=problem_id, **data.model_dump())
    db.add(testcase)
    await db.commit()
    await db.refresh(testcase)
    return testcase


@router.put(
    "/problem-bank/testcases/{testcase_id}",
    response_model=ProblemBankTestCaseOut,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def update_problem_bank_testcase(
    testcase_id: int,
    data: ProblemBankTestCaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProblemBankTestCase).where(ProblemBankTestCase.id == testcase_id)
    )
    testcase = result.scalar_one_or_none()
    if not testcase:
        raise HTTPException(status_code=404, detail="ProblemBank testcase not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(testcase, key, value)

    await db.commit()
    await db.refresh(testcase)
    return testcase


@router.delete(
    "/problem-bank/testcases/{testcase_id}",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def delete_problem_bank_testcase(
    testcase_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ProblemBankTestCase).where(ProblemBankTestCase.id == testcase_id)
    )
    testcase = result.scalar_one_or_none()
    if not testcase:
        raise HTTPException(status_code=404, detail="ProblemBank testcase not found")

    await db.delete(testcase)
    await db.commit()
    return {"status": "problem_bank testcase deleted"}


@router.post("/tests", dependencies=[Depends(require_roles("admin", "superadmin"))])
async def create_test(data: TestCreate, db: AsyncSession = Depends(get_db)):
    data_dict = data.dict()
    if data_dict.get("start_time") and data_dict["start_time"].tzinfo:
        data_dict["start_time"] = data_dict["start_time"].replace(tzinfo=None)
    if data_dict.get("end_time") and data_dict["end_time"].tzinfo:
        data_dict["end_time"] = data_dict["end_time"].replace(tzinfo=None)
        
    test = Test(**data_dict)
    db.add(test)
    await db.commit()
    return {"status": "created"}


@router.put("/tests/{test_id}", dependencies=[Depends(require_roles("admin", "superadmin"))])
async def update_test(test_id: int, data: TestUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    data_dict = data.model_dump(exclude_unset=True)
    if data_dict.get("start_time") and data_dict["start_time"].tzinfo:
        data_dict["start_time"] = data_dict["start_time"].replace(tzinfo=None)
    if data_dict.get("end_time") and data_dict["end_time"].tzinfo:
        data_dict["end_time"] = data_dict["end_time"].replace(tzinfo=None)

    for key, value in data_dict.items():
        setattr(test, key, value)

    await db.commit()
    return {"status": "updated"}


@router.delete("/tests/{test_id}", dependencies=[Depends(require_roles("admin", "superadmin"))])
async def delete_test(test_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    await db.delete(test)
    await db.commit()
    return {"status": "test deleted"}


@router.post(
    "/tests/{test_id}/problems",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def add_problem(
    test_id: int, data: ProblemCreate, db: AsyncSession = Depends(get_db)
):
    if data.language == "all":
        raise HTTPException(status_code=400, detail="'all' language is not allowed")
    prob = Problem(test_id=test_id, **data.dict())
    db.add(prob)
    await db.commit()
    return {"status": "problem added"}


@router.post(
    "/tests/{test_id}/problems/from-bank",
    response_model=ProblemFromBankResponse,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def compose_problem_from_bank(
    test_id: int, data: ProblemFromBankCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    query = (
        select(ProblemBank)
        .options(selectinload(ProblemBank.test_cases))
        .where(ProblemBank.id == data.problem_bank_id)
    )
    result = await db.execute(query)
    problem_bank = result.scalar_one_or_none()
    if not problem_bank:
        raise HTTPException(status_code=404, detail="ProblemBank not found")

    target_language = data.language if data.language is not None else problem_bank.language
    if target_language == "all":
        raise HTTPException(status_code=400, detail="'all' language is not allowed")

    new_problem = Problem(
        test_id=test_id,
        title=data.title if data.title is not None else problem_bank.title,
        description=data.description
        if data.description is not None
        else problem_bank.description,
        language=target_language,
        time_limit=data.time_limit
        if data.time_limit is not None
        else problem_bank.time_limit,
        memory_limit=data.memory_limit
        if data.memory_limit is not None
        else problem_bank.memory_limit,
        difficulty=data.difficulty
        if data.difficulty is not None
        else problem_bank.difficulty,
        points=data.points if data.points is not None else problem_bank.points,
        source_problem_bank_id=problem_bank.id,
    )
    db.add(new_problem)
    await db.flush()

    test_cases_copied = 0
    for bank_test_case in problem_bank.test_cases:
        new_test_case = TestCase(
            problem_id=new_problem.id,
            input_data=bank_test_case.input_data,
            expected_output=bank_test_case.expected_output,
            is_sample=bank_test_case.is_sample,
            order=bank_test_case.order,
            source_problem_bank_test_case_id=bank_test_case.id,
        )
        db.add(new_test_case)
        test_cases_copied += 1

    await db.commit()

    return ProblemFromBankResponse(
        problem_id=new_problem.id,
        test_cases_copied=test_cases_copied,
        source_problem_bank_id=problem_bank.id,
    )


@router.get(
    "/problems/{problem_id}",
    response_model=ProblemDetail,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def get_problem_detail(problem_id: int, db: AsyncSession = Depends(get_db)):
    query = (
        select(Problem)
        .options(selectinload(Problem.test_cases))
        .where(Problem.id == problem_id)
    )
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    return ProblemDetail(
        id=problem.id,
        test_id=problem.test_id,
        title=problem.title,
        description=problem.description,
        language=problem.language,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        difficulty=problem.difficulty,
        points=problem.points,
        test_cases=[
            TestCaseOut(
                id=tc.id,
                problem_id=tc.problem_id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_sample=tc.is_sample,
                order=tc.order,
            )
            for tc in sorted(problem.test_cases, key=lambda x: x.order if x.order is not None else 0)
        ],
    )


@router.put(
    "/problems/{problem_id}",
    response_model=ProblemDetail,
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def update_problem(
    problem_id: int, data: ProblemUpdate, db: AsyncSession = Depends(get_db)
):
    query = (
        select(Problem)
        .options(selectinload(Problem.test_cases))
        .where(Problem.id == problem_id)
    )
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    payload = data.model_dump(exclude_unset=True)
    if payload.get("language") == "all":
        raise HTTPException(status_code=400, detail="'all' language is not allowed")

    for key, value in payload.items():
        setattr(problem, key, value)

    await db.commit()
    await db.refresh(problem)

    return ProblemDetail(
        id=problem.id,
        test_id=problem.test_id,
        title=problem.title,
        description=problem.description,
        language=problem.language,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        difficulty=problem.difficulty,
        points=problem.points,
        test_cases=[
            TestCaseOut(
                id=tc.id,
                problem_id=tc.problem_id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_sample=tc.is_sample,
                order=tc.order,
            )
            for tc in sorted(problem.test_cases, key=lambda x: x.order if x.order is not None else 0)
        ],
    )


@router.delete(
    "/problems/{problem_id}",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def delete_problem(problem_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Problem).where(Problem.id == problem_id)
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    await db.delete(problem)
    await db.commit()
    return {"status": "problem deleted"}


@router.post(
    "/problems/{problem_id}/testcases",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def add_testcase(
    problem_id: int, data: TestCaseCreate, db: AsyncSession = Depends(get_db)
):
    query = select(Problem).where(Problem.id == problem_id)
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    testcase = TestCase(problem_id=problem_id, **data.dict())
    db.add(testcase)
    await db.commit()
    await db.refresh(testcase)
    return {"status": "testcase added", "id": testcase.id}


@router.put(
    "/testcases/{testcase_id}",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def update_testcase(
    testcase_id: int, data: TestCaseCreate, db: AsyncSession = Depends(get_db)
):
    query = select(TestCase).where(TestCase.id == testcase_id)
    result = await db.execute(query)
    testcase = result.scalar_one_or_none()
    if not testcase:
        raise HTTPException(status_code=404, detail="TestCase not found")

    for key, value in data.dict().items():
        setattr(testcase, key, value)

    await db.commit()
    return {"status": "testcase updated"}


@router.delete(
    "/testcases/{testcase_id}",
    dependencies=[Depends(require_roles("admin", "superadmin"))],
)
async def delete_testcase(testcase_id: int, db: AsyncSession = Depends(get_db)):
    query = select(TestCase).where(TestCase.id == testcase_id)
    result = await db.execute(query)
    testcase = result.scalar_one_or_none()
    if not testcase:
        raise HTTPException(status_code=404, detail="TestCase not found")

    await db.delete(testcase)
    await db.commit()
    return {"status": "testcase deleted"}


@router.get("/submissions", response_model=List[SubmissionOut])
async def list_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    query = (
        select(Submission)
        .where(Submission.user_id == user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Submission.submitted_at.desc())
    )
    result = await db.execute(query)
    submissions = result.scalars().all()
    return [
        SubmissionOut(
            id=sub.id,
            problem_id=sub.problem_id,
            user_id=sub.user_id,
            code=sub.code,
            language=sub.language,
            result=sub.result,
            execution_time=sub.execution_time,
            memory_used=sub.memory_used,
            test_cases_passed=sub.test_cases_passed,
            test_cases_total=sub.test_cases_total,
            error_message=sub.error_message,
            submitted_at=sub.submitted_at,
        )
        for sub in submissions
    ]


@router.get("/problems/{problem_id}/submissions", response_model=List[SubmissionOut])
async def list_problem_submissions(
    problem_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    query = (
        select(Submission)
        .where(Submission.problem_id == problem_id, Submission.user_id == user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Submission.submitted_at.desc())
    )
    result = await db.execute(query)
    submissions = result.scalars().all()
    return [
        SubmissionOut(
            id=sub.id,
            problem_id=sub.problem_id,
            user_id=sub.user_id,
            code=sub.code,
            language=sub.language,
            result=sub.result,
            execution_time=sub.execution_time,
            memory_used=sub.memory_used,
            test_cases_passed=sub.test_cases_passed,
            test_cases_total=sub.test_cases_total,
            error_message=sub.error_message,
            submitted_at=sub.submitted_at,
        )
        for sub in submissions
    ]


@router.post("/problems/{problem_id}/submit")
async def submit(
    problem_id: int,
    data: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    query = (
        select(Problem)
        .options(selectinload(Problem.test))
        .where(Problem.id == problem_id)
    )
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    test = problem.test
    now = _kst_now()
    if now < test.start_time:
        raise HTTPException(status_code=403, detail="Test has not started yet")
    if now > test.end_time:
        raise HTTPException(status_code=403, detail="Test has ended")

    if problem.language != "all" and data.language != problem.language:
        raise HTTPException(status_code=400, detail="Language not allowed")

    logger.debug(
        "Submission received user_id=%s problem_id=%s language=%s",
        user.id,
        problem_id,
        data.language,
    )

    try:
        grader = Grader()
        grade_result = await grader.grade_submission(
            db=db, problem_id=problem_id, code=data.code, language=data.language
        )

        sub = Submission(
            problem_id=problem_id,
            user_id=user.id,
            code=data.code,
            language=data.language,
            result=grade_result.result,
            execution_time=grade_result.execution_time,
            memory_used=grade_result.memory_used,
            test_cases_passed=grade_result.test_cases_passed,
            test_cases_total=grade_result.test_cases_total,
            error_message=grade_result.error_message,
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)

        # 코딩테스트 기본 제출 포인트(오답, 에러 등 포함) 부여 제외 (요청사항 반영)
        # 이제 정답일 때만 활동 포인트 기록(ActivityLog)과 유저 포인트 반영을 진행

        if grade_result.result == "correct":
            prev_correct_result = await db.execute(
                select(Submission).where(
                    Submission.problem_id == problem_id,
                    Submission.user_id == user.id,
                    Submission.result == "correct",
                    Submission.id != sub.id,
                )
            )
            prev_correct = prev_correct_result.scalars().first()
            if not prev_correct:
                pass_points = problem.points
                
                # Update points and activity points
                user.points = (user.points or 0) + pass_points
                user.activity_points = (user.activity_points or 0) + pass_points
                
                # Check for rank up based on activity_points
                from app.services.rank_service import get_rank_for_points
                old_rank = user.rank or "unranked"
                new_rank = get_rank_for_points(user.activity_points)
                if old_rank != new_rank:
                    user.rank = new_rank
                    rank_log = ActivityLog(
                        user_id=user.id,
                        activity_type="rank_up",
                        points=0,
                        description=f"{old_rank} → {new_rank} 등급 변경",
                        balance_after=user.points,
                    )
                    db.add(rank_log)

                pass_log = ActivityLog(
                    user_id=user.id,
                    activity_type="codetest_pass",
                    points=pass_points,
                    reference_type="submission",
                    reference_id=sub.id,
                    balance_after=user.points,
                )
                db.add(pass_log)

        await db.commit()

        logger.debug(
            "Submission graded user_id=%s problem_id=%s submission_id=%s result=%s",
            user.id,
            problem_id,
            sub.id,
            grade_result.result,
        )

        return {
            "id": sub.id,
            "result": grade_result.result,
            "test_cases_passed": grade_result.test_cases_passed,
            "test_cases_total": grade_result.test_cases_total,
            "execution_time": grade_result.execution_time,
            "memory_used": grade_result.memory_used,
            "error_message": grade_result.error_message,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")


@router.post("/practice/submit", response_model=PracticeSubmissionResult)
async def submit_practice(
    data: PracticeSubmissionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    logger.debug(
        "Practice submission received user_id=%s problem_id=%s language=%s",
        user.id,
        data.problem_id,
        data.language,
    )

    result = await db.execute(
        select(ProblemBank).where(ProblemBank.id == data.problem_id)
    )
    problem_bank = result.scalar_one_or_none()
    if not problem_bank:
        raise HTTPException(status_code=404, detail="ProblemBank not found")
    if problem_bank.language != "all" and data.language != problem_bank.language:
        raise HTTPException(status_code=400, detail="Language not allowed")

    try:
        grader = Grader()
        grade_result = await grader.grade_bank_submission(
            db=db,
            problem_id=data.problem_id,
            code=data.code,
            language=data.language,
        )
        logger.debug(
            "Practice submission graded user_id=%s problem_id=%s result=%s",
            user.id,
            data.problem_id,
            grade_result.result,
        )
        return PracticeSubmissionResult(
            result=grade_result.result,
            test_cases_passed=grade_result.test_cases_passed,
            test_cases_total=grade_result.test_cases_total,
            execution_time=grade_result.execution_time,
            memory_used=grade_result.memory_used,
            error_message=grade_result.error_message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")
@router.post("/tests/{test_id}/brag")
async def brag_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # 1. Verify test exists and get problems
    query = select(Test).options(selectinload(Test.problems)).where(Test.id == test_id)
    result = await db.execute(query)
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if not test.problems:
        raise HTTPException(status_code=400, detail="Test has no problems")

    problem_ids = [p.id for p in test.problems]

    # 2. Check if user attempted all problems
    attempt_query = select(Submission.problem_id).where(
        Submission.user_id == user.id,
        Submission.problem_id.in_(problem_ids)
    )
    attempt_result = await db.execute(attempt_query)
    attempted_ids = set(attempt_result.scalars().all())

    if len(attempted_ids) < len(problem_ids):
        raise HTTPException(status_code=400, detail="모든 문제를 한 번 이상 제출해야 자랑할 수 있습니다.")

    # 3. Calculate success rate and earned points
    solved_problems_query = (
        select(Problem)
        .join(Submission, Submission.problem_id == Problem.id)
        .where(
            Submission.user_id == user.id,
            Problem.test_id == test_id,
            Submission.result == "correct"
        )
        .distinct()
    )
    solved_problems_result = await db.execute(solved_problems_query)
    solved_problems = solved_problems_result.scalars().all()
    
    earned_points = sum(p.points for p in solved_problems)
    solved = len(solved_problems)
    
    total = len(problem_ids)
    rate = round((solved / total) * 100) if total > 0 else 0
    kst_now_str = _kst_now().strftime("%Y-%m-%d %H:%M")

    # 4. Create post in board_id = 2 (응시자랑)
    # Check if board exists (Optional but safer)
    board_result = await db.execute(select(Board).where(Board.id == 2))
    board = board_result.scalar_one_or_none()
    if not board:
        # Fallback to general board if 2 doesn't exist? 
        # Requirement says board_id = 2, so let's stick to it or error.
        raise HTTPException(status_code=500, detail="자랑하기 게시판(ID: 2)이 존재하지 않습니다.")

    title = f"🚀 [자랑] {test.title} 정복 완료!"
    content = f"""# 🏆 코딩테스트 정복 완료!

---

## 📊 응시 요약: **{test.title}**

> **"{user.name}"** 님이 모든 문제를 정복하셨습니다!

| 구분 | 상세 기록 |
| :--- | :--- |
| **🎖️ 최종 결과** | **ALL CLEAR** |
| **📈 정답률** | **{rate}%** |
| **✅ 해결 문제** | **{solved}** / {total} 문제 |
| **💰 획득 포인트** | **{earned_points}** pts |
| **⏰ 완료 일시** | {kst_now_str} |

---

### 🏁 도전은 계속됩니다!
테스트의 모든 과제를 확인하고 완수한 당신의 열정을 응원합니다.
다음 코딩 대회에서도 멋진 활약을 기대하겠습니다!

---
*본 게시글은 CodeIn 시스템에 의해 자동으로 생성된 인증글입니다.*
"""
    
    new_post = Post(
        board_id=2,
        author_id=user.id,
        title=title,
        content=content,
        created_at=_kst_now(),
        updated_at=_kst_now()
    )
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    return {"post_id": new_post.id}
