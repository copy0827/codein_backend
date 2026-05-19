"""
Permission system for CodeIn platform.

Defines roles, ranks, and access control levels for the application.
"""

from enum import IntEnum
from typing import List, Optional


class Role(IntEnum):
    """
    User roles with hierarchical permission levels.
    Higher number = more permissions.

    비회원 (guest): Can only view public content
    회원 (member): Regular member, can access member-only content
    운영진 (staff): Can manage content, events, and basic moderation
    관리자 (admin): Full management access except system settings
    슈퍼관리자 (superadmin): Full system access including user management
    """

    GUEST = 0
    MEMBER = 1
    STAFF = 2
    ADMIN = 3
    SUPERADMIN = 4


class Rank(IntEnum):
    """
    User ranks based on coding test results and activity.
    Used for matchmaking in studies and events.
    """

    UNRANKED = 0
    BRONZE = 1
    SILVER = 2
    GOLD = 3
    PLATINUM = 4
    DIAMOND = 5


# String to enum mappings
ROLE_MAP = {
    "guest": Role.GUEST,
    "member": Role.MEMBER,
    "staff": Role.STAFF,
    "admin": Role.ADMIN,
    "superadmin": Role.SUPERADMIN,
}

RANK_MAP = {
    "unranked": Rank.UNRANKED,
    "bronze": Rank.BRONZE,
    "silver": Rank.SILVER,
    "gold": Rank.GOLD,
    "platinum": Rank.PLATINUM,
    "diamond": Rank.DIAMOND,
}

# Reverse mappings
ROLE_NAMES = {v: k for k, v in ROLE_MAP.items()}
RANK_NAMES = {v: k for k, v in RANK_MAP.items()}


def get_role_level(role: str) -> int:
    """Convert role string to permission level."""
    return ROLE_MAP.get(role, Role.GUEST).value


def get_rank_level(rank: str) -> int:
    """Convert rank string to rank level."""
    return RANK_MAP.get(rank, Rank.UNRANKED).value


def has_role(user_role: str, required_role: str) -> bool:
    """
    Check if user has at least the required role.
    Uses hierarchical comparison (higher role includes lower permissions).
    """
    return get_role_level(user_role) >= get_role_level(required_role)


def has_any_role(user_role: str, allowed_roles: List[str]) -> bool:
    """
    Check if user's role is in the allowed list.
    Non-hierarchical - exact match only.
    """
    return user_role in allowed_roles


def has_rank(user_rank: str, required_rank: str) -> bool:
    """
    Check if user has at least the required rank.
    """
    return get_rank_level(user_rank) >= get_rank_level(required_rank)


def can_access_content(
    user_role: str,
    user_rank: str,
    target_audience: str,
) -> bool:
    """
    Check if user can access content based on target audience setting.

    Target audience formats:
    - "all": Everyone can access (including guests)
    - "members": Members and above
    - "staff": Staff and above
    - "admin": Admin and above
    - "rank:bronze": Members with bronze rank or higher
    - "rank:gold,staff": Gold rank OR staff role
    """
    if target_audience == "all":
        return True

    if target_audience == "members":
        return has_role(user_role, "member")

    if target_audience == "staff":
        return has_role(user_role, "staff")

    if target_audience == "admin":
        return has_role(user_role, "admin")

    # Handle rank-based access
    if target_audience.startswith("rank:"):
        conditions = target_audience[5:].split(",")
        for condition in conditions:
            condition = condition.strip()
            # Check if it's a role
            if condition in ROLE_MAP:
                if has_role(user_role, condition):
                    return True
            # Check if it's a rank
            elif condition in RANK_MAP:
                if has_rank(user_rank, condition) and has_role(user_role, "member"):
                    return True
        return False

    return False


def can_access_target_audience(
    user_role: str,
    user_rank: str,
    target_audience: Optional[str],
    target_ranks: Optional[str],
) -> bool:
    if not target_audience or target_audience == "all":
        return True

    if target_audience == "members":
        return has_role(user_role, "member")

    if target_audience == "staff":
        return has_role(user_role, "staff")

    if target_audience in {"admin", "admins"}:
        return has_role(user_role, "admin")

    if target_audience == "specific_ranks":
        if not target_ranks:
            return True
        target_list = [rank.strip() for rank in target_ranks.split(",") if rank.strip()]
        return user_rank in target_list

    return False


# Permission constants for common operations
class Permissions:
    """Common permission requirements for various operations."""

    # Content viewing
    VIEW_PUBLIC = "guest"
    VIEW_MEMBER_ONLY = "member"
    VIEW_STAFF_ONLY = "staff"

    # Content creation
    CREATE_POST = "member"
    CREATE_NOTICE = "staff"
    CREATE_IMPORTANT_NOTICE = "admin"
    CREATE_EVENT = "staff"
    CREATE_ALBUM = "staff"

    # Content management
    EDIT_OWN_CONTENT = "member"
    EDIT_ANY_CONTENT = "staff"
    DELETE_OWN_CONTENT = "member"
    DELETE_ANY_CONTENT = "staff"
    PIN_CONTENT = "staff"
    BLIND_CONTENT = "staff"

    # Moderation
    VIEW_REPORTS = "staff"
    HANDLE_REPORTS = "staff"
    SUSPEND_USER = "admin"
    BAN_USER = "admin"

    # User management
    CHANGE_USER_ROLE = "admin"
    CHANGE_USER_RANK = "admin"
    VIEW_ALL_USERS = "staff"

    # Coding test
    CREATE_TEST = "admin"
    CREATE_PROBLEM = "admin"
    VIEW_SUBMISSIONS = "staff"
    MANUAL_GRADE = "staff"

    # System
    VIEW_ADMIN_DASHBOARD = "staff"
    MANAGE_SYSTEM_SETTINGS = "superadmin"


# Notification types that users can configure
NOTIFICATION_TYPES = [
    "comment",  # 댓글 알림
    "answer",  # Q&A 답변 알림
    "answer_accepted",  # 답변 채택 알림
    "notice",  # 공지사항 알림
    "event_change",  # 일정 변경 알림
    "event_reminder",  # 일정 리마인더
    "codetest_notice",  # 코딩테스트 공지 알림
    "codetest_result",  # 코딩테스트 결과 알림
    "rank_change",  # 랭크 변경 알림
    "mention",  # 멘션 알림
]


# Activity point rules
ACTIVITY_POINTS = {
    "post_create": 10,
    "comment_create": 3,
    "answer_create": 5,
    "answer_accepted": 20,
    "event_attend": 20,
    "event_cancel": -20,
    "event_checkin": 5,
    "codetest_submit": 10,
    "codetest_pass": 30,
}
