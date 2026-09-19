import pytest
from pydantic import ValidationError

from memevolution.models.genome import MemeGenome


def test_valid_genome(genome_factory):
    genome = genome_factory()
    assert genome.absurdity == 0.5


@pytest.mark.parametrize("field,value", [
    ("absurdity", 1.5),
    ("irony", -0.1),
    ("relatability", 2.0),
    ("trend_relevance", -1.0),
])
def test_numeric_trait_out_of_range_rejected(genome_factory, field, value):
    with pytest.raises(ValidationError):
        genome_factory(**{field: value})


def test_negative_video_length_rejected(genome_factory):
    with pytest.raises(ValidationError):
        genome_factory(video_length=-1)


def test_zero_caption_length_rejected(genome_factory):
    with pytest.raises(ValidationError):
        genome_factory(caption_length=0)


def test_extra_traits_defaults_empty(genome_factory):
    genome = genome_factory()
    assert genome.extra_traits == {}
