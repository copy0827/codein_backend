import asyncio
from sqlalchemy import select
from app.db.session import async_session
from app.models.codetest import ProblemBank, ProblemBankTestCase

PROBLEMS_DATA = {
    1: [
        {
            "title": "두 수의 합과 차",
            "description": "두 정수 A와 B가 주어진다.\nA와 B의 합과 차(A - B)를 공백으로 구분하여 출력하시오.",
            "input_ex": "7 3",
            "output_ex": "10 4",
            "points": 10,
        },
        {
            "title": "짝수와 홀수 판별",
            "description": "정수 N이 주어진다.\nN이 짝수이면 EVEN, 홀수이면 ODD를 출력하시오.",
            "input_ex": "8",
            "output_ex": "EVEN",
            "points": 10,
        },
        {
            "title": "세 수 중 최댓값",
            "description": "서로 다른 세 개의 정수가 주어진다.\n이 중 가장 큰 값을 출력하시오.",
            "input_ex": "2 9 7",
            "output_ex": "9",
            "points": 10,
        },
        {
            "title": "문자열 길이 구하기",
            "description": "공백이 없는 문자열 하나가 주어진다.\n해당 문자열의 길이를 출력하시오.",
            "input_ex": "Hello",
            "output_ex": "5",
            "points": 10,
        },
        {
            "title": "피보나치 수열",
            "description": "양의 정수 N이 주어진다.\n피보나치 수열의 처음 N개 숫자를 공백으로 구분하여 출력하시오.\n첫 번째 숫자는 0, 두 번째 숫자는 1이며 그 이후 숫자는 앞의 두 숫자의 합이다.",
            "input_ex": "5",
            "output_ex": "0 1 1 2 3",
            "points": 10,
        },
    ],
    2: [
        {
            "title": "자릿수 합",
            "description": "0 이상의 정수 N이 주어진다.\nN을 이루는 각 자리 숫자의 합을 출력하시오.",
            "input_ex": "12340",
            "output_ex": "10",
            "points": 20,
        },
        {
            "title": "숫자 뒤집기와 합산",
            "description": "두 개의 정수가 주어진다.\n각 숫자를 뒤집는다.\n뒤집은 두 숫자를 더한다.\n더한 결과를 다시 뒤집어서 출력한다.",
            "input_ex": "123 456",
            "output_ex": "579",
            "points": 20,
        },
        {
            "title": "특정 문자 개수 세기",
            "description": "문자열 S와 문자 하나가 주어진다.\n문자열 S 안에 해당 문자가 몇 번 등장하는지 출력하시오.",
            "input_ex": "banana\na",
            "output_ex": "3",
            "points": 20,
        },
        {
            "title": "배열 오른쪽 이동",
            "description": "정수 N과 N개의 숫자가 주어진다.\n배열을 오른쪽으로 한 칸 이동한 결과를 출력하시오.",
            "input_ex": "4\n1 2 3 4",
            "output_ex": "4 1 2 3",
            "points": 20,
        },
        {
            "title": "행렬 덧셈",
            "description": "N×M 크기의 두 행렬 A와 B가 주어진다.\n같은 위치에 있는 숫자끼리 더한 결과 행렬을 출력하시오.",
            "input_ex": "3 3\n1 1 1\n2 2 2\n0 1 0\n3 3 3\n4 4 4\n5 5 100",
            "output_ex": "4 4 4\n6 6 6\n5 6 100",
            "points": 20,
        },
    ],
    3: [
        {
            "title": "가장 많이 나온 문자",
            "description": "알파벳 소문자로 이루어진 문자열이 주어진다. 가장 많이 등장한 문자를 출력하시오.\n여러 개일 경우 알파벳 순으로 가장 앞선 문자를 출력한다.",
            "input_ex": "abbcccdd",
            "output_ex": "c",
            "points": 30,
        },
        {
            "title": "합이 X가 되는 두 수의 쌍",
            "description": "정수 배열과 정수 X가 주어진다.\n서로 다른 두 위치의 숫자를 골라 더했을 때 X가 되는 경우의 개수를 출력하시오.",
            "input_ex": "6 9\n2 7 4 5 1 8",
            "output_ex": "2",
            "points": 30,
        },
        {
            "title": "시험 합격자 수 계산",
            "description": "한 시험에는 총 N명의 학생이 응시했다. 각 학생의 점수가 주어질 때, 합격한 학생의 수를 출력하시오.\n합격 기준: 점수가 평균 점수 이상이면 합격 (평균 점수는 소수점 이하 버림)",
            "input_ex": "5\n70 80 90 60 100",
            "output_ex": "3",
            "points": 30,
        },
        {
            "title": "소인수분해",
            "description": "정수 N이 주어진다. N을 소인수분해한 결과를 작은 수부터 한 줄에 하나씩 출력하시오.\nN이 1이면 아무것도 출력하지 않는다.",
            "input_ex": "72",
            "output_ex": "2\n2\n2\n3\n3",
            "points": 30,
        },
        {
            "title": "단어 정렬",
            "description": "여러 개의 단어가 주어진다. 정렬 기준에 맞춰 정렬하여 출력하시오.\n1. 길이가 짧은 단어부터\n2. 길이가 같으면 알파벳 순서대로\n3. 중복된 단어는 한 번만 출력",
            "input_ex": "5\nbut\ni\nno\nmore\nbut",
            "output_ex": "i\nno\nbut\nmore",
            "points": 30,
        },
    ],
    4: [
        {
            "title": "오른쪽에서 처음 만나는 큰 수",
            "description": "각 숫자에 대해, 오른쪽에 있으면서 자기보다 큰 수 중 가장 먼저 나오는 값을 출력하시오.\n없으면 -1을 출력한다.",
            "input_ex": "4\n2 1 2 4",
            "output_ex": "4 2 4 -1",
            "points": 40,
        },
        {
            "title": "최소 동전 개수",
            "description": "동전의 종류가 1, 5, 10, 50, 100, 500원일 때,\n주어진 금액을 만들기 위한 최소 동전 개수를 출력하시오.",
            "input_ex": "4720",
            "output_ex": "13",
            "points": 40,
        },
        {
            "title": "미로 최단 이동 거리",
            "description": "0은 이동 가능, 1은 벽인 격자가 주어진다.\n왼쪽 위에서 오른쪽 아래까지 이동할 수 있는 최소 이동 칸 수를 출력하시오.\n이동할 수 없으면 -1을 출력한다.",
            "input_ex": "3 3\n000\n110\n000",
            "output_ex": "5",
            "points": 40,
        },
        {
            "title": "제곱 조건을 만족하는 최소 수",
            "description": "정수 N이 주어진다.\nk² ≥ N 을 만족하는 가장 작은 정수 k를 출력하시오.",
            "input_ex": "10",
            "output_ex": "4",
            "points": 40,
        },
        {
            "title": "대소문자 무시 애너그램",
            "description": "두 문자열이 주어진다.\n대소문자를 무시했을 때 두 문자열이 같은 문자들로 이루어져 있으면 YES, 아니면 NO를 출력하시오.",
            "input_ex": "Listen\nSilent",
            "output_ex": "YES",
            "points": 40,
        },
    ],
    5: [
        {
            "title": "최대 활동 선택",
            "description": "여러 활동의 시작 시간과 끝 시간이 주어진다.\n서로 겹치지 않게 선택할 수 있는 활동의 최대 개수를 출력하시오.",
            "input_ex": "4\n1 3\n2 5\n4 6\n6 7",
            "output_ex": "3",
            "points": 50,
        },
        {
            "title": "단어 변환 최소 횟수",
            "description": "시작 단어에서 목표 단어로 변환하려 한다.\n한 번에 한 글자만 바꿀 수 있으며, 중간 단어는 주어진 목록에 있어야 한다.\n필요한 최소 변환 횟수를 출력하시오.\n불가능하면 -1을 출력한다.",
            "input_ex": "hit\ncog\n6\nhot\ndot\ndog\nlot\nlog\ncog",
            "output_ex": "4",
            "points": 50,
        },
        {
            "title": "K번째로 작은 수",
            "description": "정수 배열과 정수 K가 주어진다.\n배열을 오름차순으로 정렬했을 때 K번째로 작은 수를 출력하시오.",
            "input_ex": "5 2\n9 1 5 3 7",
            "output_ex": "3",
            "points": 50,
        },
        {
            "title": "가장 긴 연속된 숫자 길이",
            "description": "정수 배열이 주어진다.\n숫자가 1씩 증가하는 연속된 값들로 이루어진 가장 긴 구간의 길이를 출력하시오.",
            "input_ex": "6\n100 4 200 1 3 2",
            "output_ex": "4",
            "points": 50,
        },
        {
            "title": "문자 삭제로 문자열 만들기",
            "description": "문자열 A에서 일부 문자를 삭제하여 문자열 B를 만들 수 있다.\n가능하다면 필요한 최소 삭제 횟수를 출력하고,\n불가능하면 -1을 출력하시오.",
            "input_ex": "abcde\nace",
            "output_ex": "2",
            "points": 50,
        },
    ],
}


async def seed_problems():
    async with async_session() as db:
        for level, problems in PROBLEMS_DATA.items():
            for p_data in problems:
                p_query = select(ProblemBank).where(
                    ProblemBank.title == p_data["title"],
                    ProblemBank.level == level,
                )
                p_result = await db.execute(p_query)
                problem = p_result.scalar_one_or_none()

                if problem:
                    continue

                problem = ProblemBank(
                    title=p_data["title"],
                    description=p_data["description"],
                    level=level,
                    language="python",
                    time_limit=5,
                    memory_limit=256,
                    difficulty=f"Level {level}",
                    points=p_data["points"],
                )
                db.add(problem)
                await db.commit()
                await db.refresh(problem)

                tc = ProblemBankTestCase(
                    problem_id=problem.id,
                    input_data=p_data["input_ex"],
                    expected_output=p_data["output_ex"],
                    is_sample=True,
                    order=1,
                )
                db.add(tc)
                await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_problems())
