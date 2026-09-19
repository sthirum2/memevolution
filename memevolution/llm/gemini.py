"""Turning a genome into a concrete meme concept via Gemini.

Gemini is used only for this content-generation step. The evolutionary
algorithm (mutation, selection, learning) never calls out to an LLM, and
Gemini is never allowed to change genome values — it only interprets them
into a title/opening/visual/punchline/caption/audio strategy.
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

Respond with JSON matching exactly this schema:
{{
  "title": string,
  "opening": string,
  "visual": string,
  "punchline": string,
  "caption": string,
  "audio_strategy": string
}}
"""


class GeminiConceptGenerator:
    """Calls the Gemini API to turn a genome into a concrete meme concept."""

    def __init__(self, model_name: str = "gemini-2.0-flash", api_key: str | None = None) -> None:
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Set it in the environment, or use "
                "MockConceptGenerator / get_concept_generator() for local dev."
            )
        import google.generativeai as genai  # optional dependency, imported lazily

        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model_name)

    def generate_meme_concept(self, genome: MemeGenome) -> MemeConcept:
        prompt = _PROMPT_TEMPLATE.format(genome_json=genome.model_dump_json(indent=2))
        response = self._model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        data = json.loads(response.text)
        return MemeConcept.model_validate(data)


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
