from datetime import datetime, timedelta

from sqlalchemy import select, func

from app.core.security import hash_password
from app.db.session import engine, async_session
from app.models.activity import ActivityLog
from app.models.base import Base
from app.models.board import Board, Post, PostReadLog
from app.models.codetest import (
    LanguageRuntime,
    Test,
    Problem,
    TestCase,
    Submission,
    ProblemBank,
    ProblemBankTestCase,
)
from app.models.comment import Comment
from app.models.event import Event, Attendance
from app.models.gallery import Album, Photo
from app.models.notification import Notification
from app.models.report import Report, ReportTargetType, ReportReason, ReportStatus
from app.models.user import User


async def init_db():
    print("Initializing database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Checking if seeding is required...")
    async with async_session() as db:
        try:
            existing_users = await db.execute(select(func.count(User.id)))
            count = existing_users.scalar() or 0
            print(f"Found {count} existing users.")
            if count > 0:
                print("Seeding already completed. Checking for admin account.")
                admin_count = (
                    await db.execute(
                        select(func.count(User.id)).where(
                            User.role.in_(["admin", "superadmin"])
                        )
                    )
                ).scalar() or 0
                if admin_count > 0:
                    print("Admin account exists. Skipping.")
                    return
                print("No admin account found. Creating default admin user.")
                admin_user = User(
                    email="admin@codein.test",
                    hashed_password=hash_password("password123"),
                    name="관리자",
                    student_id="2000001",
                    major="Computer Science",
                    generation="1",
                    role="admin",
                    rank="platinum",
                    activity_points=8000,
                    is_active=True,
                )
                db.add(admin_user)
                await db.commit()
                return

            print("Starting full seeding process...")
        except Exception as e:
            print(f"Error checking database: {e}")
            return

        now = datetime.utcnow()

        users = [
            User(
                email="superadmin@codein.test",
                hashed_password=hash_password("password123"),
                name="슈퍼관리자",
                student_id="1999001",
                major="Computer Science",
                generation="0",
                role="superadmin",
                rank="diamond",
                points=20000,
                activity_points=20000,
            ),
            User(
                email="admin@codein.test",
                hashed_password=hash_password("password123"),
                name="관리자",
                student_id="2000001",
                major="Computer Science",
                generation="1",
                role="admin",
                rank="platinum",
                points=8000,
                activity_points=8000,
            ),
            User(
                email="staff@codein.test",
                hashed_password=hash_password("password123"),
                name="운영진",
                student_id="2020001",
                major="Information Systems",
                generation="2",
                role="staff",
                rank="gold",
                points=2200,
                activity_points=2200,
            ),
            User(
                email="member1@codein.test",
                hashed_password=hash_password("password123"),
                name="회원1",
                student_id="2023001",
                major="Software Engineering",
                generation="4",
                role="member",
                rank="silver",
                points=650,
                activity_points=650,
            ),
            User(
                email="member2@codein.test",
                hashed_password=hash_password("password123"),
                name="회원2",
                student_id="2023002",
                major="Computer Engineering",
                generation="4",
                role="member",
                rank="bronze",
                points=120,
                activity_points=120,
            ),
        ]
        db.add_all(users)
        await db.flush()

        boards = [
            Board(name="자유게시판", board_type="general", is_public=True),
            Board(name="응시자랑", board_type="general", is_public=True),
            Board(name="Q&A", board_type="qna", is_public=True),
            Board(name="공지사항", board_type="notice", is_public=True),
        ]
        db.add_all(boards)
        await db.flush()

        runtimes = [
            LanguageRuntime(
                language_key="python",
                display_name="Python 3.11",
                docker_image="python:3.11-alpine",
                execution_mode="inline",
                command_template='["python3", "-c"]',
                compile_command=None,
                file_extension=".py",
            ),
            LanguageRuntime(
                language_key="javascript",
                display_name="Node.js 18",
                docker_image="node:18-alpine",
                execution_mode="inline",
                command_template='["node", "-e"]',
                compile_command=None,
                file_extension=".js",
            ),
            LanguageRuntime(
                language_key="java",
                display_name="Java 17",
                docker_image="eclipse-temurin:17-jdk",
                execution_mode="file",
                command_template='["java", "-cp", "/tmp", "{class_name}"]',
                compile_command='["javac", "{source}"]',
                file_extension=".java",
            ),
            LanguageRuntime(
                language_key="cpp",
                display_name="C++",
                docker_image="gcc:13",
                execution_mode="file",
                command_template='["{output}"]',
                compile_command='["g++", "-O2", "-pipe", "{source}", "-o", "{output}"]',
                file_extension=".cpp",
            ),
        ]
        db.add_all(runtimes)
        await db.flush()

        posts = [
            Post(
                title="환영합니다!",
                content="CodeIn 커뮤니티에 오신 걸 환영합니다.",
                board_id=boards[2].id,
                author_id=users[1].id,
                is_pinned=True,
                created_at=now - timedelta(days=3),
            ),
            Post(
                title="오늘의 스터디 모집",
                content="알고리즘 스터디 인원 모집합니다. 관심 있으면 댓글 달아주세요!",
                board_id=boards[0].id,
                author_id=users[3].id,
                created_at=now - timedelta(days=2),
            ),
            Post(
                title="FastAPI 질문 있습니다",
                content="의존성 주입에서 async 세션 관리가 궁금합니다.",
                board_id=boards[1].id,
                author_id=users[4].id,
                created_at=now - timedelta(days=1, hours=4),
            ),
            Post(
                title="프로젝트 후기 공유",
                content="이번 프로젝트에서 배운 점을 공유합니다.",
                board_id=boards[0].id,
                author_id=users[2].id,
                created_at=now - timedelta(hours=6),
            ),
        ]
        db.add_all(posts)
        await db.flush()

        comment_top = Comment(
            post_id=posts[1].id,
            author_id=users[4].id,
            content="저도 참여하고 싶어요!",
        )
        db.add(comment_top)
        await db.flush()

        comments = [
            Comment(
                post_id=posts[1].id,
                author_id=users[3].id,
                parent_id=comment_top.id,
                content="좋아요! DM 드릴게요.",
            ),
            Comment(
                post_id=posts[2].id,
                author_id=users[2].id,
                content="관련 예제 코드 공유드릴게요.",
            ),
        ]
        db.add_all(comments)
        await db.flush()

        event_start = now + timedelta(days=2)
        event_end = event_start + timedelta(hours=2)
        events = [
            Event(
                title="정기 스터디",
                description="매주 수요일 정기 스터디입니다.",
                start_time=event_start,
                end_time=event_end,
                owner_id=users[2].id,
            ),
            Event(
                title="프로젝트 발표회",
                description="학기말 프로젝트 발표회를 진행합니다.",
                start_time=now + timedelta(days=7),
                end_time=now + timedelta(days=7, hours=3),
                owner_id=users[1].id,
            ),
        ]
        db.add_all(events)
        await db.flush()

        attendance = [
            Attendance(
                event_id=events[0].id,
                user_id=users[3].id,
                status="attending",
                occurrence_date=events[0].start_time.date(),
            ),
            Attendance(
                event_id=events[0].id,
                user_id=users[4].id,
                status="attending",
                occurrence_date=events[0].start_time.date(),
            ),
        ]
        db.add_all(attendance)
        await db.flush()

        albums = [
            Album(name="동아리 MT", owner_id=users[3].id, visibility="public"),
            Album(name="세미나 스냅", owner_id=users[2].id, visibility="public"),
        ]
        db.add_all(albums)
        await db.flush()

        photos = [
            Photo(
                album_id=albums[0].id,
                url="https://picsum.photos/seed/codein1/1200/800",
                thumbnail_url="https://picsum.photos/seed/codein1/300/200",
            ),
            Photo(
                album_id=albums[0].id,
                url="https://picsum.photos/seed/codein2/1200/800",
                thumbnail_url="https://picsum.photos/seed/codein2/300/200",
            ),
            Photo(
                album_id=albums[1].id,
                url="https://picsum.photos/seed/codein3/1200/800",
                thumbnail_url="https://picsum.photos/seed/codein3/300/200",
            ),
        ]
        db.add_all(photos)
        await db.flush()

        notifications = [
            Notification(
                user_id=users[3].id,
                notification_type="post",
                title="새 공지",
                message="공지사항이 업데이트되었습니다.",
                link="/notices.html",
                related_type="post",
                related_id=posts[0].id,
            ),
            Notification(
                user_id=users[4].id,
                notification_type="event",
                title="이벤트 신청 완료",
                message="정기 스터디 참석 신청이 완료되었습니다.",
                link="/calendar.html",
                related_type="event",
                related_id=events[0].id,
            ),
        ]
        db.add_all(notifications)
        await db.flush()

        reports = [
            Report(
                reporter_id=users[4].id,
                target_type=ReportTargetType.POST,
                target_id=posts[3].id,
                reason=ReportReason.OTHER,
                description="내용이 조금 더 구체적이면 좋겠습니다.",
                status=ReportStatus.PENDING,
            ),
            Report(
                reporter_id=users[3].id,
                target_type=ReportTargetType.COMMENT,
                target_id=comment_top.id,
                reason=ReportReason.SPAM,
                description="광고처럼 보여서 신고합니다.",
                status=ReportStatus.REVIEWING,
                resolved_by_id=users[2].id,
            ),
        ]
        db.add_all(reports)
        await db.flush()

        activity_logs = [
            ActivityLog(
                user_id=users[3].id,
                activity_type="post_create",
                points=10,
                description="게시글 작성",
                reference_type="post",
                reference_id=posts[1].id,
                balance_after=10,
            ),
            ActivityLog(
                user_id=users[3].id,
                activity_type="comment_create",
                points=3,
                description="댓글 작성",
                reference_type="comment",
                reference_id=comment_top.id,
                balance_after=13,
            ),
        ]
        db.add_all(activity_logs)
        await db.flush()

        test = Test(
            title="기초 알고리즘 테스트",
            start_time=now - timedelta(days=1),
            end_time=now + timedelta(days=3),
        )
        db.add(test)
        await db.flush()

        problems = [
            Problem(
                test_id=test.id,
                title="두 수의 합",
                description="입력된 두 수의 합을 출력하세요.",
            ),
            Problem(
                test_id=test.id,
                title="문자열 뒤집기",
                description="문자열을 뒤집어서 출력하세요.",
            ),
        ]
        db.add_all(problems)
        await db.flush()

        test_cases = [
            TestCase(
                problem_id=problems[0].id,
                input_data="1 2",
                expected_output="3",
                is_sample=True,
                order=1,
            ),
            TestCase(
                problem_id=problems[0].id,
                input_data="5 10",
                expected_output="15",
                is_sample=True,
                order=2,
            ),
            TestCase(
                problem_id=problems[0].id,
                input_data="100 200",
                expected_output="300",
                is_sample=False,
                order=3,
            ),
            TestCase(
                problem_id=problems[1].id,
                input_data="hello",
                expected_output="olleh",
                is_sample=True,
                order=1,
            ),
            TestCase(
                problem_id=problems[1].id,
                input_data="abc",
                expected_output="cba",
                is_sample=True,
                order=2,
            ),
        ]
        db.add_all(test_cases)
        await db.flush()

        # submissions = [
        #     Submission(
        #         problem_id=problems[0].id,
        #         user_id=users[3].id,
        #         code="print(a+b)",
        #         result="correct",
        #         language="python",
        #     ),
        #     Submission(
        #         problem_id=problems[1].id,
        #         user_id=users[4].id,
        #         code="print(s[::-1])",
        #         result="correct",
        #         language="python",
        #     ),
        # ]
        # db.add_all(submissions)

        sample_test = Test(
            title="CodeIn 샘플 코딩테스트",
            start_time=now,
            end_time=now + timedelta(days=30),
        )
        db.add(sample_test)
        await db.flush()

        sample_problems_data = [
            {
                "title": "두 수의 합과 차",
                "description": "두 정수 A와 B가 주어진다.\nA와 B의 합과 차(A − B)를 공백으로 구분하여 출력하시오.",
                "difficulty": "easy",
                "points": 10,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("7 3", "10 4", True, 1),
                    ("10 5", "15 5", False, 2),
                    ("100 50", "150 50", False, 3),
                ],
            },
            {
                "title": "짝수와 홀수 판별",
                "description": "정수 N이 주어진다.\nN이 짝수이면 EVEN, 홀수이면 ODD를 출력하시오.",
                "difficulty": "easy",
                "points": 10,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("8", "EVEN", True, 1),
                    ("7", "ODD", False, 2),
                    ("0", "EVEN", False, 3),
                ],
            },
            {
                "title": "세 수 중 최댓값",
                "description": "서로 다른 세 개의 정수가 주어진다.\n이 중 가장 큰 값을 출력하시오.",
                "difficulty": "easy",
                "points": 10,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("2 9 7", "9", True, 1),
                    ("1 2 3", "3", False, 2),
                    ("100 50 75", "100", False, 3),
                ],
            },
            {
                "title": "문자열 길이 구하기",
                "description": "공백이 없는 문자열 하나가 주어진다.\n해당 문자열의 길이를 출력하시오.",
                "difficulty": "easy",
                "points": 10,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("Hello", "5", True, 1),
                    ("CodeIn", "6", False, 2),
                    ("a", "1", False, 3),
                ],
            },
            {
                "title": "피보나치 수열",
                "description": "양의 정수 N이 주어진다. 피보나치 수열의 처음 N개 숫자를 공백으로 구분하여 출력하시오.\n첫 번째 숫자는 0, 두 번째 숫자는 1, 그 이후 숫자는 앞의 두 숫자의 합이다.",
                "difficulty": "easy",
                "points": 15,
                "time_limit": 2,
                "memory_limit": 128,
                "test_cases": [
                    ("5", "0 1 1 2 3", True, 1),
                    ("7", "0 1 1 2 3 5 8", False, 2),
                    ("10", "0 1 1 2 3 5 8 13 21 34", False, 3),
                ],
            },
            {
                "title": "자릿수 합",
                "description": "0 이상의 정수 N이 주어진다. N을 이루는 각 자리 숫자의 합을 출력하시오.",
                "difficulty": "medium",
                "points": 20,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("12340", "10", True, 1),
                    ("999", "27", False, 2),
                    ("0", "0", False, 3),
                ],
            },
            {
                "title": "숫자 뒤집기와 합산",
                "description": "두 개의 정수가 주어진다.\n각 숫자를 뒤집는다. 뒤집은 두 숫자를 더한다. 더한 결과를 다시 뒤집어서 출력한다.",
                "difficulty": "medium",
                "points": 20,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("123 456", "579", True, 1),
                    ("100 200", "3", False, 2),
                    ("789 111", "1098", False, 3),
                ],
            },
            {
                "title": "특정 문자 개수 세기",
                "description": "문자열 S와 문자 하나가 주어진다.\n문자열 S 안에 해당 문자가 몇 번 등장하는지 출력하시오.",
                "difficulty": "medium",
                "points": 20,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("banana\na", "3", True, 1),
                    ("hello\nl", "2", False, 2),
                    ("aaaaa\na", "5", False, 3),
                ],
            },
            {
                "title": "배열 오른쪽 이동",
                "description": "정수 N과 N개의 숫자가 주어진다.\n배열을 오른쪽으로 한 칸 이동한 결과를 출력하시오.",
                "difficulty": "medium",
                "points": 20,
                "time_limit": 1,
                "memory_limit": 128,
                "test_cases": [
                    ("4\n1 2 3 4", "4 1 2 3", True, 1),
                    ("5\n5 4 3 2 1", "1 5 4 3 2", False, 2),
                    ("1\n10", "10", False, 3),
                ],
            },
            {
                "title": "행렬 덧셈",
                "description": "N×M 크기의 두 행렬 A와 B가 주어진다.\n같은 위치에 있는 숫자끼리 더한 결과 행렬을 출력하시오.",
                "difficulty": "medium",
                "points": 25,
                "time_limit": 2,
                "memory_limit": 256,
                "test_cases": [
                    (
                        "3 3\n1 1 1\n2 2 2\n0 1 0\n3 3 3\n4 4 4\n5 5 100",
                        "4 4 4\n6 6 6\n5 6 100",
                        True,
                        1,
                    ),
                    ("2 2\n1 2\n3 4\n5 6\n7 8", "6 8\n10 12", False, 2),
                ],
            },
            {
                "title": "가장 많이 나온 문자",
                "description": "알파벳 소문자로 이루어진 문자열이 주어진다. 가장 많이 등장한 문자를 출력하시오.\n여러 개일 경우 알파벳 순으로 가장 앞선 문자를 출력한다.",
                "difficulty": "hard",
                "points": 30,
                "time_limit": 2,
                "memory_limit": 128,
                "test_cases": [
                    ("abbcccdd", "c", True, 1),
                    ("aabbcc", "a", False, 2),
                    ("zzaabbcc", "a", False, 3),
                ],
            },
            {
                "title": "합이 X가 되는 두 수의 쌍",
                "description": "정수 배열과 정수 X가 주어진다. 서로 다른 두 위치의 숫자를 골라 더했을 때 X가 되는 경우의 개수를 출력하시오.",
                "difficulty": "hard",
                "points": 30,
                "time_limit": 2,
                "memory_limit": 256,
                "test_cases": [
                    ("6 9\n2 7 4 5 1 8", "2", True, 1),
                    ("5 10\n1 2 3 4 5", "2", False, 2),
                ],
            },
            {
                "title": "시험 합격자 수 계산",
                "description": "한 시험에는 총 N명의 학생이 응시했다. 각 학생의 점수가 주어질 때, 합격한 학생의 수를 출력하시오.\n합격 기준: 점수가 평균 점수 이상이면 합격. 평균 점수는 소수점 이하를 버린 값으로 계산한다.",
                "difficulty": "hard",
                "points": 30,
                "time_limit": 2,
                "memory_limit": 128,
                "test_cases": [
                    ("5\n70 80 90 60 100", "3", True, 1),
                    ("3\n50 50 50", "3", False, 2),
                ],
            },
        ]

        sample_problems = []
        for pdata in sample_problems_data:
            p = Problem(
                test_id=sample_test.id,
                title=pdata["title"],
                description=pdata["description"],
                difficulty=pdata["difficulty"],
                points=pdata["points"],
                time_limit=pdata["time_limit"],
                memory_limit=pdata["memory_limit"],
            )
            db.add(p)
            await db.flush()
            sample_problems.append((p, pdata["test_cases"]))

        for prob, tc_list in sample_problems:
            for inp, out, is_sample, order in tc_list:
                db.add(
                    TestCase(
                        problem_id=prob.id,
                        input_data=inp,
                        expected_output=out,
                        is_sample=is_sample,
                        order=order,
                    )
                )
        await db.flush()

        # ProblemBank - Practice problems
        practice_problems = [
            ProblemBank(
                title="두 수의 합",
                description="두 정수 A와 B를 입력받아 A+B를 출력하시오.",
                level=1,
                language="python",
                difficulty="easy",
                points=50,
                time_limit=1,
                memory_limit=128,
            ),
            ProblemBank(
                title="두 수의 차",
                description="두 정수 A와 B를 입력받아 A-B를 출력하시오.",
                level=1,
                language="python",
                difficulty="easy",
                points=50,
                time_limit=1,
                memory_limit=128,
            ),
            ProblemBank(
                title="두 수의 곱",
                description="두 정수 A와 B를 입력받아 A*B를 출력하시오.",
                level=1,
                language="python",
                difficulty="easy",
                points=50,
                time_limit=1,
                memory_limit=128,
            ),
            ProblemBank(
                title="홀수인지 짝수인지",
                description="정수 N을 입력받아 홀수이면 'odd', 짝수이면 'even'을 출력하시오.",
                level=2,
                language="python",
                difficulty="easy",
                points=100,
                time_limit=1,
                memory_limit=128,
            ),
            ProblemBank(
                title="최댓값 구하기",
                description="세 정수 A, B, C를 입력받아 최댓값을 출력하시오.",
                level=2,
                language="python",
                difficulty="medium",
                points=100,
                time_limit=1,
                memory_limit=128,
            ),
            ProblemBank(
                title="팩토리얼",
                description="정수 N을 입력받아 N!을 출력하시오. (1 <= N <= 20)",
                level=3,
                language="python",
                difficulty="medium",
                points=150,
                time_limit=1,
                memory_limit=128,
            ),
        ]
        db.add_all(practice_problems)
        await db.flush()

        # ProblemBankTestCase
        problem_bank_test_cases = [
            # 두 수의 합 테스트 케이스
            ProblemBankTestCase(
                problem_id=practice_problems[0].id,
                input_data="1 2",
                expected_output="3",
                is_sample=True,
                order=1,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[0].id,
                input_data="5 10",
                expected_output="15",
                is_sample=True,
                order=2,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[0].id,
                input_data="-3 7",
                expected_output="4",
                is_sample=False,
                order=3,
            ),
            # 두 수의 차 테스트 케이스
            ProblemBankTestCase(
                problem_id=practice_problems[1].id,
                input_data="5 3",
                expected_output="2",
                is_sample=True,
                order=1,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[1].id,
                input_data="10 15",
                expected_output="-5",
                is_sample=True,
                order=2,
            ),
            # 두 수의 곱 테스트 케이스
            ProblemBankTestCase(
                problem_id=practice_problems[2].id,
                input_data="3 4",
                expected_output="12",
                is_sample=True,
                order=1,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[2].id,
                input_data="7 8",
                expected_output="56",
                is_sample=True,
                order=2,
            ),
            # 홀수/짝수 테스트 케이스
            ProblemBankTestCase(
                problem_id=practice_problems[3].id,
                input_data="3",
                expected_output="odd",
                is_sample=True,
                order=1,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[3].id,
                input_data="8",
                expected_output="even",
                is_sample=True,
                order=2,
            ),
            # 최댓값 테스트 케이스
            ProblemBankTestCase(
                problem_id=practice_problems[4].id,
                input_data="1 2 3",
                expected_output="3",
                is_sample=True,
                order=1,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[4].id,
                input_data="10 5 8",
                expected_output="10",
                is_sample=True,
                order=2,
            ),
            # 팩토리얼 테스트 케이스
            ProblemBankTestCase(
                problem_id=practice_problems[5].id,
                input_data="5",
                expected_output="120",
                is_sample=True,
                order=1,
            ),
            ProblemBankTestCase(
                problem_id=practice_problems[5].id,
                input_data="10",
                expected_output="3628800",
                is_sample=True,
                order=2,
            ),
        ]
        db.add_all(problem_bank_test_cases)

        await db.commit()
