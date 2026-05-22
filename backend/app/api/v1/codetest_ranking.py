"""
Case 2: 코딩테스트 랭킹 및 통계 대시보드 API.

- GET /codetest/ranking
- GET /codetest/ranking/stats/{user_id}
- GET /codetest/ranking/widget
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_current_user_optional, get_db
from app.models.user import User
from app.schemas.codetest_ranking import (
    MyPageWidgetResponse,
    RankingListResponse,
    UserStatDetailResponse,
)
from app.services import codetest_ranking_service as ranking_service

router = APIRouter(prefix="/ranking", tags=["codetest-ranking"])


@router.get("", response_model=RankingListResponse)
async def get_codetest_ranking(
    period: str = Query(
        "ALL",
        description="집계 기간: ALL | SEMESTER | MONTH",
    ),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """전체 랭킹 목록 (RANK() Window Function, 비로그인 조회 가능)."""
    return await ranking_service.get_ranking_list(
        db,
        period=period,
        page=page,
        size=size,
        current_user=current_user,
    )


@router.get("/stats/{user_id}", response_model=UserStatDetailResponse)
async def get_codetest_user_stats(
    user_id: int,
    period: str = Query(
        "ALL",
        description="집계 기간: ALL | SEMESTER | MONTH",
    ),
    db: AsyncSession = Depends(get_db),
    _current_user: Optional[User] = Depends(get_current_user_optional),
):
    """특정 부원의 코딩테스트 통계 (타인 조회 가능, 로그인 불필요)."""
    return await ranking_service.get_user_stat_detail(
        db,
        user_id,
        period=period,
    )


@router.get("/widget", response_model=MyPageWidgetResponse)
async def get_codetest_ranking_widget(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """마이페이지 요약 위젯 (이번 달 MONTH 기준, 로그인 필수)."""
    return await ranking_service.get_my_page_widget(db, current_user)
