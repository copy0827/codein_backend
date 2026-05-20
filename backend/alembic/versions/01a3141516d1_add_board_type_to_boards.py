"""add board_type to boards

Revision ID: 01a3141516d1
Revises: 6b838ff8246e
Create Date: 2026-02-08 17:11:28.176024

"""

import sqlalchemy as sa
from alembic import op

from migration_utils import add_column_if_not_exists, drop_column_if_exists, has_column

revision = "01a3141516d1"
down_revision = "6b838ff8246e"
branch_labels = None
depends_on = None


def upgrade():
    add_column_if_not_exists("boards", sa.Column("board_type", sa.String(), nullable=True))
    if has_column("boards", "board_type"):
        op.execute("UPDATE boards SET board_type='general' WHERE name='자유게시판' AND board_type IS NULL")
        op.execute("UPDATE boards SET board_type='qna' WHERE name='Q&A' AND board_type IS NULL")
        op.execute("UPDATE boards SET board_type='notice' WHERE name='공지사항' AND board_type IS NULL")


def downgrade():
    drop_column_if_exists("boards", "board_type")
