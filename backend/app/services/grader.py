import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.codetest import Problem, LanguageRuntime, ProblemBank
from app.services.code_executor import CodeExecutor, ExecutionResult
from app.services.language_registry import runtime_from_model


class GraderResult:
    def __init__(
        self,
        result: str,
        test_cases_passed: int,
        test_cases_total: int,
        execution_time: float,
        memory_used: int,
        error_message: Optional[str] = None,
    ):
        self.result = result
        self.test_cases_passed = test_cases_passed
        self.test_cases_total = test_cases_total
        self.execution_time = execution_time
        self.memory_used = memory_used
        self.error_message = error_message


class Grader:
    def __init__(self):
        self.executor = CodeExecutor()

    async def grade_submission(
        self, db: AsyncSession, problem_id: int, code: str, language: str
    ) -> GraderResult:
        query = (
            select(Problem)
            .options(selectinload(Problem.test_cases))
            .where(Problem.id == problem_id)
        )
        result = await db.execute(query)
        problem = result.scalar_one_or_none()

        if not problem:
            raise ValueError(f"Problem {problem_id} not found")

        if not problem.test_cases:
            return GraderResult(
                result="error",
                test_cases_passed=0,
                test_cases_total=0,
                execution_time=0.0,
                memory_used=0,
                error_message="No test cases configured for this problem",
            )

        test_cases = sorted(problem.test_cases, key=lambda x: x.order)
        passed = 0
        total = len(test_cases)
        max_execution_time = 0.0
        max_memory_used = 0
        first_error = None

        runtime_result = await db.execute(
            select(LanguageRuntime)
            .where(
                LanguageRuntime.language_key == language,
                LanguageRuntime.enabled.is_(True),
            )
            .order_by(LanguageRuntime.id.desc())
        )
        runtime_model = runtime_result.scalars().first()
        if not runtime_model:
            return GraderResult(
                result="error",
                test_cases_passed=0,
                test_cases_total=total,
                execution_time=0.0,
                memory_used=0,
                error_message="Unsupported language",
            )
        runtime = runtime_from_model(runtime_model)

        async def evaluate_test_case(tc):
            try:
                exec_result: ExecutionResult = await asyncio.to_thread(
                    self.executor.execute_code,
                    code=code,
                    runtime=runtime,
                    stdin_data=tc.input_data,
                    time_limit=problem.time_limit,
                    memory_limit=problem.memory_limit,
                )
                return tc, exec_result, None
            except Exception as e:
                return tc, None, str(e)

        results = await asyncio.gather(*(evaluate_test_case(tc) for tc in test_cases))

        for tc, exec_result, exception_str in results:
            if exception_str:
                first_error = first_error or f"Execution error: {exception_str}"
                return GraderResult(
                    result="error",
                    test_cases_passed=passed,
                    test_cases_total=total,
                    execution_time=max_execution_time,
                    memory_used=max_memory_used,
                    error_message=first_error,
                )

            max_execution_time = max(max_execution_time, exec_result.execution_time)
            max_memory_used = max(max_memory_used, exec_result.memory_used)

            if exec_result.timeout:
                first_error = first_error or "Time limit exceeded"
                break

            if exec_result.memory_exceeded:
                first_error = first_error or "Memory limit exceeded"
                return GraderResult(
                    result="memory_exceeded",
                    test_cases_passed=passed,
                    test_cases_total=total,
                    execution_time=max_execution_time,
                    memory_used=max_memory_used,
                    error_message=first_error,
                )

            if exec_result.exit_code != 0:
                first_error = first_error or f"Runtime error: {exec_result.stderr}"
                return GraderResult(
                    result="error",
                    test_cases_passed=passed,
                    test_cases_total=total,
                    execution_time=max_execution_time,
                    memory_used=max_memory_used,
                    error_message=first_error,
                )

            actual_output = exec_result.stdout.strip()
            expected_output = tc.expected_output.strip()

            if actual_output == expected_output:
                passed += 1
            else:
                first_error = first_error or f"Wrong answer on test case {tc.order}"
                break

        if passed == total:
            return GraderResult(
                result="correct",
                test_cases_passed=passed,
                test_cases_total=total,
                execution_time=max_execution_time,
                memory_used=max_memory_used,
                error_message=None,
            )
        elif first_error and "timeout" in first_error.lower():
            return GraderResult(
                result="timeout",
                test_cases_passed=passed,
                test_cases_total=total,
                execution_time=max_execution_time,
                memory_used=max_memory_used,
                error_message=first_error,
            )
        else:
            return GraderResult(
                result="wrong",
                test_cases_passed=passed,
                test_cases_total=total,
                execution_time=max_execution_time,
                memory_used=max_memory_used,
                error_message=first_error,
            )

    async def grade_bank_submission(
        self, db: AsyncSession, problem_id: int, code: str, language: str
    ) -> GraderResult:
        query = (
            select(ProblemBank)
            .options(selectinload(ProblemBank.test_cases))
            .where(ProblemBank.id == problem_id)
        )
        result = await db.execute(query)
        problem = result.scalar_one_or_none()

        if not problem:
            raise ValueError(f"Problem {problem_id} not found")

        if not problem.test_cases:
            return GraderResult(
                result="error",
                test_cases_passed=0,
                test_cases_total=0,
                execution_time=0.0,
                memory_used=0,
                error_message="No test cases configured for this problem",
            )

        test_cases = sorted(problem.test_cases, key=lambda x: x.order)
        passed = 0
        total = len(test_cases)
        max_execution_time = 0.0
        max_memory_used = 0
        first_error = None

        runtime_result = await db.execute(
            select(LanguageRuntime)
            .where(
                LanguageRuntime.language_key == language,
                LanguageRuntime.enabled.is_(True),
            )
            .order_by(LanguageRuntime.id.desc())
        )
        runtime_model = runtime_result.scalars().first()
        if not runtime_model:
            return GraderResult(
                result="error",
                test_cases_passed=0,
                test_cases_total=total,
                execution_time=0.0,
                memory_used=0,
                error_message="Unsupported language",
            )
        runtime = runtime_from_model(runtime_model)

        async def evaluate_test_case(tc):
            try:
                exec_result: ExecutionResult = await asyncio.to_thread(
                    self.executor.execute_code,
                    code=code,
                    runtime=runtime,
                    stdin_data=tc.input_data,
                    time_limit=problem.time_limit,
                    memory_limit=problem.memory_limit,
                )
                return tc, exec_result, None
            except Exception as e:
                return tc, None, str(e)

        results = await asyncio.gather(*(evaluate_test_case(tc) for tc in test_cases))

        for tc, exec_result, exception_str in results:
            if exception_str:
                first_error = first_error or f"Execution error: {exception_str}"
                return GraderResult(
                    result="error",
                    test_cases_passed=passed,
                    test_cases_total=total,
                    execution_time=max_execution_time,
                    memory_used=max_memory_used,
                    error_message=first_error,
                )

            max_execution_time = max(max_execution_time, exec_result.execution_time)
            max_memory_used = max(max_memory_used, exec_result.memory_used)

            if exec_result.timeout:
                first_error = first_error or "Time limit exceeded"
                break

            if exec_result.memory_exceeded:
                first_error = first_error or "Memory limit exceeded"
                return GraderResult(
                    result="memory_exceeded",
                    test_cases_passed=passed,
                    test_cases_total=total,
                    execution_time=max_execution_time,
                    memory_used=max_memory_used,
                    error_message=first_error,
                )

            if exec_result.exit_code != 0:
                first_error = first_error or f"Runtime error: {exec_result.stderr}"
                return GraderResult(
                    result="error",
                    test_cases_passed=passed,
                    test_cases_total=total,
                    execution_time=max_execution_time,
                    memory_used=max_memory_used,
                    error_message=first_error,
                )

            actual_output = exec_result.stdout.strip()
            expected_output = tc.expected_output.strip()

            if actual_output == expected_output:
                passed += 1
            else:
                first_error = first_error or f"Wrong answer on test case {tc.order}"
                break

        if passed == total:
            return GraderResult(
                result="correct",
                test_cases_passed=passed,
                test_cases_total=total,
                execution_time=max_execution_time,
                memory_used=max_memory_used,
                error_message=None,
            )
        elif first_error and "timeout" in first_error.lower():
            return GraderResult(
                result="timeout",
                test_cases_passed=passed,
                test_cases_total=total,
                execution_time=max_execution_time,
                memory_used=max_memory_used,
                error_message=first_error,
            )
        else:
            return GraderResult(
                result="wrong",
                test_cases_passed=passed,
                test_cases_total=total,
                execution_time=max_execution_time,
                memory_used=max_memory_used,
                error_message=first_error,
            )
