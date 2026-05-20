"""Idempotent Alembic helpers for DBs bootstrapped via init_db()."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def has_column(table_name: str, column_name: str) -> bool:
    columns = _inspector().get_columns(table_name)
    return any(col["name"] == column_name for col in columns)


def has_index(table_name: str, index_name: str) -> bool:
    indexes = _inspector().get_indexes(table_name)
    return any(idx["name"] == index_name for idx in indexes)


def has_foreign_key(table_name: str, constraint_name: str) -> bool:
    foreign_keys = _inspector().get_foreign_keys(table_name)
    return any(fk.get("name") == constraint_name for fk in foreign_keys)


def add_column_if_not_exists(table_name: str, column: sa.Column) -> None:
    if not has_column(table_name, column.name):
        op.add_column(table_name, column)


def drop_column_if_exists(table_name: str, column_name: str) -> None:
    if has_column(table_name, column_name):
        op.drop_column(table_name, column_name)


def create_index_if_not_exists(
    index_name: str,
    table_name: str,
    columns: list[str],
    *,
    unique: bool = False,
) -> None:
    if not has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def drop_index_if_exists(index_name: str, table_name: str) -> None:
    if has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def create_foreign_key_if_not_exists(
    constraint_name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
) -> None:
    if not has_foreign_key(source_table, constraint_name):
        op.create_foreign_key(
            constraint_name,
            source_table,
            referent_table,
            local_cols,
            remote_cols,
        )


def drop_foreign_key_if_exists(
    constraint_name: str, table_name: str
) -> None:
    if has_foreign_key(table_name, constraint_name):
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")
