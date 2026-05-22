"""add activity_recruitments and activity_applications

Revision ID: e7a3b1c4d902
Revises: d5f2a8c9e1b0
Create Date: 2026-05-20 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7a3b1c4d902"
down_revision: Union[str, None] = "d5f2a8c9e1b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "activity_recruitments" in inspector.get_table_names():
        return

    op.create_table(
        "activity_recruitments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("recruitment_type", sa.String(length=20), nullable=False),
        sa.Column(
            "recruitment_status",
            sa.String(length=20),
            nullable=False,
            server_default="RECRUITING",
        ),
        sa.Column("max_participants", sa.Integer(), nullable=False),
        sa.Column(
            "current_participants",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activity_period", sa.String(length=255), nullable=False),
        sa.Column("tech_stacks", sa.JSON(), nullable=True),
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("additional_info", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name="fk_activity_recruitments_owner_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_activity_recruitments_type",
        "activity_recruitments",
        ["recruitment_type"],
        unique=False,
    )
    op.create_index(
        "ix_activity_recruitments_status",
        "activity_recruitments",
        ["recruitment_status"],
        unique=False,
    )
    op.create_index(
        "ix_activity_recruitments_owner",
        "activity_recruitments",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        "ix_activity_recruitments_approved",
        "activity_recruitments",
        ["is_approved"],
        unique=False,
    )
    op.create_index(
        "ix_activity_recruitments_deadline",
        "activity_recruitments",
        ["deadline"],
        unique=False,
    )

    op.create_table(
        "activity_applications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("applicant_id", sa.Integer(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "applied_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["activity_id"],
            ["activity_recruitments.id"],
            name="fk_activity_applications_activity_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["applicant_id"],
            ["users.id"],
            name="fk_activity_applications_applicant_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "activity_id",
            "applicant_id",
            name="uq_activity_applications_activity_applicant",
        ),
    )
    op.create_index(
        "ix_activity_applications_activity",
        "activity_applications",
        ["activity_id"],
        unique=False,
    )
    op.create_index(
        "ix_activity_applications_applicant",
        "activity_applications",
        ["applicant_id"],
        unique=False,
    )
    op.create_index(
        "ix_activity_applications_status",
        "activity_applications",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_activity_applications_status", table_name="activity_applications")
    op.drop_index("ix_activity_applications_applicant", table_name="activity_applications")
    op.drop_index("ix_activity_applications_activity", table_name="activity_applications")
    op.drop_table("activity_applications")

    op.drop_index("ix_activity_recruitments_deadline", table_name="activity_recruitments")
    op.drop_index("ix_activity_recruitments_approved", table_name="activity_recruitments")
    op.drop_index("ix_activity_recruitments_owner", table_name="activity_recruitments")
    op.drop_index("ix_activity_recruitments_status", table_name="activity_recruitments")
    op.drop_index("ix_activity_recruitments_type", table_name="activity_recruitments")
    op.drop_table("activity_recruitments")
