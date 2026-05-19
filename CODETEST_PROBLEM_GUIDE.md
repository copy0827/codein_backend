# 코딩테스트 문제 추가 가이드 (전체)

## 개요

CodeIn 코딩테스트 시스템은 **테스트(Test)** → **문제(Problem)** → **테스트 케이스(TestCase)** 순서로 구성됩니다. 이 문서는 관리자용 문제 추가 절차와 API 사용법을 한국어로 정리한 가이드입니다.

---

## 구조 요약

### 모델 구성

- **Test**: 여러 문제를 담는 컨테이너 (시작/종료 시간 포함)
- **Problem**: 테스트에 속한 개별 문제
- **TestCase**: 채점 입력/출력 쌍
- **Submission**: 제출 기록 및 채점 결과

### 문제 유형 2가지

1. **테스트 문제 (Problem)**
   - 특정 Test에 소속
   - 시작/종료 시간 제한 있음
   - 관리자만 생성 가능

2. **연습 문제 (ProblemBank)**
   - 상시 제공되는 연습 문제
   - 난이도 레벨(1~5) 기반
   - 공개/비공개 구분 (`is_public`)
   - 비공개 문제는 연습 목록에서 숨김
   - 관리자 API/관리자 UI에서 생성 가능

---

## 단계별 생성 절차

### 방법 1: 직접 생성 (기존 방식)

### 1단계: 테스트(Test) 생성

**Endpoint**: `POST /api/v1/codetest/tests`  
**권한**: `admin` 또는 `superadmin`

```json
{
  "title": "제1회 알고리즘 대회",
  "start_time": "2026-02-03T01:46:05+09:00",
  "end_time": "2026-02-03T03:00:00+09:00"
}
```

- `start_time`, `end_time`은 **ISO 8601 형식의 문자열**입니다.
  - 예: `2026-02-03T01:46:05+09:00`, `2026-02-03T01:46:05Z`

**응답 예제**:
```json
{ "status": "created" }
```

---

### 2단계: 문제(Problem) 생성

**Endpoint**: `POST /api/v1/codetest/tests/{test_id}/problems`  
**권한**: `admin` 또는 `superadmin`

```json
{
  "title": "두 수의 합",
  "description": "두 정수 A와 B가 주어진다. A+B를 출력하시오.",
  "language": "python",
  "time_limit": 5,
  "memory_limit": 256,
  "difficulty": "easy",
  "points": 100
}
```

#### 필드 설명

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `title` | string | - | 문제 제목 (필수) |
| `description` | string | - | 문제 설명 (필수) |
| `language` | string | `python` | `python`, `javascript`, `java` |
| `time_limit` | int | `5` | **초 단위** 제한 시간 |
| `memory_limit` | int | `256` | **MB 단위** 메모리 제한 |
| `difficulty` | string | `easy` | `easy`, `medium`, `hard` |
| `points` | int | `100` | 정답 시 지급 포인트 |

**응답 예제**:
```json
{ "status": "problem added" }
```

> 응답에 `problem_id`가 포함되지 않으므로, 생성 후 `GET /api/v1/codetest/tests/{test_id}` 로 문제 목록을 조회해야 합니다.

---

### 3단계: 테스트 케이스(TestCase) 추가

**Endpoint**: `POST /api/v1/codetest/problems/{problem_id}/testcases`  
**권한**: `admin` 또는 `superadmin`

#### 테스트 케이스란? (Test Case)
작성한 코드가 올바르게 동작하는지 검증하기 위한 **"입력과 예상 출력의 쌍"**입니다. 코딩테스트 시스템은 사용자의 코드에 이 입력들을 하나씩 넣어보고, 결과가 예상 출력과 정확히 일치하는지 자동으로 채점합니다.

**CodeIn 시스템에서의 역할:**
- **Sample Case**: 문제 설명에 보여주는 예제 (공개)
- **Hidden Case**: 채점할 때만 쓰는 비공개 케이스 (점수 결정)

#### 예제 테스트 케이스 (사용자에게 공개됨)
```json
{
  "input_data": "1 2",
  "expected_output": "3",
  "is_sample": true,
  "order": 1
}
```

#### 히든 테스트 케이스 (채점 전용)
```json
{
  "input_data": "100 200",
  "expected_output": "300",
  "is_sample": false,
  "order": 2
}
```

#### 필드 설명

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `input_data` | string | - | 표준 입력 문자열 |
| `expected_output` | string | - | 예상 출력 문자열 |
| `is_sample` | bool | `false` | `true`면 학생에게 공개 |
| `order` | int | `0` | 실행/표시 순서 |

**응답 예제**:
```json
{ "status": "testcase added", "id": 42 }
```

> **최소 1개의 테스트 케이스가 반드시 필요**합니다. 그렇지 않으면 채점이 동작하지 않습니다.


---

### 방법 2: ProblemBank에서 복사 생성 (스냅샷 방식)

연습 문제(ProblemBank)를 템플릿으로 사용해 테스트 문제를 빠르게 생성할 수 있습니다. 문제와 테스트 케이스가 모두 스냅샷 복사되며, 원본 ProblemBank ID가 저장됩니다.

- 비공개 ProblemBank도 관리자 권한이면 복사 가능합니다.

**Endpoint**: `POST /api/v1/codetest/tests/{test_id}/problems/from-bank`  
**권한**: `admin` 또는 `superadmin`

#### 기본 요청 (연습 문제 그대로 복사)

```json
{
  "problem_bank_id": 1
}
```

- `problem_bank_id`: 복사할 연습 문제 ID (필수)

#### 고급 요청 (일부 필드 오버라이드)

```json
{
  "problem_bank_id": 1,
  "title": "제1회 대회 - 두 수의 합",
  "points": 150,
  "difficulty": "medium"
}
```

**오버라이드 가능 필드**:
- `title`: 문제 제목
- `description`: 문제 설명
- `language`: 언어 (`python`, `javascript`, `java`)
- `time_limit`: 시간 제한 (초)
- `memory_limit`: 메모리 제한 (MB)
- `difficulty`: 난이도 (`easy`, `medium`, `hard`)
- `points`: 배점

**응답 예제**:
```json
{
  "problem_id": 42,
  "test_cases_copied": 5,
  "source_problem_bank_id": 1
}
```

- `problem_id`: 생성된 Problem의 ID
- `test_cases_copied`: 복사된 테스트 케이스 수
- `source_problem_bank_id`: 원본 ProblemBank ID

#### 복사 동작

1. ProblemBank와 모든 test_cases를 로드
2. 새 Problem 생성 (오버라이드 값 또는 원본 값 사용)
3. `source_problem_bank_id` 필드에 원본 ID 저장
4. 모든 테스트 케이스를 새 TestCase로 복사
5. 각 TestCase의 `source_problem_bank_test_case_id`에 원본 ID 저장

---

## 전체 예제 (cURL)

### 방법 1: 직접 생성

### 1) 테스트 생성

```bash
curl -X POST http://localhost/api/v1/codetest/tests \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "제1회 알고리즘 대회",
    "start_time": "2026-02-03T01:46:05+09:00",
    "end_time": "2026-02-03T03:00:00+09:00"
  }'
```

### 2) 문제 생성

```bash
curl -X POST http://localhost/api/v1/codetest/tests/5/problems \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "두 수의 합",
    "description": "두 정수 A와 B가 주어진다. A+B를 출력하시오.",
    "language": "python",
    "time_limit": 5,
    "memory_limit": 256,
    "difficulty": "easy",
    "points": 100
  }'
```

### 3) 테스트 케이스 추가

```bash
curl -X POST http://localhost/api/v1/codetest/problems/12/testcases \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "1 2",
    "expected_output": "3",
    "is_sample": true,
    "order": 1
  }'
```

---

### 방법 2: ProblemBank에서 복사

### 1) 테스트 생성

```bash
curl -X POST http://localhost/api/v1/codetest/tests \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "제1회 알고리즘 대회",
    "start_time": "2026-02-03T01:46:05+09:00",
    "end_time": "2026-02-03T03:00:00+09:00"
  }'
```

### 2) 연습 문제 목록 확인

```bash
curl http://localhost/api/v1/codetest/practice/problems?level=1 \
  -H "Authorization: Bearer {admin_token}"
```

- 공개(`is_public=true`) 문제만 노출됩니다.

### 3) ProblemBank에서 문제 복사

```bash
# 기본 복사 (오버라이드 없음)
curl -X POST http://localhost/api/v1/codetest/tests/5/problems/from-bank \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "problem_bank_id": 1
  }'

# 배점과 난이도만 변경
curl -X POST http://localhost/api/v1/codetest/tests/5/problems/from-bank \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "problem_bank_id": 2,
    "points": 200,
    "difficulty": "hard"
  }'
```

**응답**:
```json
{
  "problem_id": 42,
  "test_cases_copied": 5,
  "source_problem_bank_id": 1
}
```

---

## 지원 언어

| 언어 | 런타임 | 입력 방식 | 출력 방식 |
|------|--------|-----------|-----------|
| Python 3.11 | `python:3.11-alpine` | `input()` | `print()` |
| Node.js 18 | `node:18-alpine` | `fs.readFileSync(0)` | `console.log()` |
| Java 17 | `eclipse-temurin:17-jdk` | `Scanner` | `System.out.println()` |
| C++ (GCC 13) | `gcc:13` | `cin` | `cout` |

### 코드 실행용 Docker 이미지 풀

코딩테스트 채점은 Docker 이미지가 **사전에 pull** 되어 있어야 정상 동작합니다.

```bash
cd backend
bash scripts/pull_images.sh
```

직접 pull 하는 경우:

```bash
docker pull python:3.11-alpine
docker pull node:18-alpine
docker pull gcc:13
```

---

## 연습 문제(ProblemBank) 관리 API

ProblemBank는 이제 관리자 API로 생성/수정/삭제할 수 있습니다.

### 1) ProblemBank 생성

```bash
curl -X POST http://localhost/api/v1/codetest/problem-bank \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "두 수의 합",
    "description": "두 정수를 입력받아 합을 출력하시오.",
    "level": 1,
    "language": "python",
    "time_limit": 5,
    "memory_limit": 256,
    "difficulty": "easy",
    "points": 50,
    "is_public": false
  }'
```

### 2) ProblemBank 조회

```bash
# 목록
curl http://localhost/api/v1/codetest/problem-bank \
  -H "Authorization: Bearer {admin_token}"

# 단건 상세
curl http://localhost/api/v1/codetest/problem-bank/1 \
  -H "Authorization: Bearer {admin_token}"
```

### 3) ProblemBank 수정/삭제

```bash
# 수정
curl -X PUT http://localhost/api/v1/codetest/problem-bank/1 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 80,
    "difficulty": "medium",
    "is_public": true
  }'

# 삭제
curl -X DELETE http://localhost/api/v1/codetest/problem-bank/1 \
  -H "Authorization: Bearer {admin_token}"
```

### 4) ProblemBank 테스트 케이스 추가/수정/삭제

```bash
# 추가
curl -X POST http://localhost/api/v1/codetest/problem-bank/1/testcases \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "1 2",
    "expected_output": "3",
    "is_sample": true,
    "order": 1
  }'

# 수정
curl -X PUT http://localhost/api/v1/codetest/problem-bank/testcases/10 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "expected_output": "4"
  }'

# 삭제
curl -X DELETE http://localhost/api/v1/codetest/problem-bank/testcases/10 \
  -H "Authorization: Bearer {admin_token}"
```

---

## 테스트 케이스 관리

### 테스트 케이스 조회

```bash
curl http://localhost/api/v1/codetest/problems/12 \
  -H "Authorization: Bearer {admin_token}"
```

### 테스트 케이스 수정

```bash
curl -X PUT http://localhost/api/v1/codetest/testcases/42 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "5 10",
    "expected_output": "15",
    "is_sample": true,
    "order": 1
  }'
```

### 테스트 케이스 삭제

```bash
curl -X DELETE http://localhost/api/v1/codetest/testcases/42 \
  -H "Authorization: Bearer {admin_token}"
```

---

## 제출 및 채점

학생이 제출하면 시스템은 Docker 샌드박스에서 코드를 실행하고 다음 결과를 반환합니다:

- `correct`, `wrong`, `error`, `timeout`, `memory_exceeded`

### 제출 예제

```bash
curl -X POST http://localhost/api/v1/codetest/problems/12/submit \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "a,b=map(int,input().split())\nprint(a+b)",
    "language": "python"
  }'
```

### 채점 결과 예제

```json
{
  "id": 99,
  "result": "correct",
  "test_cases_passed": 5,
  "test_cases_total": 5,
  "execution_time": 0.042,
  "memory_used": 12,
  "error_message": null
}
```

- `execution_time`: **초 단위**
- `memory_used`: **MB 단위**

### 채점 기준 및 실행 시간

- 테스트 케이스는 `order` 순으로 하나씩 실행되며 **첫 실패 시 즉시 종료**합니다.
- 출력 비교는 `stdout.strip()`과 `expected_output.strip()`의 **완전 일치** 기준입니다.
- 실행 시간(`execution_time`)은 **컨테이너 오버헤드를 제외한 순수 코드 실행 시간**입니다.
  - Python/JavaScript: 실행 코드에 타이머를 주입해 실제 실행 시간을 기록합니다.
  - Java: 실행 커맨드를 `time -p`로 감싸 실제 실행 시간을 측정합니다.
- 타임아웃 판정은 **순수 실행 시간이 `time_limit`을 초과하면 실패**로 처리됩니다.
  - 무한 루프 등으로 프로세스가 종료되지 않으면 컨테이너 타임아웃으로도 실패 처리됩니다.
- 컴파일 단계는 별도 실행이며 채점 시간에는 포함되지 않습니다.

---

## 관리자 UI 상태

관리자 UI에서 코딩테스트/문제은행 관리를 지원합니다.

- 코딩테스트 관리: `/admin/codetest` (테스트 생성, 문제 추가, 테스트케이스 추가/수정/삭제)
- 문제은행 관리: `/admin/problem-bank` (문제 생성/수정/삭제, 공개/비공개, 테스트케이스 추가/수정/삭제)

> API(curl/Postman) 방식도 그대로 사용 가능합니다.

---

## 요약표

| 작업 | Endpoint | 권한 | 비고 |
|------|----------|------|------|
| 테스트 생성 | `POST /api/v1/codetest/tests` | admin+ | 시작/종료 시간 필요 |
| 문제 추가 (직접) | `POST /api/v1/codetest/tests/{test_id}/problems` | admin+ | time_limit=초, memory_limit=MB |
| 문제 추가 (복사) | `POST /api/v1/codetest/tests/{test_id}/problems/from-bank` | admin+ | ProblemBank에서 스냅샷 복사 |
| 테스트 케이스 추가 | `POST /api/v1/codetest/problems/{id}/testcases` | admin+ | 최소 1개 필요 |
| 테스트 케이스 수정 | `PUT /api/v1/codetest/testcases/{id}` | admin+ | 전체 덮어쓰기 |
| 테스트 케이스 삭제 | `DELETE /api/v1/codetest/testcases/{id}` | admin+ |  |
| 문제 상세 조회 | `GET /api/v1/codetest/problems/{id}` | admin+ | 전체 테스트 케이스 포함 |
| 테스트 상세 조회 | `GET /api/v1/codetest/tests/{id}` | member+ | 예제 테스트 케이스만 노출 |
| 연습 문제 목록 | `GET /api/v1/codetest/practice/problems` | member+ | level, count 파라미터 |
| 연습 문제 관리 | `POST /api/v1/codetest/problem-bank` | admin+ | 생성/수정/삭제 (상세 섹션 참고) |
| 제출 | `POST /api/v1/codetest/problems/{id}/submit` | member+ | 테스트 시간 내 가능 |
