"""Command-line demo of the full Role 2 evolutionary loop, no Instagram publishing required."""

from __future__ import annotations

import argparse
from datetime import datetime
import random

from memevolution.agent.orchestrator import GenerationResult, apply_observation, run_generation
from memevolution.models.experiment import Observation
from memevolution.persistence import json_store
from memevolution.prediction.mock import MockFitnessPredictor

_LABELS = "ABCDEFGHIJ"


def _build_predictor(
    name: str,
    seed: int | None,
    planned_time: datetime | None = None,
):
    if name == "mock":
        print("[DEV STUB] Using MockFitnessPredictor - NOT the trained Role 1 model.\n")
        return MockFitnessPredictor(seed=seed)

    from memevolution.prediction.trained import MODEL_VERSION, TrainedFitnessPredictor

    predictor = TrainedFitnessPredictor(planned_time=planned_time)
    print(
        f"[TRAINED ROLE 1 MODEL] {MODEL_VERSION}; "
        f"posting time: {predictor.planned_time.isoformat()}\n"
    )
    return predictor


def _print_generation(result: GenerationResult) -> None:
    print(f"=== MEMEVOLUTION - GENERATION {result.generation} ===\n")

    print("Agent beliefs:")
    for key, value in result.state.beliefs.items():
        print(f"  {key:<16} {value:.2f}")

    print(f"\nGenerating {len(result.candidates)} candidates...\n")

    for label, candidate in zip(_LABELS, result.candidates):
        print(f"Candidate {label}  ({candidate.id})")
        for m in candidate.mutations:
            print(f"  mutation: {m.trait} {m.from_value} -> {m.to_value}")
        pred = candidate.prediction
        if pred is not None:
            print(f"  predicted fitness: {pred.fitness:.2f}")
            if pred.confidence is not None:
                print(f"  confidence: {pred.confidence:.2f}")
        print(f"  hypothesis: {candidate.hypothesis}\n")

    sel = result.selection
    idx = result.candidates.index(sel.selected)
    print(f"Selection:\n  Candidate {_LABELS[idx]}  ({sel.selected.id})  [{sel.mode}]\n")
    print(f"Reason:\n  {sel.reason}\n")

    concept = result.concept
    print("Generated meme concept:")
    print(f"  title:     {concept.title}")
    print(f"  opening:   {concept.opening}")
    print(f"  visual:    {concept.visual}")
    print(f"  punchline: {concept.punchline}")
    print(f"  caption:   {concept.caption}")
    print(f"  audio:     {concept.audio_strategy}\n")

    print(f"Experiment ID:\n  {sel.selected.id}")


def cmd_generate(args: argparse.Namespace) -> None:
    state = json_store.load_state()
    predictor = _build_predictor(
        args.predictor,
        args.seed,
        args.planned_time,
    )
    rng = random.Random(args.seed)
    result = run_generation(
        state,
        predictor,
        population_size=args.population_size,
        rng=rng,
    )
    _print_generation(result)


def cmd_status(_args: argparse.Namespace) -> None:
    state = json_store.load_state()
    print(f"Generation: {state.generation}")
    print("Beliefs:")
    for key, value in state.beliefs.items():
        print(f"  {key:<16} {value:.2f}")
    print(f"\nExperiments tracked in agent history: {len(state.experiment_history)}")
    for exp in state.experiment_history:
        status = "observed" if exp.observed.fitness is not None else "pending"
        print(f"  {exp.id} (gen {exp.generation}) - {status}")


def cmd_observe(args: argparse.Namespace) -> None:
    state = json_store.load_state()
    observation = Observation(
        views=args.views,
        likes=args.likes,
        comments=args.comments,
        shares=args.shares,
        saves=args.saves,
        fitness=args.fitness,
    )
    new_state, experiment = apply_observation(state, args.experiment_id, observation)

    predicted = experiment.prediction.fitness if experiment.prediction else None
    actual = experiment.observed.fitness

    print(f"Experiment: {experiment.id}")
    print(f"Predicted: {predicted:.2f}" if predicted is not None else "Predicted: n/a")
    print(f"Actual:    {actual:.2f}" if actual is not None else "Actual:    n/a")
    if experiment.prediction_error is not None:
        print(f"Error:     {experiment.prediction_error:+.2f}")

    print("\nUpdated beliefs:")
    for key, value in new_state.beliefs.items():
        print(f"  {key:<16} {value:.2f}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="memevolution")
    sub = parser.add_subparsers(dest="command", required=True)

    gen = sub.add_parser("generate", help="Run one evolutionary generation")
    gen.add_argument("--population-size", type=int, default=5)
    gen.add_argument("--seed", type=int, default=None)
    gen.add_argument(
        "--predictor",
        choices=["role1", "trained", "mock"],
        default="role1",
        help="Fitness predictor to use (default: calibrated Role 1 trained model)",
    )
    gen.add_argument(
        "--planned-time",
        type=datetime.fromisoformat,
        default=None,
        help="ISO posting time with timezone; defaults to current local time",
    )
    gen.set_defaults(func=cmd_generate)

    status = sub.add_parser("status", help="Show current agent state")
    status.set_defaults(func=cmd_status)

    observe = sub.add_parser("observe", help="Record a real-world observation and learn from it")
    observe.add_argument("experiment_id")
    observe.add_argument("--views", type=int, default=None)
    observe.add_argument("--likes", type=int, default=None)
    observe.add_argument("--comments", type=int, default=None)
    observe.add_argument("--shares", type=int, default=None)
    observe.add_argument("--saves", type=int, default=None)
    observe.add_argument("--fitness", type=float, required=True)
    observe.set_defaults(func=cmd_observe)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

