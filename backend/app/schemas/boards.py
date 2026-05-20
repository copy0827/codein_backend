"""
Case 1: 프로젝트 전시 및 블로그 — Post 기반 요청/응답 스키마.

기존 게시판 관리용 BoardCreate(Board 엔티티)는 app.schemas.board 를 사용합니다.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.board import PostBoardType
from app.schemas.user import UserSummary


def _normalize_json_list(value: Any) -> Optional[List[str]]:
    if value is None:
        return None
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        if not value.strip():
            return None
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [value]
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        return [value]
    return [str(value)]


def _normalize_team_info(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


class BoardCreate(BaseModel):
    """프로젝트 전시 / 블로그 게시글 작성."""

    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    board_type: PostBoardType
    board_id: int = Field(..., description="소속 게시판 ID")
    tech_stack: Optional[List[str]] = None
    period: Optional[str] = Field(None, max_length=200)
    github_url: Optional[str] = Field(None, max_length=500)
    team_info: Optional[Union[str, dict[str, Any], list[Any]]] = None
    category: Optional[str] = Field(None, max_length=100)
    is_published: bool = True

    @field_validator("tech_stack", mode="before")
    @classmethod
    def validate_tech_stack(cls, value: Any) -> Optional[List[str]]:
        return _normalize_json_list(value)

    @field_validator("team_info", mode="before")
    @classmethod
    def validate_team_info(cls, value: Any) -> Optional[str]:
        return _normalize_team_info(value)


class BoardUpdate(BaseModel):
    """프로젝트 전시 / 블로그 게시글 수정."""

    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    board_type: Optional[PostBoardType] = None
    tech_stack: Optional[List[str]] = None
    period: Optional[str] = Field(None, max_length=200)
    github_url: Optional[str] = Field(None, max_length=500)
    team_info: Optional[Union[str, dict[str, Any], list[Any]]] = None
    category: Optional[str] = Field(None, max_length=100)
    is_published: Optional[bool] = None
    is_pinned: Optional[bool] = None
    is_hidden: Optional[bool] = None

    @field_validator("tech_stack", mode="before")
    @classmethod
    def validate_tech_stack(cls, value: Any) -> Optional[List[str]]:
        return _normalize_json_list(value)

    @field_validator("team_info", mode="before")
    @classmethod
    def validate_team_info(cls, value: Any) -> Optional[str]:
        return _normalize_team_info(value)


class BoardCommentAuthor(BaseModel):
    """댓글 작성자 요약 (순환 참조 방지용 경량 스키마)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    profile_image: Optional[str] = None
    rank: str = "unranked"


class BoardCommentItem(BaseModel):
    """상세 조회용 댓글 (대댓글 트리)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    author_id: int
    parent_id: Optional[int] = None
    content: str
    is_blinded: bool = False
    is_deleted: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: Optional[BoardCommentAuthor] = None
    replies: List[BoardCommentItem] = Field(default_factory=list)


class BoardListItem(BaseModel):
    """목록 조회용 게시글 요약."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    board_type: Optional[PostBoardType] = None
    board_id: int
    author_id: int
    views: int = 0
    comment_count: int = 0
    tech_stack: List[str] = Field(default_factory=list)
    has_github: bool = False
    github_url: Optional[str] = None
    category: Optional[str] = None
    period: Optional[str] = None
    is_published: bool = True
    is_pinned: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: Optional[UserSummary] = None

    @field_validator("board_type", mode="before")
    @classmethod
    def coerce_board_type(cls, value: Any) -> Optional[PostBoardType]:
        if value is None or value == "":
            return None
        if isinstance(value, PostBoardType):
            return value
        return PostBoardType(str(value).upper())

    @field_validator("tech_stack", mode="before")
    @classmethod
    def parse_tech_stack(cls, value: Any) -> List[str]:
        return _normalize_json_list(value) or []


class BoardListResponse(BaseModel):
    """목록 API 응답 (페이지네이션 메타데이터 포함)."""

    total: int
    page: int
    size: int
    total_pages: int
    items: List[BoardListItem]


class GitHubCommitItem(BaseModel):
    sha: str
    message: str
    author_name: Optional[str] = None
    committed_at: datetime


class GitHubAuthorCommitStats(BaseModel):
    author: str
    commit_count: int


class BoardGitHubResponse(BaseModel):
    """GitHub 연동 조회 응답."""

    repository_name: str
    description: Optional[str] = None
    last_updated: Optional[datetime] = None
    total_commits: int = 0
    recent_commits: List[GitHubCommitItem] = Field(default_factory=list)
    author_commit_counts: List[GitHubAuthorCommitStats] = Field(default_factory=list)


class BoardDetailResponse(BaseModel):
    """상세 API 응답."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    board_type: Optional[PostBoardType] = None
    board_id: int
    author_id: int
    views: int = 0
    tech_stack: List[str] = Field(default_factory=list)
    period: Optional[str] = None
    github_url: Optional[str] = None
    has_github: bool = False
    team_info: Optional[Union[str, dict[str, Any], list[Any]]] = None
    category: Optional[str] = None
    is_published: bool = True
    is_pinned: bool = False
    is_hidden: bool = False
    is_blinded: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: Optional[UserSummary] = None
    comments: List[BoardCommentItem] = Field(default_factory=list)
    comment_count: int = 0

    @field_validator("board_type", mode="before")
    @classmethod
    def coerce_board_type(cls, value: Any) -> Optional[PostBoardType]:
        if value is None or value == "":
            return None
        if isinstance(value, PostBoardType):
            return value
        return PostBoardType(str(value).upper())

    @field_validator("tech_stack", mode="before")
    @classmethod
    def parse_tech_stack(cls, value: Any) -> List[str]:
        return _normalize_json_list(value) or []

    @field_validator("team_info", mode="before")
    @classmethod
    def parse_team_info(cls, value: Any) -> Optional[Union[str, dict[str, Any], list[Any]]]:
        if value is None or value == "":
            return None
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return value


BoardCommentItem.model_rebuild()


def _comment_to_item(comment: Any, include_replies: bool = True) -> BoardCommentItem:
    author = None
    if getattr(comment, "author", None):
        author = BoardCommentAuthor(
            id=comment.author.id,
            name=comment.author.name,
            profile_image=getattr(comment.author, "profile_image", None),
            rank=getattr(comment.author, "rank", "unranked") or "unranked",
        )
    replies: List[BoardCommentItem] = []
    if include_replies and getattr(comment, "replies", None):
        replies = [
            _comment_to_item(reply, include_replies=True) for reply in comment.replies
        ]
    return BoardCommentItem(
        id=comment.id,
        post_id=comment.post_id,
        author_id=comment.author_id,
        parent_id=comment.parent_id,
        content=comment.content,
        is_blinded=comment.is_blinded,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=author,
        replies=replies,
    )


def post_to_list_item(post: Any, *, comment_count: int = 0) -> BoardListItem:
    """Post ORM → BoardListItem."""
    author = None
    if getattr(post, "author", None):
        author = UserSummary.model_validate(post.author)
    return BoardListItem(
        id=post.id,
        title=post.title,
        board_type=post.board_type,
        board_id=post.board_id,
        author_id=post.author_id,
        views=post.view_count,
        comment_count=comment_count,
        tech_stack=post.tech_stack,
        has_github=bool(post.github_url),
        github_url=post.github_url,
        category=post.category,
        period=post.period,
        is_published=post.is_published,
        is_pinned=post.is_pinned,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author=author,
    )


def post_to_detail_response(
    post: Any,
    *,
    comments: Optional[List[Any]] = None,
    comment_count: int = 0,
) -> BoardDetailResponse:
    """Post ORM → BoardDetailResponse."""
    author = None
    if getattr(post, "author", None):
        author = UserSummary.model_validate(post.author)
    top_level = comments if comments is not None else getattr(post, "comments", [])
    comment_items = [
        _comment_to_item(c)
        for c in top_level
        if getattr(c, "parent_id", None) is None
    ]
    return BoardDetailResponse(
        id=post.id,
        title=post.title,
        content=post.content,
        board_type=post.board_type,
        board_id=post.board_id,
        author_id=post.author_id,
        views=post.view_count,
        tech_stack=post.tech_stack,
        period=post.period,
        github_url=post.github_url,
        has_github=bool(post.github_url),
        team_info=post.team_info,
        category=post.category,
        is_published=post.is_published,
        is_pinned=post.is_pinned,
        is_hidden=post.is_hidden,
        is_blinded=post.is_blinded,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author=author,
        comments=comment_items,
        comment_count=comment_count,
    )


def serialize_post_create_fields(data: BoardCreate) -> dict[str, Any]:
    """BoardCreate → Post 모델 insert용 dict."""
    payload = data.model_dump(exclude_unset=True)
    tech_stack = payload.pop("tech_stack", None)
    team_info = payload.pop("team_info", None)
    board_type = payload.pop("board_type", None)
    if board_type is not None:
        payload["board_type"] = (
            board_type.value if hasattr(board_type, "value") else str(board_type)
        )
    if tech_stack is not None:
        payload["tech_stack"] = json.dumps(tech_stack, ensure_ascii=False)
    if team_info is not None:
        payload["team_info"] = (
            team_info
            if isinstance(team_info, str)
            else json.dumps(team_info, ensure_ascii=False)
        )
    return payload
