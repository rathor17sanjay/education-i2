import os
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv
from psycopg2.pool import ThreadedConnectionPool

load_dotenv()

# One pool per role (DATABASE_URL = privileged admin/ingestion, APP_DATABASE_URL
# = restricted app_user for the student-facing path) -- each API worker process
# holds its own pools, created lazily on first use. Replaces the old
# "psycopg2.connect() fresh per call" pattern, which meant every single query
# paid a full TCP+TLS+Postgres-auth handshake, sometimes twice (tenant lookup
# + retrieval) or three times once the query cache added its own lookup.
_pools: dict[str, ThreadedConnectionPool] = {}


def _get_pool(env_var: str) -> ThreadedConnectionPool:
    if env_var not in _pools:
        _pools[env_var] = ThreadedConnectionPool(1, 10, os.environ[env_var])
    return _pools[env_var]


@contextmanager
def tenant_connection(tenant_id: str | None = None, *, restricted: bool = False):
    """Connection scoped to one tenant for the duration of the transaction.

    Sets app.tenant_id via `set local` so the RLS policies from
    0001_init_schema.sql apply automatically to every query on this
    connection. Pass tenant_id=None for tenant-provisioning operations
    (e.g. creating a new tenant row), which RLS allows separately.

    restricted=True connects as `app_user` (see 0003_app_role.sql) --
    non-superuser, actually subject to RLS -- instead of the `postgres`
    superuser that ingestion/admin scripts use, which bypasses RLS
    unconditionally. Any code path that serves a student-facing request
    (i.e. rag/retrieve.py, rag/cache.py) must use restricted=True.

    Pulls a connection from a pool rather than opening a fresh one; SET
    LOCAL is transaction-scoped and we always commit/rollback before
    returning the connection to the pool, so nothing leaks between
    checkouts of the same underlying connection.
    """
    env_var = "APP_DATABASE_URL" if restricted else "DATABASE_URL"
    pool = _get_pool(env_var)
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if tenant_id is not None:
                cur.execute("set local app.tenant_id = %s", (tenant_id,))
            yield conn, cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


class TenantAlreadyExists(Exception):
    pass


def create_tenant(slug: str, name: str) -> str:
    """Explicit admin "create tenant" action -- unlike get_or_create_tenant
    (used by ingestion scripts, where "already exists" is a harmless no-op),
    a superadmin creating a tenant with a slug that's already taken is a
    real conflict, not something to silently paper over."""
    with tenant_connection() as (conn, cur):
        cur.execute("select id from tenants where slug = %s", (slug,))
        if cur.fetchone():
            raise TenantAlreadyExists(slug)

        cur.execute(
            "insert into tenants (slug, name) values (%s, %s) returning id",
            (slug, name),
        )
        return str(cur.fetchone()[0])


def get_or_create_tenant(slug: str, name: str) -> str:
    """Tenant provisioning runs with no app.tenant_id set, via the
    privileged `postgres` connection -- admin/ingestion operations are
    trusted and not part of the student-facing request path.
    """
    with tenant_connection() as (conn, cur):
        cur.execute("select id from tenants where slug = %s", (slug,))
        row = cur.fetchone()
        if row:
            return str(row[0])

        cur.execute(
            "insert into tenants (slug, name) values (%s, %s) returning id",
            (slug, name),
        )
        return str(cur.fetchone()[0])


def to_vector_literal(vector: list[float]) -> str:
    """pgvector's text input format, e.g. '[0.1,0.2,...]'."""
    return "[" + ",".join(repr(v) for v in vector) + "]"


def get_tenant_by_slug(slug: str) -> tuple[str, str]:
    """Resolve slug -> (tenant_id, name) on the privileged connection.

    This is a routing lookup, not a data-access path: it runs *before* a
    request's tenant_id is known (the tenants RLS policy requires knowing
    the id already, so it can't gate this step), and only returns the
    non-sensitive id/name a subdomain/path already implies. Everything
    downstream of this (chunks, documents, query_cache) goes through the
    restricted connection once the tenant_id is resolved.
    """
    with tenant_connection() as (conn, cur):
        cur.execute("select id, name from tenants where slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"no tenant with slug={slug!r}")
        return str(row[0]), row[1]
