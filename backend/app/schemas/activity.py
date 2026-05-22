"""
활동 모집 게시판 및 멘토-멘티 연동 — Pydantic v2 스키마.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.activity_recruitment import (
    ApplicationStatus,
    RecruitmentStatus,
    RecruitmentType,
)
from app.schemas.user import UserSummary

RecruitmentTypeLiteral = Literal["STUDY", "PROJECT", "CONTEST", "MENTORING"]
RecruitmentStatusLiteral = Literal["RECRUITING", "CLOSED", "COMPLETED"]
ApplicationStatusLiteral = Literal["PENDING", "APPROVED", "REJECTED"]


class MentoringAdditionalInfo(BaseModel):
    """MENTORING 유형 additional_info."""

    mentoring_field: Optional[str] = Field(None, description="멘토링 분야")
    mentor_intro: Optional[str] = Field(None, description="멘토 소개")


class ProjectTeamMemberInfo(BaseModel):
    """프로젝트 팀원 한 명."""

    name: str
    role: Optional[str] = None
    contact: Optional[str] = None


class ProjectAdditionalInfo(BaseModel):
    """PROJECT 유형 additional_info."""

    team_members: List[ProjectTeamMemberInfo] = Field(default_factory=list)


class ActivityCreate(BaseModel):
    """활동 모집글 생성."""

    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    recruitment_type: RecruitmentTypeLiteral
    max_participants: int = Field(..., ge=1)
    deadline: datetime
    activity_period: str = Field(..., min_length=1, max_length=255)
    tech_stacks: Optional[List[str]] = None
    additional_info: Optional[dict[str, Any]] = Field(
        None,
        description="MENTORING(멘토링 분야·소개) / PROJECT(팀원 정보) 등 유형별 메타",
    )
    recruitment_status: RecruitmentStatusLiteral = "RECRUITING"
    is_approved: Optional[bool] = Field(
        None,
        description="미지정 시 MENTORING=False, 그 외 True",
    )

    @field_validator("recruitment_type", mode="before")
    @classmethod
    def coerce_recruitment_type(cls, value: Any) -> str:
        if isinstance(value, RecruitmentType):
            return value.value
        return str(value).upper()

    @field_validator("recruitment_status", mode="before")
    @classmethod
    def coerce_recruitment_status(cls, value: Any) -> str:
        if isinstance(value, RecruitmentStatus):
            return value.value
        return str(value).upper()

    @field_validator("deadline", mode="before")
    @classmethod
    def normalize_deadline(cls, value: Any) -> Any:
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class ActivityUpdate(BaseModel):
    """활동 모집글 수정."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    recruitment_type: Optional[RecruitmentTypeLiteral] = None
    recruitment_status: Optional[RecruitmentStatusLiteral] = None
    max_participants: Optional[int] = Field(None, ge=1)
    deadline: Optional[datetime] = None
    activity_period: Optional[str] = Field(None, min_length=1, max_length=255)
    tech_stacks: Optional[List[str]] = None
    additional_info: Optional[dict[str, Any]] = None
    is_approved: Optional[bool] = None

    @field_validator("recruitment_type", "recruitment_status", mode="before")
    @classmethod
    def coerce_enum_strings(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (RecruitmentType, RecruitmentStatus)):
            return value.value
        return str(value).upper()

    @field_validator("deadline", mode="before")
    @classmethod
    def normalize_deadline(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class ActivityResponse(BaseModel):
    """활동 모집글 상세·목록 조회."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    recruitment_type: RecruitmentTypeLiteral
    recruitment_status: RecruitmentStatusLiteral
    max_participants: int
    current_participants: int
    deadline: datetime
    activity_period: str
    tech_stacks: Optional[List[str]] = None
    is_approved: bool
    owner_id: int
    additional_info: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    owner: Optional[UserSummary] = None
    spots_remaining: int = Field(0, description="남은 모집 인원")
    is_full: bool = False
    pending_application_count: int = Field(
        0, description="대기 중 신청 수 (작성자·관리자용 요약)"
    )

    @field_validator("recruitment_type", "recruitment_status", mode="before")
    @classmethod
    def coerce_enum_strings(cls, value: Any) -> str:
        if isinstance(value, (RecruitmentType, RecruitmentStatus)):
            return value.value
        return str(value).upper()

    @field_validator("tech_stacks", mode="before")
    @classmethod
    def normalize_tech_stacks(cls, value: Any) -> Optional[List[str]]:
        if value is None:
            return None
        if isinstance(value, list):
            return [str(item) for item in value]
        return None

    @field_validator("deadline", "created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetimes(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc).astimezone(
                    ZoneInfo("Asia/Seoul")
                )
            return value.astimezone(ZoneInfo("Asia/Seoul"))
        return value


class ActivityListResponse(BaseModel):
    """활동 모집글 목록 (페이지네이션)."""

    items: List[ActivityResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ApplicationCreate(BaseModel):
    """활동 모집 신청."""

    message: str = Field(..., min_length=1)


class ApplicationUpdate(BaseModel):
    """신청 승인/거절 (모집글 작성자 처리)."""

    status: Literal["APPROVED", "REJECTED"]
    process_message: Optional[str] = Field(
        None,
        max_length=2000,
        description="승인·거절 시 작성자 처리 메모 (선택)",
    )

    @field_validator("status", mode="before")
    @classmethod
    def coerce_status(cls, value: Any) -> str:
        if isinstance(value, ApplicationStatus):
            return value.value
        return str(value).upper()


class ApplicationResponse(BaseModel):
    """신청 내역 (신청자 정보 포함)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    activity_id: int
    applicant_id: int
    message: str
    status: ApplicationStatusLiteral
    applied_at: datetime

    applicant: Optional[UserSummary] = None
    activity_title: Optional[str] = Field(None, description="목록·관리 화면용 모집글 제목")
    process_message: Optional[str] = Field(
        None, description="작성자 승인·거절 처리 메모"
    )

    @field_validator("status", mode="before")
    @classmethod
    def coerce_status(cls, value: Any) -> str:
        if isinstance(value, ApplicationStatus):
            return value.value
        return str(value).upper()

    @field_validator("applied_at", mode="before")
    @classmethod
    def normalize_applied_at(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc).astimezone(
                    ZoneInfo("Asia/Seoul")
                )
            return value.astimezone(ZoneInfo("Asia/Seoul"))
        return value


class ApplicationListResponse(BaseModel):
    """신청 목록 (페이지네이션)."""

    items: List[ApplicationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ActivityStatusPatch(BaseModel):
    """모집글 상태 수동 변경 (CLOSED / COMPLETED)."""

    recruitment_status: Literal["CLOSED", "COMPLETED"]

    @field_validator("recruitment_status", mode="before")
    @classmethod
    def coerce_status(cls, value: Any) -> str:
        if isinstance(value, RecruitmentStatus):
            return value.value
        return str(value).upper()
