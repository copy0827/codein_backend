# Production Deployment Guide

## 1. Server Requirements
- Ubuntu 22.04+
- Docker & Docker Compose
- Domain name pointing to server IP

## 2. Setup
```bash
git clone <your-repo> /var/www/codein
cd /var/www/codein
cp backend/.env.example backend/.env

docker-compose build nginx
docker-compose up -d postgres backend nginx
```

## 빠른 시작 (Docker Compose)

### 환경 변수

프로젝트 루트에 `.env`를 생성합니다.

```env
DATABASE_URL=postgresql+asyncpg://codein:codein@postgres:5432/codein
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
CORS_ORIGINS=["*"]
APP_NAME=CodeIn
```

### 서비스 실행

```bash
# 프론트 빌드 (배포용)
cd frontend
npm install
npm run build
cd ..

# Docker 이미지 빌드
docker-compose build

# 서비스 실행
docker-compose up -d postgres backend nginx

# (선택) 코드 실행용 Docker 이미지 풀
cd backend && bash scripts/pull_images.sh
```

### 접속 확인

| 환경 | 서비스 | URL |
|------|--------|-----|
| 배포용 | 프론트엔드 | http://localhost |
| 배포용 | API 문서 (Swagger) | http://localhost/docs |
| 배포용 | 헬스체크 | http://localhost/health |
| 개발용 | 프론트엔드 (Vite) | http://localhost:5173 |
| 개발용 | 백엔드 | http://localhost:8000 |
| 개발용 | API 문서 (Swagger) | http://localhost:8000/docs |

### Local dev domain mapping (nginx 확인용)
nginx는 `server_name webserver2.codein.kr`로 구성되어 있으므로 로컬에서 확인하려면 hosts 매핑이 필요합니다.

```bash
# macOS/Linux
sudo sh -c "echo '127.0.0.1 webserver2.codein.kr' >> /etc/hosts"
```

이후 `http://webserver2.codein.kr`로 접속하세요.

### Frontend build vs data updates
- 프론트 코드 변경: `docker-compose build nginx && docker-compose up -d nginx`
- 게시판 글/공지/코딩테스트/문제 등 데이터 변경: 즉시 반영 (재빌드 불필요)

## 3. SSL (First Run)
```bash
docker-compose run --rm certbot certonly --webroot -w /var/www/certbot   -d example.com -d www.example.com   --email admin@example.com --agree-tos --no-eff-email
docker-compose restart nginx
```

## 4. GitHub Secrets
- SERVER_HOST
- SERVER_USER
- SERVER_SSH_KEY

Push to `main` to auto-deploy 🚀
