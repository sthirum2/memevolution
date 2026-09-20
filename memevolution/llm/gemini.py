"""Turning a genome into a concrete meme concept via Gemini.

Gemini is used only for this content-generation step. The evolutionary
algorithm (mutation, selection, learning) never calls out to an LLM, and
Gemini is never allowed to change genome values — it only interprets them
into a title/opening/visual/punchline/caption/audio strategy.

Uses the `google-genai` SDK (the unified Gemini client). The older
`google-generativeai` package is fully deprecated (no updates or bug
fixes) as of this writing -- do not reintroduce it.
"""

from __future__ import annotations

import json
import os
from typing import Protocol

from memevolution.models.experiment import MemeConcept
from memevolution.models.genome import MemeGenome


class ConceptGenerator(Protocol):
    def generate_meme_concept(self, genome: MemeGenome) -> MemeConcept:
        ...


_PROMPT_TEMPLATE = """You are helping brainstorm a short-form video meme concept.

Here is the meme's genome (fixed traits — do not change these values, only \
interpret them into a concrete concept):

{genome_json}

Produce a concrete meme concept consistent with these traits.

Length limits matter: the video is a single 8-second clip, the `opening` and \
`punchline` are burned onto the screen AND read aloud by a narrator, and the \
two together must be speakable in about 6 seconds. Keep `opening` to 10 words \
or fewer and `punchline` to 8 words or fewer. Make them punchy, not descriptive.

The `audio_strategy` field should describe the concrete sound effects and \
ambience heard in the scene (for example a specific noise, not just a mood). \
Do not put spoken dialogue or music in it -- a narrator and a music track are \
added separately.
"""


class GeminiConceptGenerator:
    """Calls the Gemini API to turn a genome into a concrete meme concept."""

    def __init__(self, model_name: str = "gemini-3.5-flash", api_key: str | None = None) -> None:
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Set it in the environment, or use "
                "MockConceptGenerator / get_concept_generator() for local dev."
            )
        from google import genai  # optional dependency, imported lazily

        self._genai = genai
        self._client = genai.Client(api_key=api_key)
        self._model_name = model_name

    def generate_meme_concept(self, genome: MemeGenome) -> MemeConcept:
        prompt = _PROMPT_TEMPLATE.format(genome_json=genome.model_dump_json(indent=2))
        response = self._client.models.generate_content(
            model=self._model_name,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": MemeConcept,
            },
        )
        if isinstance(response.parsed, MemeConcept):
            return response.parsed
        return MemeConcept.model_validate(json.loads(response.text))


class MockConceptGenerator:
    """DEV STUB — deterministic, template-based concept, not Gemini output.

    Used automatically when GEMINI_API_KEY is not configured, so the rest
    of Role 2 can still be developed and demoed end-to-end without a live
    API key.
    """

    def generate_meme_concept(self, genome: MemeGenome) -> MemeConcept:
        return MemeConcept(
            title=f"{genome.topic.title()} but {genome.humor}",
            opening=f"POV: a {genome.topic} moment starts out completely normal...",
            visual=f"{genome.format} shot, '{genome.hook}' hook in the first 2 seconds",
            punchline="...and then it escalates in a way nobody saw coming.",
            caption=f"this is way too real for {genome.topic} #fyp",
            audio_strategy=genome.audio_strategy,
        )


def get_concept_generator() -> ConceptGenerator:
    """Return a real Gemini client if GEMINI_API_KEY is set, else the dev stub."""
    if os.environ.get("GEMINI_API_KEY"):
        try:
            return GeminiConceptGenerator()
        except Exception as exc:  # pragma: no cover - defensive fallback
            print(f"[WARN] Gemini client failed to initialize ({exc}); falling back to stub.")
    print("[DEV STUB] GEMINI_API_KEY not set - using MockConceptGenerator, not real Gemini output.")
    return MockConceptGenerator()
