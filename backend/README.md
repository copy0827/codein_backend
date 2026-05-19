# CodeIn Backend

## 역할

CodeIn 백엔드는 FastAPI 기반의 API 서버입니다. 인증, 게시판, 코딩테스트, 갤러리, 일정, 알림, 신고, 통합 검색 및 관리자 기능을 제공합니다.

- FastAPI + SQLAlchemy 2.0 (async)
- PostgreSQL
- JWT 인증 + 역할/랭크 기반 권한

## 환경 변수

Docker 실행은 루트 `.env`를 사용합니다. 로컬 개발 시 동일한 값을 `backend/.env` 또는 환경 변수로 설정하세요.

```env
DATABASE_URL=postgresql+asyncpg://codein:codein@postgres:5432/codein
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
CORS_ORIGINS=["*"]
```

## 로컬 개발

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 마이그레이션

```bash
docker-compose exec backend alembic revision --autogenerate -m "description"
docker-compose exec backend alembic upgrade head
```

개발 환경에서는 `app/db/init_db.py`로 테이블 생성 및 시딩을 수행할 수 있습니다.

## 초기 데이터 및 계정

초기 시딩 시 생성되는 테스트 계정이며 비밀번호는 모두 `password123`입니다.

| 이메일 | 역할 | 랭크 | 활동 포인트 |
|--------|------|------|------------|
| `superadmin@codein.test` | superadmin | diamond | 20,000 |
| `admin@codein.test` | admin | platinum | 8,000 |
| `staff@codein.test` | staff | gold | 2,200 |
| `member1@codein.test` | member | silver | 650 |
| `member2@codein.test` | member | bronze | 120 |

### 역할 (Roles)

| 역할 | 레벨 | 설명 |
|------|------|------|
| `guest` | 0 | 비회원 |
| `member` | 1 | 일반 회원 |
| `staff` | 2 | 운영진 |
| `admin` | 3 | 관리자 |
| `superadmin` | 4 | 슈퍼 관리자 |

### 랭크 (Ranks)

| 랭크 | 레벨 | 필요 포인트 |
|------|------|------------|
| `unranked` | 0 | 0 |
| `bronze` | 1 | 100 |
| `silver` | 2 | 500 |
| `gold` | 3 | 2,000 |
| `platinum` | 4 | 5,000 |
| `diamond` | 5 | 10,000 |

## API 확인

- 개발용 Swagger: `http://localhost:8000/docs`
- 배포용 Swagger: `http://localhost/docs`

주요 라우터:

- `/api/v1/auth`
- `/api/v1/codetest`
- `/api/v1/boards`
- `/api/v1/comments`
- `/api/v1/gallery`
- `/api/v1/events`
- `/api/v1/notifications`
- `/api/v1/reports`
- `/api/v1/search`
- `/api/v1/admin`

## 코딩테스트 샌드박스

지원 언어 및 이미지:

| 언어 | Docker 이미지 | 실행 방식 |
|------|--------------|----------|
| Python 3.11 | `python:3.11-alpine` | inline |
| Node.js 18 | `node:18-alpine` | inline |
| Java 17 | `eclipse-temurin:17-jdk` | file (컴파일) |
| C++ (GCC 13) | `gcc:13` | file (컴파일) |

이미지 풀:

```bash
cd backend
bash scripts/pull_images.sh
```

## 스크립트

- `scripts/pull_images.sh`: 코드 실행용 Docker 이미지 풀
- `scripts/create_sample_problems.py`: 샘플 문제/테스트케이스 생성

## 트러블슈팅

### 코딩테스트 채점 타임아웃

```bash
docker-compose config | grep docker.sock
docker-compose restart backend
```

### Docker 이미지 없음 오류

```bash
cd backend
bash scripts/pull_images.sh
docker images | grep -E "python|node|eclipse"
```
