"""Meme genome — the structured DNA of a meme candidate."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MemeGenome(BaseModel):
    """The heritable traits of one meme concept.

    Categorical traits (topic/humor/format/hook/audio_strategy) describe
    *what kind* of meme this is; numeric traits are continuous dials the
    evolutionary loop can nudge up or down between generations.
    """

    topic: str
    humor: str
    format: str
    hook: str

    absurdity: float = Field(ge=0.0, le=1.0)
    irony: float = Field(ge=0.0, le=1.0)
    relatability: float = Field(ge=0.0, le=1.0)
    trend_relevance: float = Field(ge=0.0, le=1.0)

    caption_length: int = Field(gt=0, le=2200)
    video_length: int = Field(gt=0, le=180)
    audio_strategy: str

    # Open slot for future experimental traits (e.g. "pacing", "text_density")
    # so new dials can be added without a schema migration or special-casing
    # every function that walks a genome's traits.
    extra_traits: dict[str, float] = Field(default_factory=dict)
