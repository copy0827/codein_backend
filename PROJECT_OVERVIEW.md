# 프로젝트 개요

CodeIn은 동아리/커뮤니티 운영을 위한 통합 플랫폼입니다. 게시판, 갤러리, 일정, 알림, 신고/블라인드, 코딩테스트 기능을 제공합니다.

- 프론트엔드: React + TypeScript (SPA)
- 백엔드: FastAPI + SQLAlchemy (async)
- 인증: JWT, `access_token`을 `localStorage`에 저장

## 프로젝트 구조

```
codein/
├── backend/     # FastAPI 백엔드
├── frontend/    # React 프론트엔드
├── nginx/       # Nginx 설정
├── media/       # 업로드 파일
├── docker-compose.yml
└── README.md
```

## 회원 유형/랭크

### 역할 (Role)

| 역할 | 의미 | 접근 범위 요약 |
| --- | --- | --- |
| guest | 비회원 | 공개 페이지/공개 콘텐츠 |
| member | 일반 회원 | 로그인 필요 기능 전반 |
| staff | 운영진 | 신고 처리, 공지 생성, 일정 승인 등 운영 기능 |
| admin | 관리자 | 사용자 관리 등 고급 관리 기능 |
| superadmin | 슈퍼관리자 | 시스템 전반 관리 |

### 랭크 (Rank)

활동 포인트 기준으로 랭크가 상승합니다.

| 랭크 | 기준 포인트 |
| --- | --- |
| unranked | 0 |
| bronze | 100 |
| silver | 500 |
| gold | 1500 |
| platinum | 5000 |
| diamond | 15000 |

### 권한 체크 방식

- `require_roles(...)`: 특정 역할만 허용 (예: `admin`, `superadmin`)
- `require_min_role(...)`: 계층형 최소 역할 이상 허용 (예: `staff+`)
- `target_audience`/`target_ranks`: 공지/게시글 노출 대상 제어
- 갤러리 `visibility`: `public`, `members`, `staff`, `private`
- 일정 승인: `staff+`는 자동 승인, 그 외는 `pending`

## 페이지별 정리

### 공개 페이지 (guest 접근 가능)

| 경로 | 화면 | 사용 API | 접근 |
| --- | --- | --- | --- |
| `/login` | 로그인 | `POST /auth/login` | guest |
| `/register` | 회원가입 | `POST /auth/register` | guest |
| `/` | 홈 | `GET /boards/notices`, `GET /events/occurrences`, `GET /dashboard/popular-posts`, `GET /gallery/albums` | guest |
| `/search` | 통합 검색 | `GET /search` | guest (결과는 권한 필터링) |
| `/board` | 게시판 목록 | `GET /boards`, `GET /boards/{boardId}` | guest (공개 게시판만) |
| `/gallery/share/:token` | 공유 앨범 | `GET /gallery/share/{token}` | 공유 링크 보유자 |

### 로그인 필요 페이지 (member+)

| 경로 | 화면 | 사용 API | 접근 |
| --- | --- | --- | --- |
| `/profile` | 프로필/알림 설정 | `GET /profile/me`, `PUT /profile/me/notifications`, `POST /profile/me/image`, `DELETE /profile/me/image`, `GET /activity/me/summary` | member+ |
| `/activity` | 활동 내역 | `GET /activity/me/summary`, `GET /activity/me/history` | member+ |
| `/board/write` | 게시글 작성 | `GET /boards`, `POST /boards/{boardId}`, `POST /boards/{boardId}/posts/{postId}/attachments`, `GET /boards/notices/templates` | member+ (공지 옵션/템플릿은 staff+) |
| `/board/:boardId/post/:postId` | 게시글 상세 | `GET /boards/{boardId}/posts/{postId}`, `POST /boards/{boardId}/posts/{postId}/read`, `GET /boards/{boardId}/posts/{postId}/read-status`, `GET/POST /posts/{postId}/comments`, `PUT/DELETE /comments/{commentId}` | member+ (읽음 현황은 admin+) |
| `/contest` | 코딩테스트 목록 | `GET /codetest/tests` | member+ (프론트 기준) |
| `/contest/:testId` | 코딩테스트 상세 | `GET /codetest/tests/{testId}` | member+ |
| `/contest/:testId/problem/:problemId` | 문제 풀이 | `GET /codetest/tests/{testId}`, `GET /codetest/problems/{problemId}/submissions`, `POST /codetest/problems/{problemId}/submit`, `GET /codetest/languages` | member+ |
| `/practice` | 연습 문제 | `GET /codetest/practice/problems`, `POST /codetest/practice/submit` | member+ |
| `/gallery` | 갤러리 목록/생성 | `GET /gallery/albums`, `POST /gallery/albums` | member+ (staff 전용 앨범 생성은 staff+) |
| `/gallery/:albumId` | 앨범 상세 | `GET /gallery/albums/{albumId}`, `POST /gallery/albums/{albumId}/photos`, `PUT /gallery/albums/{albumId}`, `DELETE /gallery/photos/{photoId}`, `POST /gallery/albums/{albumId}/share`, `GET /gallery/photos/{photoId}` | member+ (업로드/수정은 소유자 조건) |
| `/events` | 일정 목록/생성 | `GET /events/occurrences`, `POST /events/` | member+ (승인은 staff+) |
| `/events/:eventId` | 일정 상세/참석 | `GET /events/{eventId}`, `POST /events/{eventId}/attend`, `DELETE /events/{eventId}/attend`, `POST /events/{eventId}/rsvp`, `GET /events/{eventId}/my-attendance`, `GET /events/{eventId}/attendees`, `PUT /events/{eventId}` | member+ (수정/삭제는 소유자) |
| `/notifications` | 알림 센터 | `GET /notifications`, `GET /notifications/unread/count`, `POST /notifications/read-all`, `POST /notifications/{id}/read`, `DELETE /notifications/{id}`, `GET /notifications/stream` | member+ |
| `/check-in` | 체크인 (준비중) | 없음 | member+ |

### 운영진/관리자 페이지 (staff+)

| 경로 | 화면 | 사용 API | 접근 |
| --- | --- | --- | --- |
| `/admin` | 관리자 대시보드 | `GET /admin/stats`, `GET/POST/PUT/DELETE /boards/notices/templates`, `GET /admin/users`, `GET /admin/users/{id}`, `PATCH /admin/users/{id}` | staff+ (사용자 관리는 admin+) |
| `/admin/reports` | 신고 목록 | `GET /reports`, `GET /reports/stats` | staff+ |
| `/admin/reports/:reportId` | 신고 상세/처리 | `GET /reports/{id}`, `POST /reports/{id}/review`, `POST /reports/{id}/resolve`, `GET /comments/{id}`, `GET /boards/{boardId}/posts/{postId}`, `GET /profile/{id}` | staff+ |

## API 상세

### 인증/회원
- `POST /auth/register` (guest)
- `POST /auth/login` (guest)

### 프로필/설정
- `GET /profile/me` (member+)
- `PUT /profile/me` (member+)
- `GET /profile/me/privacy` (member+)
- `PUT /profile/me/privacy` (member+)
- `GET /profile/me/notifications` (member+)
- `PUT /profile/me/notifications` (member+)
- `GET /profile/me/rank` (member+)
- `GET /profile/me/stats` (member+)
- `POST /profile/me/image` (member+)
- `DELETE /profile/me/image` (member+)
- `GET /profile/{userId}` (public, privacy 설정 반영)
- `GET /profile/{userId}/rank` (public)
- `GET /profile/{userId}/stats` (public, privacy 설정 반영)

### 활동/포인트
- `GET /activity/me/history` (member+)
- `GET /activity/me/summary` (member+)
- `GET /activity/{userId}/history` (public, privacy 설정 반영)
- `POST /activity/admin/grant/{userId}` (admin)

### 게시판/공지
- `GET /boards` (public)
- `GET /boards/{boardId}` 또는 `GET /boards/{boardId}/posts` (public, 접근 대상 필터링)
- `POST /boards/{boardId}` (member+, 공지 생성은 staff+)
- `GET /boards/{boardId}/posts/{postId}` (member+)
- `PUT /boards/{boardId}/posts/{postId}` (작성자 또는 admin)
- `DELETE /boards/{boardId}/posts/{postId}` (작성자 또는 admin)
- `POST /boards/{boardId}/posts/{postId}/attachments` (작성자 또는 staff+)
- `DELETE /boards/{boardId}/posts/{postId}/attachments/{attachmentId}` (작성자 또는 staff+)
- `POST /boards/{boardId}/posts/{postId}/read` (member+)
- `GET /boards/{boardId}/posts/{postId}/read-status` (admin+)
- `GET /boards/notices/templates` (staff+, `include_inactive` 옵션)
- `POST /boards/notices/templates` (staff+)
- `PUT /boards/notices/templates/{templateId}` (staff+)
- `DELETE /boards/notices/templates/{templateId}` (staff+)

### 댓글
- `GET /posts/{postId}/comments` (public)
- `POST /posts/{postId}/comments` (member+)
- `GET /comments/{commentId}` (public)
- `PUT /comments/{commentId}` (작성자)
- `DELETE /comments/{commentId}` (작성자)

### 갤러리
- `GET /gallery/albums` (public, visibility 필터링)
- `POST /gallery/albums` (member+, staff 전용 앨범은 staff+)
- `GET /gallery/albums/{albumId}` (visibility 정책 적용)
- `PUT /gallery/albums/{albumId}` (소유자)
- `DELETE /gallery/albums/{albumId}` (소유자)
- `POST /gallery/albums/{albumId}/photos` (소유자 또는 공개 앨범 업로더)
- `GET /gallery/albums/{albumId}/photos` (visibility 정책 적용)
- `GET /gallery/photos/{photoId}` (visibility 정책 적용)
- `DELETE /gallery/photos/{photoId}` (업로더/소유자/staff+)
- `POST /gallery/albums/{albumId}/share` (소유자 또는 staff+)
- `GET /gallery/share/{token}` (공유 링크 보유자)

### 일정
- `GET /events` (public, 승인된 일정만)
- `GET /events/occurrences` (public)
- `POST /events` (member+, staff+는 자동 승인)
- `GET /events/{eventId}` (public, 미승인 일정은 소유자/staff+만)
- `PUT /events/{eventId}` (소유자)
- `DELETE /events/{eventId}` (소유자)
- `POST /events/{eventId}/approve` (staff+)
- `POST /events/{eventId}/attend` (member+)
- `DELETE /events/{eventId}/attend` (member+)
- `POST /events/{eventId}/rsvp` (member+)
- `GET /events/{eventId}/my-attendance` (member+)
- `GET /events/{eventId}/attendees` (public)
- `GET /events/{eventId}/waitlist` (public)
- `POST /events/{eventId}/check-in/enable` (소유자)
- `POST /events/{eventId}/check-in/disable` (소유자)
- `GET /events/{eventId}/check-in/code` (소유자)
- `POST /events/{eventId}/check-in` (member+)
- `GET /events/{eventId}/check-in/stats` (소유자)

### 알림
- `GET /notifications` (member+)
- `GET /notifications/unread/count` (member+)
- `POST /notifications/{id}/read` (member+)
- `POST /notifications/read-all` (member+)
- `DELETE /notifications/{id}` (member+)
- `GET /notifications/stream` (member+, SSE)

### 코딩테스트
- `GET /codetest/tests` (public)
- `GET /codetest/tests/{testId}` (public)
- `GET /codetest/languages` (public)
- `GET /codetest/practice/problems` (public)
- `POST /codetest/practice/submit` (member+)
- `GET /codetest/submissions` (member+)
- `GET /codetest/problems/{problemId}/submissions` (member+)
- `POST /codetest/problems/{problemId}/submit` (member+)
- `GET/POST/PUT/DELETE /codetest/problem-bank` 및 하위 테스트케이스 (admin+)
- `POST /codetest/tests` (admin+)
- `POST /codetest/tests/{testId}/problems` (admin+)
- `POST /codetest/tests/{testId}/problems/from-bank` (admin+)
- `GET /codetest/problems/{problemId}` (admin+)
- `POST/PUT/DELETE /codetest/problems/{problemId}/testcases` (admin+)

### 신고/모더레이션
- `POST /reports` (member+)
- `GET /reports` (staff+)
- `GET /reports/{reportId}` (staff+)
- `POST /reports/{reportId}/review` (staff+)
- `POST /reports/{reportId}/resolve` (staff+)
- `GET /reports/stats` (staff+)

### 검색
- `GET /search` (public, 게시글은 접근 권한 필터링)

### 대시보드
- `GET /dashboard` (public, 로그인 시 사용자 통계 포함)
- `GET /dashboard/activity` (public)
- `GET /dashboard/popular-posts` (public)
- `GET /dashboard/my-summary` (member+)

### 관리자
- `GET /admin/stats` (staff+)
- `GET /admin/users` (admin+)
- `GET /admin/users/{userId}` (admin+)
- `PATCH /admin/users/{userId}` (admin+)

## 권한/정책 참고 사항

- 게시글/공지 노출: `target_audience` 및 `target_ranks` 기준으로 필터링
- 공지 생성: `staff+`만 가능 (`notice_type` 포함)
- 공지 템플릿 관리: `staff+`만 가능 (`/boards/notices/templates`)
- 공지 읽음 현황: `admin+`만 조회 가능 (`GET /boards/{boardId}/posts/{postId}/read-status`)
- 갤러리 업로드: 공개 앨범 또는 소유자만 가능, 사진 삭제는 업로더/소유자/`staff+`
- 일정 생성: 로그인 사용자 가능하나 `staff+`만 자동 승인
- 신고 관리: `staff+`만 조회/처리 가능
- 검색 결과: 게시글은 `target_audience` 기준으로 필터링, 앨범은 `public`만 노출
- 프론트 호출 중 `GET /boards/notices`, `GET/POST/PUT/DELETE /boards/notices/templates`는 백엔드 라우터 구현 위치 추가 확인 필요
