FROM python:3.12-slim

WORKDIR /app

# tesseract-ocr: needed by ingestion/extract_pdf.py's OCR fallback for
# image-only/flipbook-style PDF uploads. Without this, pytesseract can't
# find the tesseract binary on Linux and OCR uploads 500 in production.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
