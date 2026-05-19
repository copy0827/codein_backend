"""
ActivityLog model - Tracks all user activity for points and history.
"""

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from app.models.base import Base


class ActivityLog(Base):
    """
    Records of user activities that earn points.

    Activity types:
    - post_create: Created a new post
    - post_delete: Post was deleted (negative points)
    - comment_create: Created a new comment
    - comment_delete: Comment was deleted (negative points)
    - event_attend: Attended an event
    - event_checkin: Checked in to an event (QR)
    - album_create: Created a new album
    - photo_upload: Uploaded photos to album
    - codetest_submit: Submitted a coding test solution
    - codetest_pass: Passed a coding test problem
    - daily_login: Daily login bonus
    - streak_bonus: Streak bonus (consecutive daily logins)
    - rank_up: Promoted to new rank (no points, just record)
    - admin_grant: Admin manually granted points
    - admin_deduct: Admin manually deducted points
    """

    __tablename__ = "activity_logs"

    __table_args__ = (
        Index("ix_activity_logs_user_created", "user_id", "created_at"),
        Index("ix_activity_logs_type", "activity_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Activity details
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reference to related entity (post_id, comment_id, event_id, etc.)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Points balance after this activity
    balance_after: Mapped[int] = mapped_column(Integer, default=0)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Seoul")), nullable=False
    )


# Point values for different activities
ACTIVITY_POINTS = {
    "post_create": 10,
    "post_delete": -10,
    "comment_create": 3,
    "comment_delete": -3,
    "event_attend": 20,
    "event_cancel": -20,
    "event_checkin": 30,
    "album_create": 5,
    "photo_upload": 2,
    "codetest_submit": 5,
    "codetest_pass": 50,
    "daily_login": 5,
    "streak_bonus_7": 20,  # 7-day streak
    "streak_bonus_30": 100,  # 30-day streak
    "rank_up": 0,
    "admin_grant": 0,  # Variable, set manually
    "admin_deduct": 0,  # Variable, set manually
}

ACTIVITY_DESCRIPTIONS = {
    "post_create": "게시글 작성",
    "post_delete": "게시글 삭제",
    "comment_create": "댓글 작성",
    "comment_delete": "댓글 삭제",
    "event_attend": "이벤트 참가",
    "event_cancel": "이벤트 참가 취소",
    "event_checkin": "이벤트 체크인",
    "album_create": "앨범 생성",
    "photo_upload": "사진 업로드",
    "codetest_submit": "코딩테스트 제출",
    "codetest_pass": "코딩테스트 통과",
    "daily_login": "일일 로그인",
    "streak_bonus_7": "7일 연속 출석",
    "streak_bonus_30": "30일 연속 출석",
    "rank_up": "등급 승격",
    "admin_grant": "관리자 포인트 지급",
    "admin_deduct": "관리자 포인트 차감",
}
