import sqlalchemy as sa
from alembic import op

from migration_utils import (
    add_column_if_not_exists,
    create_foreign_key_if_not_exists,
    drop_column_if_exists,
    drop_foreign_key_if_exists,
)

revision = "6b838ff8246e"
down_revision = "a3f7c9b2e6d1"
branch_labels = None
depends_on = None


def upgrade():
    add_column_if_not_exists(
        "reports", sa.Column("review_started_by_id", sa.Integer(), nullable=True)
    )
    add_column_if_not_exists(
        "reports", sa.Column("review_started_at", sa.DateTime(), nullable=True)
    )
    create_foreign_key_if_not_exists(
        "reports_review_started_by_id_fkey",
        "reports",
        "users",
        ["review_started_by_id"],
        ["id"],
    )


def downgrade():
    drop_foreign_key_if_exists("reports_review_started_by_id_fkey", "reports")
    drop_column_if_exists("reports", "review_started_at")
    drop_column_if_exists("reports", "review_started_by_id")
