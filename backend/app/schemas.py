from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class GenomeInput(BaseModel):
    topic: str
    humor: str
    format: str
    hook: str
    absurdity: float = Field(ge=0, le=1)
    irony: float = Field(ge=0, le=1)
    relatability: float = Field(ge=0, le=1)
    trend_relevance: float = Field(ge=0, le=1)
    video_length: int = Field(gt=0, le=180)


class Mutation(BaseModel):
    trait: str
    from_value: float | int | str = Field(alias="from")
    to: float | int | str

    model_config = ConfigDict(populate_by_name=True)


class ExperimentCreate(BaseModel):
    id: str | None = None
    generation: int = Field(ge=0)
    parent_id: str | None = None
    status: str = "selected"
    genome: GenomeInput
    mutations: list[Mutation] = Field(default_factory=list)
    hypothesis: str


class PredictionCreate(BaseModel):
    fitness: float = Field(
        ge=0,
        le=1,
        validation_alias=AliasChoices("fitness", "predicted_fitness"),
    )
    model_version: str


class DeployCreate(BaseModel):
    post_id: str
    platform: str = "tiktok"
    timestamp: datetime | None = None


class MetricsCreate(BaseModel):
    timestamp: datetime | None = None
    views: int | None = Field(default=None, ge=0)
    likes: int | None = Field(default=None, ge=0)
    comments: int | None = Field(default=None, ge=0)
    shares: int | None = Field(default=None, ge=0)
    saves: int | None = Field(default=None, ge=0)
    fitness: float | None = Field(default=None, ge=0, le=1)


class GenomeResponse(GenomeInput):
    model_config = ConfigDict(from_attributes=True)


class PredictionResponse(BaseModel):
    fitness: float
    model_version: str


class DeploymentResponse(BaseModel):
    platform: str
    timestamp: datetime | None
    post_id: str | None


class ObservedResponse(BaseModel):
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None
    fitness: float | None = None


class ExperimentResponse(BaseModel):
    id: str
    generation: int
    parent_id: str | None
    genome: GenomeResponse
    mutations: list[Mutation]
    hypothesis: str
    prediction: PredictionResponse | None
    deployment: DeploymentResponse
    observed: ObservedResponse


class GenerationResponse(BaseModel):
    generation: int
    experiments: list[ExperimentResponse]