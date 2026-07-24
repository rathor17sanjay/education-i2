-- Phase 0 / Step 1: core multi-tenant schema
-- tenants, documents, chunks (pgvector), programme_fees (structured extracts)
-- RLS enforced from the first migration, even with a single pilot tenant.

create extension if not exists vector;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create table if not exists tenants (
    id              uuid primary key default gen_random_uuid(),
    slug            text not null unique,          -- e.g. "sharda", used in subdomain/path routing
    name            text not null,
    status          text not null default 'trial'
                        check (status in ('trial', 'active', 'past_due', 'suspended', 'churned')),
    plan_tier       text not null default 'pilot',
    theme           jsonb not null default '{}'::jsonb,  -- primary/secondary/accent, font, logo, tone
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- documents  (clean/structured content layer)
-- ---------------------------------------------------------------------------
create table if not exists documents (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references tenants(id) on delete cascade,
    source_type     text not null,                 -- 'website_crawl' | 'upload' | 'manual_faq' | 'manual_note' | 'announcement'
    content_type    text not null default 'note',   -- 'faq' | 'announcement' | 'fact' | 'note' | 'page'
    title           text,
    content         text not null,                  -- parsed clean text
    raw_path        text,                            -- pointer into object storage: {tenant_id}/raw/{source_type}/{page_hash}/{ts}
    content_hash    text,                            -- for diff detection on re-crawl
    status          text not null default 'staged'
                        check (status in ('staged', 'approved', 'archived')),
    metadata        jsonb not null default '{}'::jsonb,
    expires_at      timestamptz,                     -- for announcements
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_documents_tenant_status on documents(tenant_id, status);
create index if not exists idx_documents_tenant_hash on documents(tenant_id, content_hash);

-- ---------------------------------------------------------------------------
-- chunks  (embedded layer — only thing the assistant actually searches)
-- text-embedding-3-small => 1536 dims
-- ---------------------------------------------------------------------------
create table if not exists chunks (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references tenants(id) on delete cascade,
    document_id     uuid not null references documents(id) on delete cascade,
    chunk_index     int not null,
    content         text not null,
    token_count     int,
    embedding       vector(1536),
    created_at      timestamptz not null default now()
);

create index if not exists idx_chunks_tenant on chunks(tenant_id);
create index if not exists idx_chunks_document on chunks(document_id);
-- ANN index for cosine similarity search, scoped per query by tenant_id filter
create index if not exists idx_chunks_embedding on chunks
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- programme_fees  (structured extracts — hard numbers, not RAG'd from prose)
-- ---------------------------------------------------------------------------
create table if not exists programme_fees (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references tenants(id) on delete cascade,
    programme_name  text not null,
    fee_type        text not null,                   -- 'tuition' | 'hostel' | 'application' | ...
    amount          numeric(12, 2) not null,
    currency        text not null default 'INR',
    academic_year   text,
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_programme_fees_tenant on programme_fees(tenant_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Backend sets the current tenant per request/transaction via:
--   set local app.tenant_id = '<uuid>';
-- Policies fall back to no rows when app.tenant_id is unset (safer default
-- than leaking cross-tenant data if a caller forgets to set it).
-- ---------------------------------------------------------------------------
alter table tenants enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;
alter table programme_fees enable row level security;

-- tenants: a tenant can only see its own row
create policy tenant_isolation_tenants on tenants
    using (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_documents on documents
    using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_chunks on chunks
    using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_programme_fees on programme_fees
    using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_tenants_updated_at before update on tenants
    for each row execute function set_updated_at();
create trigger trg_documents_updated_at before update on documents
    for each row execute function set_updated_at();
create trigger trg_programme_fees_updated_at before update on programme_fees
    for each row execute function set_updated_at();
