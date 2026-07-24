"""Phase 0 ingestion script: parse -> chunk -> embed -> store.

Usage:
    python -m ingestion.ingest samples/bmu_faq.json
    python -m ingestion.ingest samples/bmu_pages.json --pages
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import get_or_create_tenant, tenant_connection
from ingestion.chunker import count_tokens, faq_chunks, token_window_chunks
from ingestion.embed import embed_batch


def build_document_text(qa_pairs: list[dict]) -> str:
    return "\n\n".join(f"Q: {p['question']}\nA: {p['answer']}" for p in qa_pairs)


def _store_document(
    tenant_id: str,
    *,
    title: str,
    source_url: str,
    content: str,
    content_type: str,
    chunk_texts: list[str],
    auto_approve: bool,
) -> None:
    """Upsert one document + its chunks, keyed by source_url for diff detection.

    Shared by both the FAQ ingestion path (chunk_texts from faq_chunks) and
    the generic page path (chunk_texts from token_window_chunks) -- the
    document/chunk storage logic is identical either way, only the chunker
    differs.
    """
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

    with tenant_connection(tenant_id) as (conn, cur):
        cur.execute(
            """
            select id, content_hash from documents
            where tenant_id = %s and metadata->>'source_url' = %s
            """,
            (tenant_id, source_url),
        )
        existing = cur.fetchone()

        if existing and existing[1] == content_hash:
            print(f"unchanged, skipping: {source_url}")
            return

        status = "approved" if auto_approve else "staged"
        metadata = json.dumps({"source_url": source_url})

        if existing:
            document_id = existing[0]
            cur.execute(
                """
                update documents
                set title = %s, content = %s, content_hash = %s, status = %s,
                    content_type = %s
                where id = %s
                """,
                (title, content, content_hash, status, content_type, document_id),
            )
            cur.execute("delete from chunks where document_id = %s", (document_id,))
            print(f"document updated: {document_id} ({source_url})")
        else:
            cur.execute(
                """
                insert into documents
                    (tenant_id, source_type, content_type, title, content,
                     content_hash, status, metadata)
                values (%s, 'website_crawl', %s, %s, %s, %s, %s, %s)
                returning id
                """,
                (tenant_id, content_type, title, content, content_hash, status, metadata),
            )
            document_id = cur.fetchone()[0]
            print(f"document created: {document_id} ({source_url})")

        embeddings = embed_batch(chunk_texts)
        for idx, (text, vector) in enumerate(zip(chunk_texts, embeddings)):
            vector_literal = "[" + ",".join(repr(v) for v in vector) + "]"
            cur.execute(
                """
                insert into chunks
                    (tenant_id, document_id, chunk_index, content, token_count, embedding)
                values (%s, %s, %s, %s, %s, %s::vector)
                """,
                (tenant_id, document_id, idx, text, count_tokens(text), vector_literal),
            )
        print(f"  embedded {len(chunk_texts)} chunks")


def ingest(sample_path: Path, auto_approve: bool = True) -> None:
    """FAQ-shaped sample: {tenant_slug, tenant_name, source_url, title, qa_pairs}."""
    data = json.loads(sample_path.read_text(encoding="utf-8"))

    tenant_id = get_or_create_tenant(data["tenant_slug"], data["tenant_name"])
    print(f"tenant: {data['tenant_name']} ({tenant_id})")

    document_text = build_document_text(data["qa_pairs"])
    _store_document(
        tenant_id,
        title=data["title"],
        source_url=data["source_url"],
        content=document_text,
        content_type="faq",
        chunk_texts=faq_chunks(data["qa_pairs"]),
        auto_approve=auto_approve,
    )
    print("done")


def ingest_pages(sample_path: Path, auto_approve: bool = True) -> None:
    """Generic prose pages: {tenant_slug, tenant_name, pages: [{source_url, title, content}]}."""
    data = json.loads(sample_path.read_text(encoding="utf-8"))

    tenant_id = get_or_create_tenant(data["tenant_slug"], data["tenant_name"])
    print(f"tenant: {data['tenant_name']} ({tenant_id})")

    for page in data["pages"]:
        _store_document(
            tenant_id,
            title=page["title"],
            source_url=page["source_url"],
            content=page["content"],
            content_type="page",
            chunk_texts=token_window_chunks(page["content"], max_tokens=600, overlap=100),
            auto_approve=auto_approve,
        )
    print("done")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("sample", type=Path, help="path to a sample JSON file")
    parser.add_argument(
        "--pages",
        action="store_true",
        help="sample file is the generic multi-page format, not FAQ qa_pairs",
    )
    parser.add_argument(
        "--stage-only",
        action="store_true",
        help="leave document as 'staged' instead of auto-approving",
    )
    args = parser.parse_args()

    if args.pages:
        ingest_pages(args.sample, auto_approve=not args.stage_only)
    else:
        ingest(args.sample, auto_approve=not args.stage_only)
