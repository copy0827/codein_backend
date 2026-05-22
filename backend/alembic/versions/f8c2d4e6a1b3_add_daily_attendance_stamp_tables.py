"""add daily_attendances user_attendance_stats attendance_policies

Revision ID: f8c2d4e6a1b3
Revises: e7a3b1c4d902
Create Date: 2026-05-21 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f8c2d4e6a1b3"
down_revision: Union[str, None] = "e7a3b1c4d902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "attendance_policies" not in inspector.get_table_names():
        op.create_table(
            "attendance_policies",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("max_stamp_pieces", sa.Integer(), nullable=False, server_default="10"),
            sa.Column(
                "daily_attendance_points",
                sa.Integer(),
                nullable=False,
                server_default="10",
            ),
            sa.Column(
                "board_complete_reward_points",
                sa.Integer(),
                nullable=False,
                server_default="100",
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=True,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.execute(
            sa.text(
                """
                INSERT INTO attendance_policies (
                    id, max_stamp_pieces, daily_attendance_points,
                    board_complete_reward_points
                )
                VALUES (1, 10, 10, 100)
                ON CONFLICT (id) DO NOTHING
                """
            )
        )

    if "user_attendance_stats" not in inspector.get_table_names():
        op.create_table(
            "user_attendance_stats",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("total_attendance_days", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("current_streak_days", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("current_stamp_cycle", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("current_stamp_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "completed_stamp_boards",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_user_attendance_stats_user_id",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if "daily_attendances" not in inspector.get_table_names():
        op.create_table(
            "daily_attendances",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("attendance_date", sa.Date(), nullable=False),
            sa.Column(
                "attended_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("earned_points", sa.Integer(), nullable=False, server_default="0"),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_daily_attendances_user_id",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "attendance_date",
                name="uq_daily_attendances_user_date",
            ),
        )
        op.create_index(
            "ix_daily_attendances_user_id",
            "daily_attendances",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_daily_attendances_attendance_date",
            "daily_attendances",
            ["attendance_date"],
            unique=False,
        )
        op.create_index(
            "ix_daily_attendances_user_date",
            "daily_attendances",
            ["user_id", "attendance_date"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_daily_attendances_user_date", table_name="daily_attendances")
    op.drop_index("ix_daily_attendances_attendance_date", table_name="daily_attendances")
    op.drop_index("ix_daily_attendances_user_id", table_name="daily_attendances")
    op.drop_table("daily_attendances")
    op.drop_table("user_attendance_stats")
    op.drop_table("attendance_policies")
