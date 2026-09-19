from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
database_url = make_url(settings.database_url)
if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+psycopg")
connect_args = {"check_same_thread": False} if database_url.get_backend_name() == "sqlite" else {}
engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def initialize_database() -> None:
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            # Serialize initialization across application workers.
            connection.exec_driver_sql("SELECT pg_advisory_xact_lock(74632019)")
        Base.metadata.create_all(bind=connection)
        if connection.dialect.name == "postgresql":
            migration = Path(__file__).resolve().parents[1] / "timescale.sql"
            connection.exec_driver_sql(
                migration.read_text(encoding="utf-8"),
                execution_options={"no_parameters": True},
            )


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
