"""Admin auth: verifies a Supabase-issued JWT and checks the caller is an
admin. Two tiers share this same verification path (backend/migrations/
0006_scoped_admins.sql): superadmin (tenant_id is None, platform-wide) and
tenant_admin (tenant_id set, scoped to that one tenant only). Routes pick
the right dependency below depending on which tier they need.

This project uses Supabase's newer publishable/secret API key format
(confirmed via the dashboard), which means session JWTs are signed with
asymmetric JWT signing keys, not the legacy shared HS256 secret -- so
verification fetches Supabase's public JWKS endpoint rather than decoding
against a static secret. No SUPABASE_JWT_SECRET needed; only SUPABASE_URL.
"""

import os

import jwt
from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel

from db import get_tenant_by_slug, tenant_connection


class AdminUser(BaseModel):
    id: str
    email: str
    role: str
    tenant_id: str | None = None


_jwk_client: jwt.PyJWKClient | None = None


def _get_jwk_client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        jwks_url = os.environ["SUPABASE_URL"].rstrip("/") + "/auth/v1/.well-known/jwks.json"
        _jwk_client = jwt.PyJWKClient(jwks_url, cache_keys=True)
    return _jwk_client


def _decode_supabase_jwt(token: str) -> dict:
    try:
        signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid or expired token")
    except jwt.PyJWKClientError:
        raise HTTPException(status_code=401, detail="could not verify token signature")


def _get_admin_by_auth_user_id(auth_user_id: str) -> AdminUser | None:
    with tenant_connection() as (conn, cur):
        cur.execute(
            "select id, email, role, tenant_id from admins where auth_user_id = %s",
            (auth_user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return AdminUser(
            id=str(row[0]),
            email=row[1],
            role=row[2],
            tenant_id=str(row[3]) if row[3] else None,
        )


def verify_admin(authorization: str = Header(...)) -> AdminUser:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")

    token = authorization.removeprefix("Bearer ")
    payload = _decode_supabase_jwt(token)

    auth_user_id = payload.get("sub")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="token missing subject")

    admin = _get_admin_by_auth_user_id(auth_user_id)
    if admin is None:
        raise HTTPException(status_code=403, detail="not an admin")

    return admin


def require_superadmin(admin: AdminUser = Depends(verify_admin)) -> AdminUser:
    """For platform-wide routes (tenant onboarding, cross-tenant management)
    -- a tenant_admin is a valid admin but not authorized here."""
    if admin.tenant_id is not None:
        raise HTTPException(status_code=403, detail="superadmin access required")
    return admin


def require_tenant_access(tenant_slug: str):
    """Dependency factory for the (future) tenant-scoped admin routes --
    /api/{tenant_slug}/admin/... A superadmin can access any tenant; a
    tenant_admin only their own."""

    def _check(admin: AdminUser = Depends(verify_admin)) -> AdminUser:
        if admin.tenant_id is None:
            return admin  # superadmin: unrestricted

        tenant_id, _ = get_tenant_by_slug(tenant_slug)
        if admin.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="not an admin for this tenant")
        return admin

    return _check
