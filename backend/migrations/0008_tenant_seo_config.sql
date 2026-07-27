-- Per-tenant search-optimization defaults (SEO/AEO/GEO metadata), captured
-- by superadmin for now and intended to feed the actual generated
-- AI-answer pages later (CLAUDE.md's "every query becomes its own
-- addressable, SEO-indexable URL" design). Kept separate from `theme`
-- (branding) since it's a different concern, even though both are jsonb
-- for the same reason: a flexible, evolving set of fields we don't want a
-- migration for every time a new one gets added.
alter table tenants add column if not exists seo_config jsonb not null default '{}'::jsonb;
