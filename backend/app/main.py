from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .database import get_db, initialize_database
from .models import EngagementSnapshot, Experiment, Genome, Prediction
from .schemas import (
    DeploymentResponse,
    DeployCreate,
    ExperimentCreate,
    ExperimentResponse,
    GenerationResponse,
    GenomeResponse,
    MetricsCreate,
    ObservedResponse,
    PredictionCreate,
    PredictionResponse,
    SnapshotResponse,
    PropagationPoint,
)
from .tiktok import ManualTikTokService

settings = get_settings()
app = FastAPI(title="Memevolution API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
tiktok_service = ManualTikTokService()


@app.on_event("startup")
def create_tables() -> None:
    initialize_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def get_experiment_or_404(db: Session, experiment_id: str) -> Experiment:
    experiment = db.scalar(
        select(Experiment)
        .options(selectinload(Experiment.genome), selectinload(Experiment.prediction), selectinload(Experiment.snapshots))
        .where(Experiment.id == experiment_id)
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


def to_response(experiment: Experiment) -> ExperimentResponse:
    latest = experiment.snapshots[-1] if experiment.snapshots else None
    return ExperimentResponse(
        id=experiment.id,
        generation=experiment.generation,
        parent_id=experiment.parent_id,
        genome=GenomeResponse.model_validate(experiment.genome),
        mutations=experiment.mutations or [],
        hypothesis=experiment.hypothesis,
        prediction=(
            PredictionResponse(fitness=experiment.prediction.predicted_fitness, model_version=experiment.prediction.model_version)
            if experiment.prediction
            else None
        ),
        deployment=DeploymentResponse(
            platform=experiment.deployment_platform,
            timestamp=experiment.deployed_at,
            post_id=experiment.post_id,
        ),
        observed=ObservedResponse(
            views=latest.views if latest else None,
            likes=latest.likes if latest else None,
            comments=latest.comments if latest else None,
            shares=latest.shares if latest else None,
            saves=latest.saves if latest else None,
            fitness=latest.fitness if latest else None,
        ),
    )


@app.post("/experiments", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)) -> ExperimentResponse:
    experiment_id = payload.id or f"exp_{uuid4().hex[:8]}"
    if db.get(Experiment, experiment_id):
        raise HTTPException(status_code=409, detail="Experiment ID already exists")
    experiment = Experiment(
        id=experiment_id,
        generation=payload.generation,
        parent_id=payload.parent_id,
        status=payload.status,
        hypothesis=payload.hypothesis,
        mutations=[mutation.model_dump(by_alias=True) for mutation in payload.mutations],
        genome=Genome(**payload.genome.model_dump()),
    )
    db.add(experiment)
    db.commit()
    return to_response(get_experiment_or_404(db, experiment_id))


@app.get("/experiments", response_model=list[ExperimentResponse])
def list_experiments(
    generation: int | None = None, db: Session = Depends(get_db)
) -> list[ExperimentResponse]:
    query = select(Experiment).options(
        selectinload(Experiment.genome), selectinload(Experiment.prediction), selectinload(Experiment.snapshots)
    ).order_by(Experiment.generation, Experiment.created_at)
    if generation is not None:
        query = query.where(Experiment.generation == generation)
    return [to_response(experiment) for experiment in db.scalars(query).all()]


@app.get("/experiments/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: str, db: Session = Depends(get_db)) -> ExperimentResponse:
    return to_response(get_experiment_or_404(db, experiment_id))


@app.get("/experiments/{experiment_id}/snapshots", response_model=list[SnapshotResponse])
def snapshot_history(experiment_id: str, db: Session = Depends(get_db)) -> list[SnapshotResponse]:
    experiment = get_experiment_or_404(db, experiment_id)
    return [SnapshotResponse.model_validate(snapshot) for snapshot in experiment.snapshots]


@app.get("/experiments/{experiment_id}/propagation", response_model=list[PropagationPoint])
def propagation(experiment_id: str, db: Session = Depends(get_db)) -> list[PropagationPoint]:
    snapshots = snapshot_history(experiment_id, db)
    points = []
    for index, snapshot in enumerate(snapshots):
        previous = snapshots[index - 1] if index else None
        interval = (snapshot.timestamp - previous.timestamp).total_seconds() if previous else None
        view_growth = (snapshot.views - previous.views
                       if previous and snapshot.views is not None and previous.views is not None else None)
        share_growth = (snapshot.shares - previous.shares
                        if previous and snapshot.shares is not None and previous.shares is not None else None)
        points.append(PropagationPoint(
            **snapshot.model_dump(),
            elapsed_seconds=(snapshot.timestamp - snapshots[0].timestamp).total_seconds(),
            interval_seconds=interval,
            view_growth=view_growth,
            share_growth=share_growth,
            views_per_hour=view_growth * 3600 / interval if interval and view_growth is not None else None,
            shares_per_hour=share_growth * 3600 / interval if interval and share_growth is not None else None,
        ))
    return points


@app.get("/generations", response_model=list[GenerationResponse])
def list_generations(db: Session = Depends(get_db)) -> list[GenerationResponse]:
    experiments = list_experiments(db=db)
    grouped: dict[int, list[ExperimentResponse]] = {}
    for experiment in experiments:
        grouped.setdefault(experiment.generation, []).append(experiment)
    return [GenerationResponse(generation=generation, experiments=items) for generation, items in sorted(grouped.items())]


@app.post("/experiments/{experiment_id}/prediction", response_model=ExperimentResponse)
def attach_prediction(
    experiment_id: str, payload: PredictionCreate, db: Session = Depends(get_db)
) -> ExperimentResponse:
    experiment = get_experiment_or_404(db, experiment_id)
    if experiment.prediction:
        experiment.prediction.predicted_fitness = payload.fitness
        experiment.prediction.model_version = payload.model_version
    else:
        experiment.prediction = Prediction(
            experiment_id=experiment_id,
            predicted_fitness=payload.fitness,
            model_version=payload.model_version,
        )
    db.commit()
    return to_response(get_experiment_or_404(db, experiment_id))


@app.post("/experiments/{experiment_id}/deploy", response_model=ExperimentResponse)
def deploy_experiment(
    experiment_id: str, payload: DeployCreate, db: Session = Depends(get_db)
) -> ExperimentResponse:
    experiment = get_experiment_or_404(db, experiment_id)
    experiment.deployment_platform = payload.platform
    experiment.post_id = tiktok_service.deploy(payload.post_id)
    experiment.deployed_at = payload.timestamp or datetime.now(timezone.utc)
    experiment.status = "deployed"
    db.commit()
    return to_response(get_experiment_or_404(db, experiment_id))


@app.post("/experiments/{experiment_id}/metrics", response_model=ExperimentResponse)
def record_metrics(
    experiment_id: str, payload: MetricsCreate, db: Session = Depends(get_db)
) -> ExperimentResponse:
    experiment = get_experiment_or_404(db, experiment_id)
    if not experiment.post_id:
        raise HTTPException(status_code=409, detail="Experiment must be deployed before metrics are recorded")
    db.add(
        EngagementSnapshot(
            experiment_id=experiment_id,
            # SQLite drops offsets, so normalize observations to UTC before storage.
            timestamp=(payload.timestamp.replace(tzinfo=timezone.utc) if payload.timestamp.tzinfo is None
                       else payload.timestamp.astimezone(timezone.utc))
                      if payload.timestamp else datetime.now(timezone.utc),
            views=payload.views,
            likes=payload.likes,
            comments=payload.comments,
            shares=payload.shares,
            saves=payload.saves,
            fitness=payload.fitness,
        )
    )
    experiment.status = "observed"
    db.commit()
    db.expire(experiment, ["snapshots"])
    return to_response(get_experiment_or_404(db, experiment_id))
