"""Database setup and additive SQLite migrations for existing demo data."""

import os

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from . import models  # noqa: F401 - registers tables with SQLModel metadata


DATABASE_URL = os.environ.get("SKILLREELS_DATABASE_URL", "sqlite:///skillreels.db")
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)

    # create_all does not alter a table that already exists. These additions
    # preserve the current SQLite prototype database while adding learner
    # signals used by the updated recommender.
    columns = {column["name"] for column in inspect(engine).get_columns("userstate")}
    additive_columns = {
        "observed_interests": "JSON NOT NULL DEFAULT '{}'",
        "skill_evidence": "JSON NOT NULL DEFAULT '{}'",
        "recent_skip_streak": "INTEGER NOT NULL DEFAULT 0",
        "intervention_skips": "INTEGER NOT NULL DEFAULT 0",
        "intervention_cooldown": "INTEGER NOT NULL DEFAULT 0",
        "task_failures": "INTEGER NOT NULL DEFAULT 0",
        "pref_career_action": "FLOAT NOT NULL DEFAULT 1.0",
    }
    with engine.begin() as connection:
        for name, column_sql in additive_columns.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE userstate ADD COLUMN {name} {column_sql}"))


def get_session():
    with Session(engine) as session:
        yield session
