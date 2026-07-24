-- Near-duplicate query cache (pgvector-backed rather than a separate Redis
-- service -- we already compute a question embedding for retrieval on every
-- query, and already have pgvector wired up, so no new infrastructure is
-- needed). A cache hit skips retrieval + both Claude calls entirely.

create table if not exists query_cache (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references tenants(id) on delete cascade,
    question_text   text not null,
    embedding       vector(384) not null,  -- matches chunks.embedding (local fastembed model, see 0002)
    response_json   jsonb not null,
    created_at      timestamptz not null default now()
);

create index if not exists idx_query_cache_tenant on query_cache(tenant_id);
create index if not exists idx_query_cache_embedding on query_cache
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table query_cache enable row level security;

create policy tenant_isolation_query_cache on query_cache
    using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Unlike the other tables, app_user needs INSERT here too: caching a fresh
-- answer happens on the student-facing request path itself, not just admin
-- ingestion.
grant select, insert on query_cache to app_user;
