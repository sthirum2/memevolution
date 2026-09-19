"""Persistent agent state: what the evolutionary agent currently believes works."""

from __future__ import annotations

from pydantic import BaseModel, Field

from memevolution.models.experiment import Experiment
from memevolution.models.genome import MemeGenome

# Neutral (0.5 = "no opinion yet") starting beliefs. The agent has not run
# any experiments yet, so it must not pretend to already know what works.
DEFAULT_BELIEFS: dict[str, float] = {
    "absurdity": 0.5,
    "irony": 0.5,
    "relatability": 0.5,
    "trend_relevance": 0.5,
    "short_video": 0.5,
    "trending_audio": 0.5,
}


class AgentState(BaseModel):
    """Everything the agent remembers between generations. Persisted to disk."""

    generation: int = 0

    beliefs: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_BELIEFS))

    exploration_rate: float = Field(default=0.2, ge=0.0, le=1.0)
    exploitation_rate: float = Field(default=0.8, ge=0.0, le=1.0)

    successful_genomes: list[MemeGenome] = Field(default_factory=list)
    experiment_history: list[Experiment] = Field(default_factory=list)

    hypotheses: list[str] = Field(default_factory=list)

    # Monotonic counter backing experiment id generation, so ids stay
    # unique across restarts even though only selected candidates persist.
    experiment_counter: int = Field(default=0, ge=0)
