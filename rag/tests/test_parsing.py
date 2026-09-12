import pytest

from rag.parsing.parsers import ParseError, parse_document


def test_markdown_frontmatter_and_body(tmp_path):
    path = tmp_path / "doc.md"
    path.write_text("---\nsource_id: x\ntitle: X\ndisaster_types: [flood, general]\n---\n\nBody text here.\n")
    parsed = parse_document(path)
    assert parsed.metadata["source_id"] == "x"
    assert parsed.metadata["disaster_types"] == ["flood", "general"]
    assert parsed.text.strip() == "Body text here."


def test_markdown_without_frontmatter_is_rejected(tmp_path):
    path = tmp_path / "doc.md"
    path.write_text("# Just a heading\n\nNo metadata block.")
    with pytest.raises(ParseError, match="no frontmatter"):
        parse_document(path)


def test_text_requires_sidecar_metadata(tmp_path):
    path = tmp_path / "doc.txt"
    path.write_text("plain text content")
    with pytest.raises(ParseError, match="sidecar"):
        parse_document(path)


def test_text_with_sidecar(tmp_path):
    path = tmp_path / "doc.txt"
    path.write_text("plain text content")
    (tmp_path / "doc.txt.meta.json").write_text('{"source_id": "y", "title": "Y"}')
    parsed = parse_document(path)
    assert parsed.metadata == {"source_id": "y", "title": "Y"}
    assert parsed.text == "plain text content"


def test_unsupported_extension(tmp_path):
    path = tmp_path / "doc.docx"
    path.write_text("x")
    with pytest.raises(ParseError, match="unsupported source type"):
        parse_document(path)


def test_pdf_page_breaks_are_preserved(tmp_path):
    from pypdf import PdfWriter

    path = tmp_path / "doc.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.add_blank_page(width=200, height=200)
    with path.open("wb") as f:
        writer.write(f)
    (tmp_path / "doc.pdf.meta.json").write_text('{"source_id": "p", "title": "P"}')
    # A blank PDF has no extractable text — asserts the guard fires rather
    # than silently returning an empty document.
    with pytest.raises(ParseError, match="no extractable text"):
        parse_document(path)
