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
import time
from typing import Protocol

from memevolution.models.experiment import MemeConcept
from memevolution.models.genome import MemeGenome


def use_vertex() -> bool:
    """Opt in to Vertex AI (billed to the Google Cloud project) instead of an API key."""
    return os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in ("1", "true", "yes")


class ConceptGenerator(Protocol):
    def generate_meme_concept(self, genome: MemeGenome) -> MemeConcept:
        ...


_PROMPT_TEMPLATE = """You write short-form video memes. The bar is simple and \
brutal: would a real person stop scrolling, actually laugh, and send this to a \
friend? If not, it failed. Write everything in English.

THE BRIEF below is direction, not a script — it says what KIND of meme this is. \
Inventing the actual joke is your job, and a concept that obeys the brief while \
being unfunny is a failure.

{genome_json}

WHERE THE FUNNY COMES FROM
Pick one engine and commit to it completely:
- Someone treating a trivial thing with total, unwarranted seriousness.
- A flat, mundane reaction to something insane — or an unhinged reaction to \
something utterly ordinary.
- A detail so exact that it proves you have actually lived this.
The laugh is the gap between how big the reaction is and how small the thing is. \
Random is not funny. Misplaced conviction is.

THE PUNCHLINE MUST TURN, NOT EXPLAIN
The opening sets an expectation; the punchline breaks it or makes it worse. It \
must never describe, summarise or justify what the viewer can already see.
  Bad:  "He says the other gym members were ruining his aesthetic."  (explains it)
  Good: "Day four. The wall is holding."                             (escalates it)
If the punchline could be deleted without losing anything, rewrite it.

BE SPECIFIC, NOT GENERIC
"a guy at the gym" is nothing. "the guy who films every set at 6pm" is a joke. \
Name the exact hour, the exact object, the exact small detail. Specificity is \
what makes someone comment "how did they know".

SOUND LIKE A PERSON, NOT A BRAND
- No hashtag stuffing. At most one, and only if the hashtag is itself the joke.
- The caption is short, lowercase, tossed off. A non-sequitur or an \
under-reaction beats a summary. Never restate the video.
- No exclamation marks, no "POV:" unless the brief's hook calls for it, no \
"literally me", no emoji.
- Have an attitude — exhausted, deadpan, petty, resigned, unhinged. Neutral is death.

NEVER
- Explain the joke, in any field.
- Write advertising or news-anchor voice, unless the format is literally that.
- Reach for a meme template that peaked more than two years ago.
- Tie it up neatly. Real memes just stop.

WHAT EACH FIELD IS FOR
- `visual`: the only thing a camera is given, so it must be purely physical — \
who is in frame, what they are doing, where, and the one detail the joke rests \
on. No inner states ("realising that..."), no backstory, nothing a lens cannot \
see. It must be filmable as ONE continuous 8-second live-action shot: one \
location, one or two people, no cuts, no effects, and no text existing in the scene.
- `opening` and `punchline` are burned on screen AND read aloud, so write them to \
be said out loud. `opening` 10 words or fewer, `punchline` 8 words or fewer, the \
two speakable in about 6 seconds together. Punchy, not descriptive.
- `title`: a short internal label. It is never shown to a viewer, so do not \
spend the joke on it.
- `audio_strategy`: concrete sound present in that room — specific noises, not a \
mood. No music and no dialogue; a narrator and a music bed are added separately.

BEFORE YOU ANSWER
Reread the punchline. If it explains instead of turning, or if you could drop in \
a different topic and it would still work unchanged, it is not good enough yet. \
Rewrite it.
"""


_BANDS = (
    (0.2, "barely"), (0.4, "slightly"), (0.6, "moderately"),
    (0.8, "strongly"), (1.01, "extremely"),
)

_DIALS = {
    "absurdity": "Make it {} surreal or illogical.",
    "irony": "Make it {} ironic — saying one thing while meaning the opposite.",
    "relatability": "Ground it {} in an everyday situation the viewer has lived through.",
    "trend_relevance": "Tie it {} to what people are talking about right now.",
}


def _band(value: float) -> str:
    return next(word for edge, word in _BANDS if value < edge)


def describe_genome(genome: MemeGenome) -> str:
    """Render a genome as creative direction rather than as data.

    The numeric traits are how the predictor reasons, but a bare
    "absurdity: 0.73" gives a language model nothing to act on, and asking it
    to satisfy an unexplained number is what produced concepts that met the
    brief while being incoherent. The same values are stated as intensities it
    can actually write to.
    """
    g = genome.model_dump()
    lines = [f"Topic: {g['topic']}", f"Comic voice: {g['humor']}",
             f"Format: {str(g['format']).replace('_', ' ')}",
             f"Hook: {str(g['hook']).replace('_', ' ')}"]
    lines += [tpl.format(_band(float(g[t]))) for t, tpl in _DIALS.items() if t in g]
    return "THE BRIEF\n" + "\n".join(lines)


class GeminiConceptGenerator:
    """Calls the Gemini API to turn a genome into a concrete meme concept."""

    def __init__(self, model_name: str = "gemini-3.6-flash", api_key: str | None = None) -> None:
        from google import genai  # optional dependency, imported lazily

        self._genai = genai
        if use_vertex():
            project = os.environ.get("GOOGLE_CLOUD_PROJECT")
            if not project:
                raise RuntimeError("GOOGLE_GENAI_USE_VERTEXAI is set but GOOGLE_CLOUD_PROJECT is not.")
            # gemini-3.6-flash is served from the "global" Vertex location only (404s
            # in us-central1, which Veo needs), so it gets its own location setting.
            self._client = genai.Client(
                vertexai=True,
                project=project,
                location=os.environ.get("GOOGLE_CLOUD_GLOBAL_LOCATION", "global"),
            )
        else:
            api_key = api_key or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "GEMINI_API_KEY is not set. Set it in the environment, or use "
                    "MockConceptGenerator / get_concept_generator() for local dev."
                )
            self._client = genai.Client(api_key=api_key)
        self._model_name = model_name

    def generate_meme_concept(self, genome: MemeGenome) -> MemeConcept:
        prompt = _PROMPT_TEMPLATE.format(genome_json=describe_genome(genome))
        response = self._generate_with_retry(prompt)
        if isinstance(response.parsed, MemeConcept):
            return response.parsed
        return MemeConcept.model_validate(json.loads(response.text))

    def _generate_with_retry(self, prompt: str, attempts: int = 4):
        """The flash models return 503 under load often enough that a single
        attempt loses a whole generation run, so back off and try again."""
        delay = 2.0
        for attempt in range(attempts):
            try:
                return self._client.models.generate_content(
                    model=self._model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json",
                        "response_schema": MemeConcept,
                    },
                )
            except Exception as exc:
                overloaded = "503" in str(exc) or "UNAVAILABLE" in str(exc)
                if not overloaded or attempt == attempts - 1:
                    raise
                time.sleep(delay)
                delay *= 2
        raise AssertionError("unreachable")


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
    """Return a real Gemini client if GEMINI_API_KEY (or Vertex) is configured, else the dev stub."""
    if os.environ.get("GEMINI_API_KEY") or (use_vertex() and os.environ.get("GOOGLE_CLOUD_PROJECT")):
        try:
            return GeminiConceptGenerator()
        except Exception as exc:  # pragma: no cover - defensive fallback
            print(f"[WARN] Gemini client failed to initialize ({exc}); falling back to stub.")
    print("[DEV STUB] GEMINI_API_KEY not set - using MockConceptGenerator, not real Gemini output.")
    return MockConceptGenerator()
