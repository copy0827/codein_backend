"""add case1 project/blog fields to posts

Revision ID: c4e8a1b2d3f0
Revises: b5594514de8c
Create Date: 2026-05-20 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import (
    add_column_if_not_exists,
    create_index_if_not_exists,
    drop_column_if_exists,
    drop_index_if_exists,
)

revision: str = "c4e8a1b2d3f0"
down_revision: Union[str, None] = "b5594514de8c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    add_column_if_not_exists("posts", sa.Column("board_type", sa.String(), nullable=True))
    add_column_if_not_exists("posts", sa.Column("tech_stack", sa.Text(), nullable=True))
    add_column_if_not_exists("posts", sa.Column("period", sa.String(), nullable=True))
    add_column_if_not_exists("posts", sa.Column("github_url", sa.String(), nullable=True))
    add_column_if_not_exists("posts", sa.Column("team_info", sa.Text(), nullable=True))
    add_column_if_not_exists("posts", sa.Column("category", sa.String(), nullable=True))
    add_column_if_not_exists(
        "posts",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    create_index_if_not_exists("ix_posts_board_type", "posts", ["board_type"])
    create_index_if_not_exists("ix_posts_category", "posts", ["category"])


def downgrade() -> None:
    drop_index_if_exists("ix_posts_category", "posts")
    drop_index_if_exists("ix_posts_board_type", "posts")
    drop_column_if_exists("posts", "is_published")
    drop_column_if_exists("posts", "category")
    drop_column_if_exists("posts", "team_info")
    drop_column_if_exists("posts", "github_url")
    drop_column_if_exists("posts", "period")
    drop_column_if_exists("posts", "tech_stack")
    drop_column_if_exists("posts", "board_type")
