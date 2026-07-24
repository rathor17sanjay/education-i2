-- Non-superuser role for the student-facing query path.
-- The `postgres` role used elsewhere is a Supabase superuser and bypasses
-- RLS unconditionally -- see the NOTE in db.py. This role is what actually
-- makes the tenant_isolation_* policies from 0001_init_schema.sql matter:
-- it can only see rows matching whatever app.tenant_id is set for the
-- session, with no bypass.
--
-- Password set out-of-band (not embedded in this file); see backend/.env.

create role app_user with login password :'app_user_password';

grant usage on schema public to app_user;
grant select on tenants, documents, chunks, programme_fees to app_user;

-- Read-only is intentional: this role serves retrieval for the student-facing
-- assistant, which never writes. Ingestion/admin scripts keep using the
-- privileged DATABASE_URL connection.
