-- Extends the single-tier superadmin model from 0005 into two tiers:
-- platform-wide superadmins (tenant_id null) and university-level
-- tenant_admins (tenant_id set, scoped to that one tenant only -- can
-- upload/review documents for their own tenant, nothing else). The
-- tenant-scoped admin UI/routes are a deferred fast-follow, but the schema
-- is built now so that work doesn't need another migration later.

alter table platform_admins rename to admins;

alter table admins add column if not exists tenant_id uuid references tenants(id) on delete cascade;

alter table admins drop constraint if exists platform_admins_role_check;
alter table admins add constraint admins_role_check
    check (role in ('superadmin', 'tenant_admin'));

-- A superadmin has no tenant_id; a tenant_admin must have one. Keeps the
-- two tiers from ever being ambiguous at the data level.
alter table admins add constraint admins_role_tenant_id_check
    check (
        (role = 'superadmin' and tenant_id is null)
        or (role = 'tenant_admin' and tenant_id is not null)
    );

create index if not exists idx_admins_tenant on admins(tenant_id);

-- Existing rows predate the tenant_admin tier and are all superadmins by
-- definition (tenant_id already null, role already defaulted to
-- 'superadmin' -- this is a no-op today, just explicit for clarity).
update admins set role = 'superadmin' where tenant_id is null;
