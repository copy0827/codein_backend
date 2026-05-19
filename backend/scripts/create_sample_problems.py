"""
Create sample coding test problems for CodeIn
Run: python scripts/create_sample_problems.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session
from app.models.codetest import Test, Problem, TestCase
from datetime import datetime, timedelta


SAMPLE_PROBLEMS = [
    {
        "difficulty": "easy",
        "title": "두 수의 합과 차",
        "description": """두 정수 A와 B가 주어진다.
A와 B의 합과 차(A − B)를 공백으로 구분하여 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 10,
        "test_cases": [
            {"input": "7 3", "output": "10 4", "is_sample": True, "order": 1},
            {"input": "10 5", "output": "15 5", "is_sample": False, "order": 2},
            {"input": "100 50", "output": "150 50", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "easy",
        "title": "짝수와 홀수 판별",
        "description": """정수 N이 주어진다.
N이 짝수이면 EVEN, 홀수이면 ODD를 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 10,
        "test_cases": [
            {"input": "8", "output": "EVEN", "is_sample": True, "order": 1},
            {"input": "7", "output": "ODD", "is_sample": False, "order": 2},
            {"input": "0", "output": "EVEN", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "easy",
        "title": "세 수 중 최댓값",
        "description": """서로 다른 세 개의 정수가 주어진다.
이 중 가장 큰 값을 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 10,
        "test_cases": [
            {"input": "2 9 7", "output": "9", "is_sample": True, "order": 1},
            {"input": "1 2 3", "output": "3", "is_sample": False, "order": 2},
            {"input": "100 50 75", "output": "100", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "easy",
        "title": "문자열 길이 구하기",
        "description": """공백이 없는 문자열 하나가 주어진다.
해당 문자열의 길이를 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 10,
        "test_cases": [
            {"input": "Hello", "output": "5", "is_sample": True, "order": 1},
            {"input": "CodeIn", "output": "6", "is_sample": False, "order": 2},
            {"input": "a", "output": "1", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "easy",
        "title": "피보나치 수열",
        "description": """양의 정수 N이 주어진다. 피보나치 수열의 처음 N개 숫자를 공백으로 구분하여 출력하시오.
첫 번째 숫자는 0, 두 번째 숫자는 1, 그 이후 숫자는 앞의 두 숫자의 합이다.""",
        "language": "python",
        "time_limit": 2,
        "memory_limit": 128,
        "points": 15,
        "test_cases": [
            {"input": "5", "output": "0 1 1 2 3", "is_sample": True, "order": 1},
            {"input": "7", "output": "0 1 1 2 3 5 8", "is_sample": False, "order": 2},
            {
                "input": "10",
                "output": "0 1 1 2 3 5 8 13 21 34",
                "is_sample": False,
                "order": 3,
            },
        ],
    },
    {
        "difficulty": "medium",
        "title": "자릿수 합",
        "description": """0 이상의 정수 N이 주어진다. N을 이루는 각 자리 숫자의 합을 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 20,
        "test_cases": [
            {"input": "12340", "output": "10", "is_sample": True, "order": 1},
            {"input": "999", "output": "27", "is_sample": False, "order": 2},
            {"input": "0", "output": "0", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "medium",
        "title": "숫자 뒤집기와 합산",
        "description": """두 개의 정수가 주어진다.
각 숫자를 뒤집는다. 뒤집은 두 숫자를 더한다. 더한 결과를 다시 뒤집어서 출력한다.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 20,
        "test_cases": [
            {"input": "123 456", "output": "579", "is_sample": True, "order": 1},
            {"input": "100 200", "output": "3", "is_sample": False, "order": 2},
            {"input": "789 111", "output": "1098", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "medium",
        "title": "특정 문자 개수 세기",
        "description": """문자열 S와 문자 하나가 주어진다.
문자열 S 안에 해당 문자가 몇 번 등장하는지 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 20,
        "test_cases": [
            {"input": "banana\na", "output": "3", "is_sample": True, "order": 1},
            {"input": "hello\nl", "output": "2", "is_sample": False, "order": 2},
            {"input": "aaaaa\na", "output": "5", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "medium",
        "title": "배열 오른쪽 이동",
        "description": """정수 N과 N개의 숫자가 주어진다.
배열을 오른쪽으로 한 칸 이동한 결과를 출력하시오.""",
        "language": "python",
        "time_limit": 1,
        "memory_limit": 128,
        "points": 20,
        "test_cases": [
            {"input": "4\n1 2 3 4", "output": "4 1 2 3", "is_sample": True, "order": 1},
            {
                "input": "5\n5 4 3 2 1",
                "output": "1 5 4 3 2",
                "is_sample": False,
                "order": 2,
            },
            {"input": "1\n10", "output": "10", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "medium",
        "title": "행렬 덧셈",
        "description": """N×M 크기의 두 행렬 A와 B가 주어진다.
같은 위치에 있는 숫자끼리 더한 결과 행렬을 출력하시오.""",
        "language": "python",
        "time_limit": 2,
        "memory_limit": 256,
        "points": 25,
        "test_cases": [
            {
                "input": "3 3\n1 1 1\n2 2 2\n0 1 0\n3 3 3\n4 4 4\n5 5 100",
                "output": "4 4 4\n6 6 6\n5 6 100",
                "is_sample": True,
                "order": 1,
            },
            {
                "input": "2 2\n1 2\n3 4\n5 6\n7 8",
                "output": "6 8\n10 12",
                "is_sample": False,
                "order": 2,
            },
        ],
    },
    {
        "difficulty": "hard",
        "title": "가장 많이 나온 문자",
        "description": """알파벳 소문자로 이루어진 문자열이 주어진다. 가장 많이 등장한 문자를 출력하시오.
여러 개일 경우 알파벳 순으로 가장 앞선 문자를 출력한다.""",
        "language": "python",
        "time_limit": 2,
        "memory_limit": 128,
        "points": 30,
        "test_cases": [
            {"input": "abbcccdd", "output": "c", "is_sample": True, "order": 1},
            {"input": "aabbcc", "output": "a", "is_sample": False, "order": 2},
            {"input": "zzaabbcc", "output": "a", "is_sample": False, "order": 3},
        ],
    },
    {
        "difficulty": "hard",
        "title": "합이 X가 되는 두 수의 쌍",
        "description": """정수 배열과 정수 X가 주어진다. 서로 다른 두 위치의 숫자를 골라 더했을 때 X가 되는 경우의 개수를 출력하시오.""",
        "language": "python",
        "time_limit": 2,
        "memory_limit": 256,
        "points": 30,
        "test_cases": [
            {"input": "6 9\n2 7 4 5 1 8", "output": "2", "is_sample": True, "order": 1},
            {"input": "5 10\n1 2 3 4 5", "output": "2", "is_sample": False, "order": 2},
        ],
    },
    {
        "difficulty": "hard",
        "title": "시험 합격자 수 계산",
        "description": """한 시험에는 총 N명의 학생이 응시했다. 각 학생의 점수가 주어질 때, 합격한 학생의 수를 출력하시오.
합격 기준: 점수가 평균 점수 이상이면 합격. 평균 점수는 소수점 이하를 버린 값으로 계산한다.""",
        "language": "python",
        "time_limit": 2,
        "memory_limit": 128,
        "points": 30,
        "test_cases": [
            {
                "input": "5\n70 80 90 60 100",
                "output": "3",
                "is_sample": True,
                "order": 1,
            },
            {"input": "3\n50 50 50", "output": "3", "is_sample": False, "order": 2},
        ],
    },
]


async def create_sample_test():
    async with async_session() as db:
        test = Test(
            title="CodeIn 샘플 코딩테스트",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=30),
        )
        db.add(test)
        await db.commit()
        await db.refresh(test)

        print(f"Created test: {test.title} (ID: {test.id})")

        for prob_data in SAMPLE_PROBLEMS:
            test_cases_data = prob_data.pop("test_cases")

            problem = Problem(test_id=test.id, **prob_data)
            db.add(problem)
            await db.commit()
            await db.refresh(problem)

            print(f"  Created problem: {problem.title} (ID: {problem.id})")

            for tc_data in test_cases_data:
                test_case = TestCase(
                    problem_id=problem.id,
                    input_data=tc_data["input"],
                    expected_output=tc_data["output"],
                    is_sample=tc_data["is_sample"],
                    order=tc_data["order"],
                )
                db.add(test_case)

            await db.commit()
            print(f"    Added {len(test_cases_data)} test cases")

        print("\n✅ Sample test created successfully!")
        print(f"Test ID: {test.id}")
        print(f"Total Problems: {len(SAMPLE_PROBLEMS)}")


if __name__ == "__main__":
    asyncio.run(create_sample_test())
