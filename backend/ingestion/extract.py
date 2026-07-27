"""Dispatches to the right extractor by source kind, so callers (the admin
upload endpoint) don't need their own if/elif over file type.
"""

from ingestion import extract_docx, extract_pdf, extract_pptx

_EXTRACTORS = {
    "pdf": extract_pdf.extract,
    "docx": extract_docx.extract,
    "pptx": extract_pptx.extract,
}


def extract_by_kind(path: str, kind: str) -> str:
    try:
        extractor = _EXTRACTORS[kind]
    except KeyError:
        raise ValueError(f"no extractor for source_kind={kind!r}")
    return extractor(path)
