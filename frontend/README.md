# CodeIn Frontend

## 역할

CodeIn 프론트엔드는 React + Vite 기반의 SPA입니다. React Router로 라우팅을 구성하고 Tailwind CSS로 스타일을 관리합니다.

## 개발 및 빌드

```bash
cd frontend
npm install

# 개발 서버 (기본 5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

테스트 실행:

```bash
npm run test
npm run test:watch
```

## 빌드 산출물

- `dist/`: Nginx에서 정적 파일로 서빙되는 결과물

## 디렉터리 구조

```
frontend/
├── src/
│   ├── api/        # API 호출 모듈
│   ├── components/ # 공통 컴포넌트
│   ├── context/    # 전역 상태/인증 컨텍스트
│   ├── hooks/      # 커스텀 훅
│   ├── pages/      # 라우팅 페이지
│   ├── types/      # 타입 정의
│   ├── App.tsx     # 라우팅/레이아웃
│   └── main.tsx    # 엔트리 포인트
├── index.html
└── vite.config.mjs
```

## 라우팅

라우팅은 `src/App.tsx`에서 정의합니다.

- Public: `/`, `/search`, `/board`, `/gallery/share/:token`
- Protected: `/profile`, `/activity`, `/board/write`, `/contest`, `/practice`, `/gallery`, `/events`, `/notifications`
- Admin: `/admin`, `/admin/codetest`, `/admin/problem-bank`, `/admin/reports`
