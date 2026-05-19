from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "de7971368f01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("max_attendees", sa.Integer(), nullable=True))
    op.add_column("events", sa.Column("location", sa.String(), nullable=True))
    op.add_column(
        "events",
        sa.Column(
            "is_online",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("events", sa.Column("online_link", sa.String(), nullable=True))
    op.add_column(
        "events",
        sa.Column("registration_deadline", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column(
            "allow_waitlist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "check_in_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "events", sa.Column("check_in_code", sa.String(length=64), nullable=True)
    )
    op.add_column("events", sa.Column("check_in_start", sa.DateTime(), nullable=True))
    op.add_column("events", sa.Column("check_in_end", sa.DateTime(), nullable=True))

    op.add_column(
        "attendance", sa.Column("waitlist_position", sa.Integer(), nullable=True)
    )
    op.add_column(
        "attendance",
        sa.Column(
            "registered_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.add_column("attendance", sa.Column("cancelled_at", sa.DateTime(), nullable=True))
    op.add_column("attendance", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column(
        "attendance", sa.Column("checked_in_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("attendance", "checked_in_at")
    op.drop_column("attendance", "notes")
    op.drop_column("attendance", "cancelled_at")
    op.drop_column("attendance", "registered_at")
    op.drop_column("attendance", "waitlist_position")

    op.drop_column("events", "check_in_end")
    op.drop_column("events", "check_in_start")
    op.drop_column("events", "check_in_code")
    op.drop_column("events", "check_in_enabled")
    op.drop_column("events", "allow_waitlist")
    op.drop_column("events", "registration_deadline")
    op.drop_column("events", "online_link")
    op.drop_column("events", "is_online")
    op.drop_column("events", "location")
    op.drop_column("events", "max_attendees")
