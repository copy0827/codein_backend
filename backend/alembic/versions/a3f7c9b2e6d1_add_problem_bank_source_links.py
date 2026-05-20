import sqlalchemy as sa
from alembic import op

from migration_utils import (
    add_column_if_not_exists,
    create_foreign_key_if_not_exists,
    drop_column_if_exists,
    drop_foreign_key_if_exists,
)

revision = "a3f7c9b2e6d1"
down_revision = "51feb0521647"
branch_labels = None
depends_on = None


def upgrade():
    add_column_if_not_exists(
        "problems", sa.Column("source_problem_bank_id", sa.Integer(), nullable=True)
    )
    add_column_if_not_exists(
        "test_cases",
        sa.Column("source_problem_bank_test_case_id", sa.Integer(), nullable=True),
    )
    create_foreign_key_if_not_exists(
        "problems_source_problem_bank_id_fkey",
        "problems",
        "problem_bank",
        ["source_problem_bank_id"],
        ["id"],
    )
    create_foreign_key_if_not_exists(
        "test_cases_source_problem_bank_test_case_id_fkey",
        "test_cases",
        "problem_bank_test_cases",
        ["source_problem_bank_test_case_id"],
        ["id"],
    )


def downgrade():
    drop_foreign_key_if_exists(
        "test_cases_source_problem_bank_test_case_id_fkey",
        "test_cases",
    )
    drop_foreign_key_if_exists(
        "problems_source_problem_bank_id_fkey",
        "problems",
    )
    drop_column_if_exists("test_cases", "source_problem_bank_test_case_id")
    drop_column_if_exists("problems", "source_problem_bank_id")
