"""Near-duplicate query cache, backed by pgvector (see 0004_query_cache.sql)
rather than a separate Redis service -- we already compute a question
embedding for retrieval on every query, and already have pgvector wired up,
so no new infrastructure is needed for this.

A cache hit skips retrieval + both Claude calls entirely. Distance threshold
is deliberately tight: a false-positive hit (returning a cached answer for a
genuinely different question) is a correctness bug, worse than a cache miss.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import tenant_connection, to_vector_literal

DISTANCE_THRESHOLD = 0.08


def get_cached_response(tenant_id: str, question_embedding: list[float]) -> dict | None:
    vector_literal = to_vector_literal(question_embedding)

    with tenant_connection(tenant_id, restricted=True) as (conn, cur):
        cur.execute(
            """
            select response_json, embedding <=> %s::vector as distance
            from query_cache
            where tenant_id = %s
            order by embedding <=> %s::vector
            limit 1
            """,
            (vector_literal, tenant_id, vector_literal),
        )
        row = cur.fetchone()

    if row and row[1] <= DISTANCE_THRESHOLD:
        return row[0]
    return None


def store_response(
    tenant_id: str, question: str, question_embedding: list[float], response: dict
) -> None:
    vector_literal = to_vector_literal(question_embedding)

    with tenant_connection(tenant_id, restricted=True) as (conn, cur):
        cur.execute(
            """
            insert into query_cache (tenant_id, question_text, embedding, response_json)
            values (%s, %s, %s::vector, %s)
            """,
            (tenant_id, question, vector_literal, json.dumps(response)),
        )


def get_recent_questions(tenant_id: str, limit: int = 4) -> list[str]:
    """Real questions people have actually asked, most recent first.

    query_cache only grows on a cache *miss* (see get_cached_response /
    query.answer_stream) -- a hit never inserts a row -- so entries here are
    already distinct enough (>0.08 cosine distance apart) that no extra
    dedup is needed. Recency is used as a simple stand-in for "popular"
    without adding a hit-count column; good enough for a starter-questions
    list, not meant to be a real analytics feature.
    """
    with tenant_connection(tenant_id, restricted=True) as (conn, cur):
        # DISTINCT ON collapses exact-text duplicates (can happen if two
        # requests for the same brand-new question race each other before
        # either finishes caching -- a known minor edge case, not worth a
        # locking fix for a cosmetic starter-questions list), keeping each
        # question's most recent occurrence, then re-sorts by recency.
        cur.execute(
            """
            select question_text from (
                select distinct on (question_text) question_text, created_at
                from query_cache
                where tenant_id = %s
                order by question_text, created_at desc
            ) deduped
            order by created_at desc
            limit %s
            """,
            (tenant_id, limit),
        )
        return [row[0] for row in cur.fetchall()]
