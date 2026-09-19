"""One evolutionary candidate: its genome, mutation, hypothesis, and outcomes."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from memevolution.models.genome import MemeGenome
from memevolution.models.prediction import Prediction


class Mutation(BaseModel):
    """A single recorded trait change, from a parent genome to a child."""

    model_config = ConfigDict(populate_by_name=True)

    trait: str
    from_value: float | int | str = Field(alias="from")
    to_value: float | int | str = Field(alias="to")


class Deployment(BaseModel):
    """Where/when a selected experiment was (or will be) posted.

    Left null until Role 4's real deployment happens — Role 2 never assumes
    a post exists.
    """

    platform: str = "tiktok"
    timestamp: datetime | None = None
    post_id: str | None = None


class Observation(BaseModel):
    """Real-world engagement, supplied later by Role 4. Null until recorded."""

    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None
    fitness: float | None = Field(default=None, ge=0.0, le=1.0)


class MemeConcept(BaseModel):
    """A concrete, postable meme concept generated (by Gemini) from a genome."""

    title: str
    opening: str
    visual: str
    punchline: str
    caption: str
    audio_strategy: str


class Experiment(BaseModel):
    """One evolutionary candidate, and eventually its measured outcome."""

    id: str
    generation: int
    parent_id: str | None = None

    genome: MemeGenome
    mutations: list[Mutation] = Field(default_factory=list)
    hypothesis: str

    # Filled in once the genome has been sent to Role 1's FitnessPredictor.
    prediction: Prediction | None = None
    # Filled in once this candidate is selected and sent to the LLM.
    concept: MemeConcept | None = None

    deployment: Deployment = Field(default_factory=Deployment)
    observed: Observation = Field(default_factory=Observation)

    @property
    def prediction_error(self) -> float | None:
        """actual_fitness - predicted_fitness. None until both are known."""
        if self.prediction is None or self.observed.fitness is None:
            return None
        return self.observed.fitness - self.prediction.fitness
