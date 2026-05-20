"""Make activity_logs created_at timezone aware

Revision ID: 40734c3ffdfb
Revises: 737c4c18ca95
Create Date: 2026-03-04 02:22:26.662068

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from migration_utils import has_column

revision = "40734c3ffdfb"
down_revision = "737c4c18ca95"
branch_labels = None
depends_on = None


def _created_at_is_timezone_aware() -> bool:
    if not has_column("activity_logs", "created_at"):
        return True
    bind = op.get_bind()
    row = bind.execute(
        sa.text(
            """
            SELECT data_type, datetime_precision
            FROM information_schema.columns
            WHERE table_name = 'activity_logs' AND column_name = 'created_at'
            """
        )
    ).mappings().first()
    if not row:
        return True
    return row["data_type"] == "timestamp with time zone"


def upgrade():
    if _created_at_is_timezone_aware():
        return
    op.alter_column(
        "activity_logs",
        "created_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )


def downgrade():
    if not _created_at_is_timezone_aware():
        return
    op.alter_column(
        "activity_logs",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )
