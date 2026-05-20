import sys
import os

# Add backend root and alembic dir for app + migration_utils imports
_alembic_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_alembic_dir)
sys.path.insert(0, _backend_dir)
sys.path.insert(0, _alembic_dir)

from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection
from alembic import context

import app.models
from app.models.base import Base
from app.core.config import settings

config = context.config

if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_online():
    sync_database_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg", "postgresql+psycopg2"
    )
    connectable = create_engine(sync_database_url)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
