"""add user_codetest_stats for Case 2 ranking dashboard

Revision ID: d5f2a8c9e1b0
Revises: c4e8a1b2d3f0
Create Date: 2026-05-22 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5f2a8c9e1b0"
down_revision: Union[str, None] = "c4e8a1b2d3f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_codetest_stats" in inspector.get_table_names():
        return

    op.create_table(
        "user_codetest_stats",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("period_type", sa.String(length=20), nullable=False),
        sa.Column("total_submissions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_submissions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("difficulty_distribution", sa.JSON(), nullable=True),
        sa.Column("last_activity_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_codetest_stats_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "period_type", name="pk_user_codetest_stats"),
    )
    op.create_index(
        "ix_user_codetest_stats_period_type",
        "user_codetest_stats",
        ["period_type"],
        unique=False,
    )
    op.create_index(
        "ix_user_codetest_stats_total_score",
        "user_codetest_stats",
        ["total_score"],
        unique=False,
    )
    op.create_index(
        "ix_user_codetest_stats_correct_rate",
        "user_codetest_stats",
        ["correct_rate"],
        unique=False,
    )
    op.create_index(
        "ix_user_codetest_stats_last_activity",
        "user_codetest_stats",
        ["last_activity_date"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_codetest_stats" not in inspector.get_table_names():
        return

    op.drop_index("ix_user_codetest_stats_last_activity", table_name="user_codetest_stats")
    op.drop_index("ix_user_codetest_stats_correct_rate", table_name="user_codetest_stats")
    op.drop_index("ix_user_codetest_stats_total_score", table_name="user_codetest_stats")
    op.drop_index("ix_user_codetest_stats_period_type", table_name="user_codetest_stats")
    op.drop_table("user_codetest_stats")
