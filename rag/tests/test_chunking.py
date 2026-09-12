from rag.chunking.chunker import MAX_TOKENS, MIN_TOKENS, chunk_document


def test_flushes_on_heading_change():
    text = "# One\n\n" + ("word " * 100) + "\n\n## Two\n\n" + ("term " * 100)
    chunks = chunk_document(text)
    sections = [c.section for c in chunks]
    assert sections == ["One", "Two"]


def test_respects_token_bounds_on_a_long_uniform_document():
    text = "\n\n".join(["A paragraph with several words in it for chunking." for _ in range(400)])
    chunks = chunk_document(text)
    assert len(chunks) > 1
    for chunk in chunks[:-1]:
        # Every non-final chunk should be inside the target band; only the
        # last chunk (whatever tokens are left over) may fall under MIN.
        assert MIN_TOKENS <= chunk.token_count <= MAX_TOKENS


def test_short_document_is_one_chunk_even_under_min_tokens():
    chunks = chunk_document("A short authoritative note of a few words.")
    assert len(chunks) == 1
    assert chunks[0].token_count < MIN_TOKENS


def test_page_breaks_attribute_chunks_to_the_right_page():
    text = "Page one content here." + "\f" + "Page two content here."
    chunks = chunk_document(text)
    pages = [c.page for c in chunks]
    assert pages == [1, 2]


def test_empty_document_yields_no_chunks():
    assert chunk_document("") == []
    assert chunk_document("   \n\n  ") == []
