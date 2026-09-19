import pytest

from memevolution.models.genome import MemeGenome


@pytest.fixture
def genome_factory():
    def _make(**overrides) -> MemeGenome:
        defaults = dict(
            topic="college",
            humor="absurdist",
            format="pov",
            hook="unexpected_text",
            absurdity=0.5,
            irony=0.5,
            relatability=0.5,
            trend_relevance=0.5,
            caption_length=80,
            video_length=10,
            audio_strategy="original_sound",
        )
        defaults.update(overrides)
        return MemeGenome(**defaults)

    return _make
