from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .database import Base


JsonType = JSON().with_variant(JSONB, "postgresql")


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    generation: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("experiments.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="selected", index=True)
    hypothesis: Mapped[str] = mapped_column(Text, nullable=False)
    mutations: Mapped[list[dict]] = mapped_column(JsonType, nullable=False, default=list)
    # The meme itself. Without these the API can describe a genome but not the
    # artefact, and the UI ends up showing "campus · talking_head" where the
    # joke should be.
    content: Mapped[dict] = mapped_column(JsonType, nullable=False, default=dict)
    deployment_platform: Mapped[str] = mapped_column(String(30), nullable=False, default="instagram")
    post_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    genome: Mapped["Genome"] = relationship(back_populates="experiment", cascade="all, delete-orphan", uselist=False)
    prediction: Mapped["Prediction | None"] = relationship(
        back_populates="experiment", cascade="all, delete-orphan", uselist=False
    )
    snapshots: Mapped[list["EngagementSnapshot"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan",
        order_by="(EngagementSnapshot.timestamp, EngagementSnapshot.id)"
    )


class Genome(Base):
    __tablename__ = "genomes"

    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), primary_key=True)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)
    humor: Mapped[str] = mapped_column(String(100), nullable=False)
    format: Mapped[str] = mapped_column(String(100), nullable=False)
    hook: Mapped[str] = mapped_column(String(100), nullable=False)
    absurdity: Mapped[float] = mapped_column(Float, nullable=False)
    irony: Mapped[float] = mapped_column(Float, nullable=False)
    relatability: Mapped[float] = mapped_column(Float, nullable=False)
    trend_relevance: Mapped[float] = mapped_column(Float, nullable=False)
    video_length: Mapped[int] = mapped_column(Integer, nullable=False)

    experiment: Mapped[Experiment] = relationship(back_populates="genome")


class Prediction(Base):
    __tablename__ = "predictions"

    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), primary_key=True)
    predicted_fitness: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)

    experiment: Mapped[Experiment] = relationship(back_populates="prediction")


class EngagementSnapshot(Base):
    __tablename__ = "engagement_snapshots"

    # SQLite keeps its INTEGER primary key. timescale.sql expands the database
    # key to (id, timestamp) on PostgreSQL; sequence-generated IDs identify ORM rows.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shares: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saves: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fitness: Mapped[float | None] = mapped_column(Float, nullable=True)

    experiment: Mapped[Experiment] = relationship(back_populates="snapshots")


class AgentState(Base):
    __tablename__ = "agent_states"

    generation: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_json: Mapped[dict] = mapped_column(JsonType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
