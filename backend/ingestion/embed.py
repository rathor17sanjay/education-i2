"""Embedding backend, switchable via EMBEDDING_PROVIDER env var.

Decided stack (CLAUDE.md) is OpenAI text-embedding-3-small (1536 dims).
"local" is a temporary Phase 0 dev-mode fallback (fastembed, 384 dims,
no API key/cost) for use until OpenAI billing is set up -- see
migrations/0002_dev_local_embeddings_384.sql.
"""

import os

_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "openai")

_openai_client = None
_local_model = None


def _embed_openai(texts: list[str]) -> list[list[float]]:
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI

        _openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    response = _openai_client.embeddings.create(
        model="text-embedding-3-small", input=texts
    )
    return [item.embedding for item in response.data]


def _embed_local(texts: list[str]) -> list[list[float]]:
    global _local_model
    if _local_model is None:
        from fastembed import TextEmbedding

        _local_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

    return [vec.tolist() for vec in _local_model.embed(texts)]


def embed_batch(texts: list[str]) -> list[list[float]]:
    if _PROVIDER == "local":
        return _embed_local(texts)
    return _embed_openai(texts)
