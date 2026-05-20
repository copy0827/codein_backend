"""add event attendance rsvp columns

Revision ID: de7971368f01
Revises:
Create Date: 2026-01-28 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import add_column_if_not_exists, drop_column_if_exists

revision: str = "de7971368f01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    add_column_if_not_exists(
        "events", sa.Column("max_attendees", sa.Integer(), nullable=True)
    )
    add_column_if_not_exists(
        "events", sa.Column("location", sa.String(), nullable=True)
    )
    add_column_if_not_exists(
        "events",
        sa.Column(
            "is_online",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    add_column_if_not_exists(
        "events", sa.Column("online_link", sa.String(), nullable=True)
    )
    add_column_if_not_exists(
        "events",
        sa.Column("registration_deadline", sa.DateTime(), nullable=True),
    )
    add_column_if_not_exists(
        "events",
        sa.Column(
            "allow_waitlist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    add_column_if_not_exists(
        "events",
        sa.Column(
            "check_in_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    add_column_if_not_exists(
        "events",
        sa.Column("check_in_code", sa.String(length=64), nullable=True),
    )
    add_column_if_not_exists(
        "events", sa.Column("check_in_start", sa.DateTime(), nullable=True)
    )
    add_column_if_not_exists(
        "events", sa.Column("check_in_end", sa.DateTime(), nullable=True)
    )

    add_column_if_not_exists(
        "attendance",
        sa.Column("waitlist_position", sa.Integer(), nullable=True),
    )
    add_column_if_not_exists(
        "attendance",
        sa.Column(
            "registered_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    add_column_if_not_exists(
        "attendance", sa.Column("cancelled_at", sa.DateTime(), nullable=True)
    )
    add_column_if_not_exists(
        "attendance", sa.Column("notes", sa.Text(), nullable=True)
    )
    add_column_if_not_exists(
        "attendance", sa.Column("checked_in_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    drop_column_if_exists("attendance", "checked_in_at")
    drop_column_if_exists("attendance", "notes")
    drop_column_if_exists("attendance", "cancelled_at")
    drop_column_if_exists("attendance", "registered_at")
    drop_column_if_exists("attendance", "waitlist_position")

    drop_column_if_exists("events", "check_in_end")
    drop_column_if_exists("events", "check_in_start")
    drop_column_if_exists("events", "check_in_code")
    drop_column_if_exists("events", "check_in_enabled")
    drop_column_if_exists("events", "allow_waitlist")
    drop_column_if_exists("events", "registration_deadline")
    drop_column_if_exists("events", "online_link")
    drop_column_if_exists("events", "is_online")
    drop_column_if_exists("events", "location")
    drop_column_if_exists("events", "max_attendees")
