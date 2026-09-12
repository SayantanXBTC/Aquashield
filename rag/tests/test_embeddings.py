import pytest

from rag.embeddings.provider import DeterministicHashEmbedding, EmbeddingProviderError, build_embedding_provider


def test_is_deterministic_across_calls():
    e = DeterministicHashEmbedding()
    assert e.embed_one("tsunami warning") == e.embed_one("tsunami warning")


def test_related_text_scores_higher_than_unrelated():
    e = DeterministicHashEmbedding()

    def cos(a, b):
        return sum(x * y for x, y in zip(a, b))

    base = e.embed_one("tsunami wave height evacuation coastal warning")
    related = e.embed_one("tsunami evacuation warning coastal wave")
    unrelated = e.embed_one("quarterly financial statement audit report")
    assert cos(base, related) > cos(base, unrelated)


def test_vectors_are_unit_length():
    import math

    e = DeterministicHashEmbedding()
    v = e.embed_one("some authoritative guidance text")
    assert math.isclose(math.sqrt(sum(x * x for x in v)), 1.0, abs_tol=1e-9)


def test_empty_text_is_the_zero_vector_not_an_error():
    e = DeterministicHashEmbedding()
    assert e.embed_one("") == [0.0] * e.dim


def test_build_embedding_provider_local_is_the_default():
    provider = build_embedding_provider("local")
    assert isinstance(provider, DeterministicHashEmbedding)


def test_unknown_provider_is_rejected_not_silently_downgraded():
    with pytest.raises(EmbeddingProviderError):
        build_embedding_provider("openai")
