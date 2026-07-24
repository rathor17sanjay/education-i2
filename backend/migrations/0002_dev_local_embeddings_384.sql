-- TEMPORARY Phase 0 dev-mode change: not yet subscribed to OpenAI API, so
-- embeddings are generated locally via fastembed (BAAI/bge-small-en-v1.5,
-- 384 dims) instead of text-embedding-3-small (1536 dims) per CLAUDE.md's
-- decided stack. chunks.embedding is resized to match.
--
-- MUST be reverted (new migration back to vector(1536), all chunks
-- re-embedded and re-inserted) once real OpenAI billing is set up --
-- embeddings from different models/dimensions are not interchangeable.

drop index if exists idx_chunks_embedding;

alter table chunks
    alter column embedding type vector(384);

create index if not exists idx_chunks_embedding on chunks
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);
