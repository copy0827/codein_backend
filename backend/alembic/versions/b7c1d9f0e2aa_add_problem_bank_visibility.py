import sqlalchemy as sa
from alembic import op

from migration_utils import add_column_if_not_exists, drop_column_if_exists

revision = "b7c1d9f0e2aa"
down_revision = "a3f7c9b2e6d1"
branch_labels = None
depends_on = None


def upgrade():
    add_column_if_not_exists(
        "problem_bank",
        sa.Column(
            "is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )


def downgrade():
    drop_column_if_exists("problem_bank", "is_public")
