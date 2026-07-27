-- Superadmin platform tables: who's allowed into the admin dashboard, and
-- the async processing queue for document uploads (PDF/docx/pptx OCR +
-- embedding can take tens of seconds, so uploads can't be handled inline in
-- the request/response cycle). A Postgres table instead of Celery/Redis --
-- matches CLAUDE.md's own stated Phase-0 preference to avoid new
-- infrastructure until real scale demands it.

-- ---------------------------------------------------------------------------
-- platform_admins
-- Maps a Supabase Auth user to admin access. Only read via the backend's
-- privileged DB connection (never from browser-side Supabase calls), so RLS
-- below is a deny-all rather than a tenant-scoped policy.
-- ---------------------------------------------------------------------------
create table if not exists platform_admins (
    id              uuid primary key default gen_random_uuid(),
    auth_user_id    uuid not null unique,   -- Supabase auth.users.id -- no FK, that schema is Supabase-managed
    email           text not null unique,
    role            text not null default 'superadmin' check (role in ('superadmin')),
    created_at      timestamptz not null default now()
);

alter table platform_admins enable row level security;

create policy deny_all_platform_admins on platform_admins
    using (false);

-- ---------------------------------------------------------------------------
-- ingestion_jobs
-- One row per admin-triggered upload (PDF/docx/pptx/pasted text). Written by
-- the /api/admin/tenants/{id}/uploads endpoint, progressed by a
-- BackgroundTasks handler, polled by the frontend until done/failed.
-- ---------------------------------------------------------------------------
create table if not exists ingestion_jobs (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references tenants(id) on delete cascade,
    status              text not null default 'pending'
                            check (status in ('pending', 'processing', 'done', 'failed')),
    source_kind         text not null check (source_kind in ('pdf', 'docx', 'pptx', 'text')),
    title               text not null,
    original_filename   text,                        -- null for pasted-text jobs
    error_message       text,
    document_id         uuid references documents(id),  -- set once store_document succeeds
    requested_by        uuid references platform_admins(id),
    auto_approve        boolean not null default false,
    created_at          timestamptz not null default now(),
    started_at          timestamptz,
    finished_at         timestamptz
);

create index if not exists idx_ingestion_jobs_tenant_status on ingestion_jobs(tenant_id, status);

alter table ingestion_jobs enable row level security;

create policy tenant_isolation_ingestion_jobs on ingestion_jobs
    using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Admin API always uses the privileged DATABASE_URL connection (bypasses
-- RLS), same as the rest of the ingestion pipeline -- the policy above is
-- defense-in-depth/schema consistency, not something app_user relies on.
