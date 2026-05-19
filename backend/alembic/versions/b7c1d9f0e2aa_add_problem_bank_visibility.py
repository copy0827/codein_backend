from alembic import op
from alembic import op
import sqlalchemy as sa

revision = "b7c1d9f0e2aa"
down_revision = "a3f7c9b2e6d1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "problem_bank",
        sa.Column(
            "is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )


def downgrade():
    op.drop_column("problem_bank", "is_public")
