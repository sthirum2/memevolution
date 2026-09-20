"""Mutating a genome by one or two traits, and explaining why in plain English."""

from __future__ import annotations

import random

from memevolution.models.agent import AgentState
from memevolution.models.experiment import Mutation
from memevolution.models.genome import MemeGenome

FLOAT_TRAITS = ("absurdity", "irony", "relatability", "trend_relevance")

# The categorical search space. Without these the only mutable traits were four
# floats plus length and audio, so every candidate kept the seed's college/pov
# wording and a generation read as five variations of one idea. The predictor
# never sees these fields (role1._genome_to_features ignores them), so widening
# the space changes what Gemini is asked to write, not how anything is scored.
CATEGORICAL_VALUES: dict[str, tuple[str, ...]] = {
    "format": (
        "pov", "fake_commercial", "reaction", "absurd_news_report", "fake_tutorial",
        "documentary", "text_message_reenactment", "challenge", "mock_interview",
        "surreal_sketch", "before_after", "fake_product_reveal",
    ),
    "topic": (
        "college", "gym", "dating", "work", "gaming", "food", "pets", "commuting",
        "technology", "social_media", "family", "internet_culture", "everyday_frustration",
    ),
    "humor": (
        "absurdist", "irony", "exaggeration", "misdirection", "relatable", "parody",
        "deadpan", "escalation", "cringe", "unexpected_contrast",
    ),
    "hook": (
        "unexpected_text", "single_shot", "reaction_cut", "reveal", "two_character_scene",
        "screen_recording", "montage", "fake_interview", "object_focused_gag",
    ),
}
CATEGORICAL_TRAITS = tuple(CATEGORICAL_VALUES)

ALL_TRAITS = FLOAT_TRAITS + ("video_length", "audio_strategy") + CATEGORICAL_TRAITS

# Maps a genome trait to the belief key that governs its mutation direction.
_BELIEF_KEY = {"video_length": "short_video", "audio_strategy": "trending_audio"}


def _belief_key(trait: str) -> str:
    return _BELIEF_KEY.get(trait, trait)


def mutate(
    genome: MemeGenome,
    state: AgentState,
    *,
    traits: list[str] | None = None,
    rng: random.Random | None = None,
    forced: dict[str, str] | None = None,
) -> tuple[MemeGenome, list[Mutation]]:
    """Mutate 1-2 traits of `genome`, guided by the agent's current beliefs.

    For each trait mutated, the direction (increase vs. decrease) follows
    whichever side of neutral (0.5) the agent currently believes in — this
    is the "exploitation" behavior. With probability `state.exploration_rate`
    the direction is flipped instead, deliberately testing the
    less-favored side. Unrelated traits are left untouched, and every
    change is recorded as a `Mutation`.

    Pass `traits` to force which trait(s) get mutated (used by
    `generate_population` to keep candidates diverse); otherwise a random
    1-2 traits are chosen.
    """
    rng = rng or random.Random()

    if traits is None:
        n = 2 if rng.random() < 0.25 else 1
        pool = list(ALL_TRAITS)
        rng.shuffle(pool)
        traits = pool[:n]

    explore = rng.random() < state.exploration_rate
    data = genome.model_dump()
    mutations: list[Mutation] = []

    for trait in traits:
        belief = state.beliefs.get(_belief_key(trait), 0.5)
        favor_increase = belief >= 0.5
        if explore and rng.random() < 0.5:
            favor_increase = not favor_increase

        if trait in FLOAT_TRAITS:
            old = data[trait]
            delta = rng.uniform(0.12, 0.25)
            new = old + delta if favor_increase else old - delta
            new = round(min(1.0, max(0.0, new)), 2)
            if new == old:
                continue
            data[trait] = new
            mutations.append(Mutation(trait=trait, **{"from": old, "to": new}))

        elif trait == "video_length":
            old = data["video_length"]
            delta = rng.randint(2, 4)
            # favor_increase for "short_video" belief means favor *shorter*.
            new = old - delta if favor_increase else old + delta
            new = min(60, max(3, new))
            if new == old:
                continue
            data["video_length"] = new
            mutations.append(Mutation(trait=trait, **{"from": old, "to": new}))

        elif trait == "audio_strategy":
            old = data["audio_strategy"]
            new = "trending_audio" if old != "trending_audio" else "original_sound"
            data["audio_strategy"] = new
            mutations.append(Mutation(trait=trait, **{"from": old, "to": new}))

        elif trait in CATEGORICAL_VALUES:
            # No belief governs these, so there is no direction to exploit --
            # the move is simply to a different value than the one held now.
            old = data[trait]
            new = (forced or {}).get(trait)
            if new is None:
                options = [v for v in CATEGORICAL_VALUES[trait] if v != old]
                if not options:
                    continue
                new = rng.choice(options)
            if new == old:
                continue
            data[trait] = new
            mutations.append(Mutation(trait=trait, **{"from": old, "to": new}))

    if not mutations:
        # All requested traits happened to clamp to their existing value;
        # retry once with a different random trait to guarantee a change.
        return mutate(genome, state, traits=[rng.choice(ALL_TRAITS)], rng=rng)

    return MemeGenome.model_validate(data), mutations


def _direction_word(mutation: Mutation) -> str:
    try:
        increased = float(mutation.to_value) > float(mutation.from_value)
    except (TypeError, ValueError):
        return "Changing"
    return "Higher" if increased else "Lower"


_HYPOTHESIS_TEMPLATES = {
    "absurdity": "{direction} absurdity may increase sharing among the target audience.",
    "irony": "{direction} irony may improve engagement through cleverness.",
    "relatability": "{direction} relatability may drive more comments and saves.",
    "trend_relevance": "{direction} trend relevance may improve discoverability via the algorithm.",
    "video_length": "{direction2} videos may improve completion rate and therefore fitness.",
    "caption_length": "{direction2} captions may change how quickly viewers grasp the joke.",
    "audio_strategy": "Using {value} may change how discoverable the video is.",
    "format": "Presenting it as a {value} may land differently than the parent's format.",
    "topic": "Moving the subject to {value} may reach a different audience.",
    "humor": "Leaning on {value} humor may change how hard the joke hits.",
    "hook": "Opening with a {value} may hold attention past the first seconds.",
}


def generate_hypothesis(mutations: list[Mutation]) -> str:
    """Turn a list of mutations into a human-readable, trait-specific hypothesis."""
    parts: list[str] = []
    for mutation in mutations:
        template = _HYPOTHESIS_TEMPLATES.get(mutation.trait)
        if template is None:
            parts.append(
                f"Changing {mutation.trait} from {mutation.from_value} to "
                f"{mutation.to_value} may affect fitness."
            )
            continue
        direction = _direction_word(mutation)
        direction2 = "Shorter" if direction == "Lower" else "Longer"
        parts.append(
            template.format(
                direction=direction,
                direction2=direction2,
                value=str(mutation.to_value).replace("_", " "),
            )
        )
    return " ".join(parts)
