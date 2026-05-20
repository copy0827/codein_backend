"""add photo metadata columns

Revision ID: 51feb0521647
Revises: de7971368f01
Create Date: 2026-01-28 17:08:45.014373

"""

import sqlalchemy as sa
from alembic import op

from migration_utils import (
    add_column_if_not_exists,
    create_foreign_key_if_not_exists,
    drop_column_if_exists,
    drop_foreign_key_if_exists,
)

revision = "51feb0521647"
down_revision = "de7971368f01"
branch_labels = None
depends_on = None


def upgrade():
    add_column_if_not_exists("photos", sa.Column("filename", sa.String(), nullable=True))
    add_column_if_not_exists("photos", sa.Column("file_size", sa.Integer(), nullable=True))
    add_column_if_not_exists("photos", sa.Column("width", sa.Integer(), nullable=True))
    add_column_if_not_exists("photos", sa.Column("height", sa.Integer(), nullable=True))
    add_column_if_not_exists("photos", sa.Column("uploader_id", sa.Integer(), nullable=True))
    add_column_if_not_exists(
        "photos",
        sa.Column(
            "display_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    add_column_if_not_exists("photos", sa.Column("caption", sa.Text(), nullable=True))
    create_foreign_key_if_not_exists(
        "photos_uploader_id_fkey",
        "photos",
        "users",
        ["uploader_id"],
        ["id"],
    )


def downgrade():
    drop_foreign_key_if_exists("photos_uploader_id_fkey", "photos")
    drop_column_if_exists("photos", "caption")
    drop_column_if_exists("photos", "display_order")
    drop_column_if_exists("photos", "uploader_id")
    drop_column_if_exists("photos", "height")
    drop_column_if_exists("photos", "width")
    drop_column_if_exists("photos", "file_size")
    drop_column_if_exists("photos", "filename")
