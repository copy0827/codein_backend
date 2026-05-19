from alembic import op
import sqlalchemy as sa

revision = "6b838ff8246e"
down_revision = "a3f7c9b2e6d1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "reports", sa.Column("review_started_by_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "reports", sa.Column("review_started_at", sa.DateTime(), nullable=True)
    )
    op.create_foreign_key(None, "reports", "users", ["review_started_by_id"], ["id"])


def downgrade():
    op.drop_constraint(None, "reports", type_="foreignkey")
    op.drop_column("reports", "review_started_at")
    op.drop_column("reports", "review_started_by_id")
