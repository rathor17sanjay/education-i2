"""Phase 0 API: wraps rag.query.answer() behind HTTP.

Tenant is resolved from the URL path, never trusted from a request body --
matches CLAUDE.md's "tenant resolved from subdomain/path at request entry"
requirement. Path-based for now since there's no domain/subdomain routing
yet (that's deferred to Phase 1 alongside nginx + SSL); the same resolution
point moves to subdomain parsing later without changing anything downstream.
"""

import json
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import get_tenant_by_slug
from rag.cache import get_recent_questions
from rag.query import answer, answer_stream

app = FastAPI(title="GT CampusAI Query API")

# Phase 0: no frontend origin to restrict to yet. Tighten this once the
# Next.js frontend (task #5) has a real origin, and again per-tenant once
# the theming/branding engine (Phase 1) is in place.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/{tenant_slug}/popular-questions")
def popular_questions(tenant_slug: str, limit: int = 4):
    try:
        tenant_id, _ = get_tenant_by_slug(tenant_slug)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"unknown tenant: {tenant_slug}")
    return {"questions": get_recent_questions(tenant_id, limit=limit)}


@app.post("/api/{tenant_slug}/query")
def query(tenant_slug: str, req: QueryRequest):
    try:
        return answer(tenant_slug, req.question, top_k=req.top_k)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"unknown tenant: {tenant_slug}")


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_events(tenant_slug: str, question: str, top_k: int):
    # Chrome's fetch()/ReadableStream buffers small streamed responses
    # internally and won't flush anything to JS until enough bytes have
    # accumulated -- our title event alone (~200 bytes) is well under that
    # threshold, so it silently gets held back and delivered together with
    # the much-later blocks event, hiding the progressive-loading UX.
    # Padding the very first message past ~2KB forces an immediate flush.
    yield ":" + " " * 2048 + "\n\n"

    t0 = time.monotonic()
    try:
        for phase, payload in answer_stream(tenant_slug, question, top_k=top_k):
            print(f"[timing] {phase} ready at {time.monotonic() - t0:.2f}s", flush=True)
            yield _sse_event(phase, payload)
    except ValueError:
        yield _sse_event("error", {"detail": f"unknown tenant: {tenant_slug}"})
    except Exception as e:
        yield _sse_event("error", {"detail": str(e)})


@app.post("/api/{tenant_slug}/query/stream")
def query_stream(tenant_slug: str, req: QueryRequest):
    return StreamingResponse(
        _stream_events(tenant_slug, req.question, req.top_k),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
