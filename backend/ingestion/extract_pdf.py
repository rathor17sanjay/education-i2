"""PDF text extraction with OCR fallback for image-only/flipbook-style PDFs.

Routes each document to the cheap path (pdfplumber text layer) when one
exists, and to Tesseract OCR only when it doesn't -- most BMU brochures are
flipbook-style exports with zero embedded text, but the multi-page
prospectuses/newsletters have a normal text layer.
"""

import os

import pytesseract
import pdfplumber
import pypdfium2 as pdfium

# Windows dev needs an explicit path (Tesseract isn't on PATH by default);
# the Droplet's Dockerfile installs the tesseract-ocr apt package, which
# puts it on PATH, so this stays unset there and pytesseract finds it
# automatically.
_tesseract_cmd = os.environ.get("TESSERACT_CMD")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd

FLIPBOOK_HEIGHT_THRESHOLD = 2000  # pt; a single "page" this tall is a rendered flipbook canvas
MIN_CHARS_PER_PAGE = 100  # below this, treat the page as image-only


def has_text_layer(path: str) -> bool:
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages[: min(len(pdf.pages), 5)]:
            if page.mediabox[3] > FLIPBOOK_HEIGHT_THRESHOLD:
                return False
            if len(page.chars) >= MIN_CHARS_PER_PAGE:
                return True
        # fall through: check remaining pages too, in case first few are covers
        for page in pdf.pages[5:]:
            if len(page.chars) >= MIN_CHARS_PER_PAGE:
                return True
    return False


def extract_text_layer(path: str) -> str:
    with pdfplumber.open(path) as pdf:
        return "\n\n".join(
            f"--- page {i + 1} ---\n{page.extract_text() or ''}"
            for i, page in enumerate(pdf.pages)
        )


def _ocr_image(img) -> str:
    return pytesseract.image_to_string(img)


def ocr_flipbook(path: str, render_width: int = 1400, strip_height: int = 2200) -> str:
    """Single giant tall 'page' (a rendered flipbook canvas) -> render, slice, OCR each slice."""
    pdf = pdfium.PdfDocument(path)
    page = pdf[0]
    w, h = page.get_size()
    scale = render_width / w
    bitmap = page.render(scale=scale)
    img = bitmap.to_pil()

    texts = []
    y = 0
    while y < img.height:
        box = (0, y, img.width, min(y + strip_height, img.height))
        texts.append(_ocr_image(img.crop(box)))
        y += strip_height
    return "\n".join(texts)


def ocr_paginated(path: str, dpi_scale: float = 2.2) -> str:
    """Normal multi-page scanned document -> render each page, OCR each."""
    pdf = pdfium.PdfDocument(path)
    texts = []
    for i in range(len(pdf)):
        page = pdf[i]
        bitmap = page.render(scale=dpi_scale)
        img = bitmap.to_pil()
        texts.append(f"--- page {i + 1} ---\n{_ocr_image(img)}")
    return "\n\n".join(texts)


def extract(path: str) -> str:
    """Pick the right extraction strategy automatically."""
    with pdfplumber.open(path) as pdf:
        n_pages = len(pdf.pages)
        first_h = pdf.pages[0].mediabox[3]

    if has_text_layer(path):
        return extract_text_layer(path)
    if n_pages == 1 and first_h > FLIPBOOK_HEIGHT_THRESHOLD:
        return ocr_flipbook(path)
    return ocr_paginated(path)
