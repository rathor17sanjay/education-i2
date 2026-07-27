-- Tenants didn't previously store the university's own website -- needed so
-- a superadmin can quickly reference the source site while deciding what
-- content to upload, and so the tenants list can offer a direct link to it.
alter table tenants add column if not exists website_url text;
