"""
Shared service for computing user ranks and points.
"""

from typing import Optional


# Rank thresholds (points required for each rank)
RANK_THRESHOLDS = {
    "unranked": 0,
    "bronze": 100,
    "silver": 500,
    "gold": 1500,
    "platinum": 5000,
    "diamond": 15000,
}

RANK_ORDER = ["unranked", "bronze", "silver", "gold", "platinum", "diamond"]


def get_rank_for_points(points: int) -> str:
    """Determine rank based on points."""
    for rank in reversed(RANK_ORDER):
        if points >= RANK_THRESHOLDS[rank]:
            return rank
    return "unranked"


def get_next_rank(current_rank: str) -> Optional[str]:
    """Get the next rank after current rank."""
    try:
        idx = RANK_ORDER.index(current_rank)
        if idx < len(RANK_ORDER) - 1:
            return RANK_ORDER[idx + 1]
    except ValueError:
        pass
    return None
