import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import tenant_connection, to_vector_literal
from ingestion.embed import embed_batch


def retrieve(
    tenant_id: str,
    question: str,
    top_k: int = 5,
    *,
    question_embedding: list[float] | None = None,
) -> list[dict]:
    """Top-k chunks for this tenant, ranked by cosine distance to the question.

    tenant_id is filtered explicitly here (not just relied on via RLS) --
    per CLAUDE.md, retrieval must be tenant-scoped server-side regardless
    of what the connection role enforces.

    question_embedding lets a caller that already embedded the question
    (e.g. for a cache lookup) pass it straight through instead of paying
    for a second embedding call.
    """
    query_vector = question_embedding if question_embedding is not None else embed_batch([question])[0]
    vector_literal = to_vector_literal(query_vector)

    with tenant_connection(tenant_id, restricted=True) as (conn, cur):
        cur.execute(
            """
            select c.content, c.embedding <=> %s::vector as distance,
                   d.title, d.source_type
            from chunks c
            join documents d on d.id = c.document_id
            where c.tenant_id = %s and d.status = 'approved'
            order by c.embedding <=> %s::vector
            limit %s
            """,
            (vector_literal, tenant_id, vector_literal, top_k),
        )
        rows = cur.fetchall()

    return [
        {"content": r[0], "distance": r[1], "document_title": r[2], "source_type": r[3]}
        for r in rows
    ]
