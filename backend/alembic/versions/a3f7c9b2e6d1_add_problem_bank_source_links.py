from alembic import op
import sqlalchemy as sa

revision = "a3f7c9b2e6d1"
down_revision = "51feb0521647"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "problems", sa.Column("source_problem_bank_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "test_cases",
        sa.Column("source_problem_bank_test_case_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "problems_source_problem_bank_id_fkey",
        "problems",
        "problem_bank",
        ["source_problem_bank_id"],
        ["id"],
    )
    op.create_foreign_key(
        "test_cases_source_problem_bank_test_case_id_fkey",
        "test_cases",
        "problem_bank_test_cases",
        ["source_problem_bank_test_case_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint(
        "test_cases_source_problem_bank_test_case_id_fkey",
        "test_cases",
        type_="foreignkey",
    )
    op.drop_constraint(
        "problems_source_problem_bank_id_fkey",
        "problems",
        type_="foreignkey",
    )
    op.drop_column("test_cases", "source_problem_bank_test_case_id")
    op.drop_column("problems", "source_problem_bank_id")
