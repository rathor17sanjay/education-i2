"""Platform-wide superadmin API: tenant onboarding and management. Every
route depends on require_superadmin -- a tenant_admin (once that tier
exists) is a valid admin but not authorized here. Mounted at /api/superadmin
in main.py.
"""

import json
import os
import tempfile

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from api.auth import AdminUser, require_superadmin
from db import TenantAlreadyExists, create_tenant, tenant_connection
from ingestion.chunker import token_window_chunks
from ingestion.extract import extract_by_kind
from ingestion.ingest import store_document

router = APIRouter()

# Branding fields live inside tenants.theme (jsonb), not their own columns --
# that column already existed for exactly this (CLAUDE.md's per-tenant
# theming design). SEO/AEO/GEO fields live in the separate tenants.seo_config
# jsonb (different concern, own column -- see migration 0008). Both get
# flattened to the top level of the Tenant response so the frontend doesn't
# need to know about the storage detail.
_THEME_FIELDS = {
    "logo_url", "icon_url", "brand_name", "primary_color", "secondary_color", "gtm_id",
    "headline", "subheadline",
}
# AEO/GEO fields (short answer, FAQs, sources, AI summary, etc.) were dropped
# from here -- those describe one specific generated page, not a whole
# tenant, so a single static value per tenant can't represent them. They'll
# be auto-derived per /ai/q/{slug} page from the AI's own output instead.
# Author/Reviewer survive as the two fields that genuinely are tenant-wide.
_SEO_FIELDS = {
    # SEO
    "seo_title", "meta_description", "canonical_url", "robots", "schema_type",
    "social_metadata",
    # GEO (author/reviewer trust signals -- tenant-wide, unlike the rest of GEO)
    "author", "reviewer",
}
_PLAIN_COLUMNS = {"name", "status", "plan_tier", "website_url", "slug"}

# A tenant is only slug-editable before it's "live" -- once real students
# could be hitting /api/{slug}/query for it, changing the slug would break
# whatever's already pointed at that URL.
_SLUG_EDITABLE_STATUSES = {"trial"}


class Tenant(BaseModel):
    id: str
    slug: str
    name: str
    status: str
    plan_tier: str
    website_url: str | None = None
    logo_url: str | None = None
    icon_url: str | None = None
    brand_name: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    gtm_id: str | None = None
    headline: str | None = None
    subheadline: str | None = None
    # SEO
    seo_title: str | None = None
    meta_description: str | None = None
    canonical_url: str | None = None
    robots: str | None = None
    schema_type: str | None = None
    social_metadata: str | None = None
    # GEO (tenant-wide trust signals; the rest of AEO/GEO is per-page, see
    # _SEO_FIELDS comment above)
    author: str | None = None
    reviewer: str | None = None


class CreateTenantRequest(BaseModel):
    slug: str
    name: str
    website_url: str | None = None


class UpdateTenantRequest(BaseModel):
    slug: str | None = None
    name: str | None = None
    status: str | None = None
    plan_tier: str | None = None
    website_url: str | None = None
    logo_url: str | None = None
    icon_url: str | None = None
    brand_name: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    gtm_id: str | None = None
    headline: str | None = None
    subheadline: str | None = None
    seo_title: str | None = None
    meta_description: str | None = None
    canonical_url: str | None = None
    robots: str | None = None
    schema_type: str | None = None
    social_metadata: str | None = None
    author: str | None = None
    reviewer: str | None = None


_TENANT_COLUMNS = "id, slug, name, status, plan_tier, website_url, theme, seo_config"


def _tenant_from_row(row) -> Tenant:
    theme = row[6] or {}
    seo = row[7] or {}
    return Tenant(
        id=str(row[0]), slug=row[1], name=row[2], status=row[3], plan_tier=row[4],
        website_url=row[5],
        logo_url=theme.get("logo_url"),
        icon_url=theme.get("icon_url"),
        brand_name=theme.get("brand_name"),
        primary_color=theme.get("primary_color"),
        secondary_color=theme.get("secondary_color"),
        gtm_id=theme.get("gtm_id"),
        headline=theme.get("headline"),
        subheadline=theme.get("subheadline"),
        **{field: seo.get(field) for field in _SEO_FIELDS},
    )


@router.get("/tenants")
def list_tenants(admin: AdminUser = Depends(require_superadmin)) -> list[Tenant]:
    with tenant_connection() as (conn, cur):
        cur.execute(f"select {_TENANT_COLUMNS} from tenants order by created_at desc")
        return [_tenant_from_row(r) for r in cur.fetchall()]


@router.post("/tenants", status_code=201)
def create_tenant_route(
    req: CreateTenantRequest, admin: AdminUser = Depends(require_superadmin)
) -> Tenant:
    try:
        tenant_id = create_tenant(req.slug, req.name)
    except TenantAlreadyExists:
        raise HTTPException(status_code=409, detail=f"slug already exists: {req.slug}")

    if req.website_url:
        with tenant_connection() as (conn, cur):
            cur.execute(
                "update tenants set website_url = %s where id = %s", (req.website_url, tenant_id)
            )

    return Tenant(
        id=tenant_id, slug=req.slug, name=req.name, status="trial", plan_tier="pilot",
        website_url=req.website_url,
    )


@router.get("/tenants/{tenant_id}")
def get_tenant(tenant_id: str, admin: AdminUser = Depends(require_superadmin)) -> Tenant:
    with tenant_connection() as (conn, cur):
        cur.execute(f"select {_TENANT_COLUMNS} from tenants where id = %s", (tenant_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="tenant not found")
        return _tenant_from_row(row)


@router.patch("/tenants/{tenant_id}")
def update_tenant(
    tenant_id: str, req: UpdateTenantRequest, admin: AdminUser = Depends(require_superadmin)
) -> Tenant:
    fields = req.model_dump(exclude_unset=True)
    if not fields:
        return get_tenant(tenant_id, admin)

    plain_fields = {k: v for k, v in fields.items() if k in _PLAIN_COLUMNS}
    theme_fields = {k: v for k, v in fields.items() if k in _THEME_FIELDS}
    seo_fields = {k: v for k, v in fields.items() if k in _SEO_FIELDS}

    with tenant_connection() as (conn, cur):
        if "slug" in plain_fields:
            cur.execute("select status, slug from tenants where id = %s", (tenant_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="tenant not found")
            current_status, current_slug = row
            if plain_fields["slug"] != current_slug and current_status not in _SLUG_EDITABLE_STATUSES:
                raise HTTPException(
                    status_code=400,
                    detail=f"cannot change slug once tenant status is {current_status!r}",
                )

        if plain_fields:
            set_clause = ", ".join(f"{k} = %s" for k in plain_fields)
            cur.execute(
                f"update tenants set {set_clause} where id = %s returning id",
                (*plain_fields.values(), tenant_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="tenant not found")

        if theme_fields:
            cur.execute(
                "update tenants set theme = theme || %s::jsonb where id = %s returning id",
                (json.dumps(theme_fields), tenant_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="tenant not found")

        if seo_fields:
            cur.execute(
                "update tenants set seo_config = seo_config || %s::jsonb where id = %s "
                "returning id",
                (json.dumps(seo_fields), tenant_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="tenant not found")

        cur.execute(f"select {_TENANT_COLUMNS} from tenants where id = %s", (tenant_id,))
        return _tenant_from_row(cur.fetchone())


_ASSET_KINDS = {"logo", "icon"}


@router.post("/tenants/{tenant_id}/assets")
async def upload_tenant_asset(
    tenant_id: str,
    kind: str = Form(...),
    file: UploadFile = File(...),
    admin: AdminUser = Depends(require_superadmin),
) -> Tenant:
    """Local-disk storage for now (see docker-compose.yml's uploads_data
    volume) -- moving to S3 later only changes where the bytes land, not
    this URL shape or the theme_fields update below."""
    _require_tenant_exists(tenant_id)
    if kind not in _ASSET_KINDS:
        raise HTTPException(status_code=400, detail=f"unsupported asset kind: {kind}")

    ext = os.path.splitext(file.filename or "")[1] or ".png"
    rel_dir = f"tenant-assets/{tenant_id}"
    os.makedirs(f"uploads/{rel_dir}", exist_ok=True)
    rel_path = f"{rel_dir}/{kind}{ext}"

    with open(f"uploads/{rel_path}", "wb") as f:
        f.write(await file.read())

    theme_field = f"{kind}_url"
    with tenant_connection() as (conn, cur):
        cur.execute(
            "update tenants set theme = theme || %s::jsonb where id = %s returning "
            + _TENANT_COLUMNS,
            (json.dumps({theme_field: f"/uploads/{rel_path}"}), tenant_id),
        )
        return _tenant_from_row(cur.fetchone())


class Document(BaseModel):
    id: str
    title: str | None
    content_type: str
    source_type: str
    status: str


@router.get("/tenants/{tenant_id}/documents")
def list_documents(
    tenant_id: str,
    status: str | None = None,
    admin: AdminUser = Depends(require_superadmin),
) -> list[Document]:
    _require_tenant_exists(tenant_id)
    with tenant_connection() as (conn, cur):
        if status:
            cur.execute(
                "select id, title, content_type, source_type, status from documents "
                "where tenant_id = %s and status = %s order by created_at desc",
                (tenant_id, status),
            )
        else:
            cur.execute(
                "select id, title, content_type, source_type, status from documents "
                "where tenant_id = %s order by created_at desc",
                (tenant_id,),
            )
        return [
            Document(id=str(r[0]), title=r[1], content_type=r[2], source_type=r[3], status=r[4])
            for r in cur.fetchall()
        ]


def _set_document_status(tenant_id: str, document_id: str, status: str) -> Document:
    with tenant_connection() as (conn, cur):
        cur.execute(
            "update documents set status = %s where id = %s and tenant_id = %s "
            "returning id, title, content_type, source_type, status",
            (status, document_id, tenant_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="document not found")
        return Document(id=str(row[0]), title=row[1], content_type=row[2], source_type=row[3], status=row[4])


@router.post("/tenants/{tenant_id}/documents/{document_id}/approve")
def approve_document(
    tenant_id: str, document_id: str, admin: AdminUser = Depends(require_superadmin)
) -> Document:
    return _set_document_status(tenant_id, document_id, "approved")


@router.post("/tenants/{tenant_id}/documents/{document_id}/archive")
def archive_document(
    tenant_id: str, document_id: str, admin: AdminUser = Depends(require_superadmin)
) -> Document:
    return _set_document_status(tenant_id, document_id, "archived")


class UploadJob(BaseModel):
    id: str
    status: str
    error_message: str | None
    document_id: str | None


def _require_tenant_exists(tenant_id: str) -> None:
    with tenant_connection() as (conn, cur):
        cur.execute("select 1 from tenants where id = %s", (tenant_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="tenant not found")


def run_ingestion_job(job_id: str, tmp_path: str | None, pasted_text: str | None) -> None:
    """Runs via BackgroundTasks -- FastAPI executes sync background tasks in
    a threadpool, so this doesn't block the event loop despite doing
    blocking I/O (file extraction, OCR, embedding calls). Deliberately not
    Celery/Redis at this stage -- see CLAUDE.md's own stated Phase-0
    preference and the plan's note on this tradeoff (a worker crash mid-job
    leaves it stuck at 'processing' forever; acceptable for v1, a stuck-job
    sweep is a good follow-up, not built now).
    """
    with tenant_connection() as (conn, cur):
        cur.execute(
            "select tenant_id, source_kind, title, auto_approve from ingestion_jobs where id = %s",
            (job_id,),
        )
        tenant_id, source_kind, title, auto_approve = cur.fetchone()
        cur.execute(
            "update ingestion_jobs set status = 'processing', started_at = now() where id = %s",
            (job_id,),
        )

    try:
        content = pasted_text if source_kind == "text" else extract_by_kind(tmp_path, source_kind)
        chunk_texts = token_window_chunks(content, max_tokens=600, overlap=100)
        document_id = store_document(
            str(tenant_id),
            title=title,
            source_url=f"upload:{job_id}",
            content=content,
            content_type=source_kind,
            chunk_texts=chunk_texts,
            auto_approve=auto_approve,
            source_type="upload",
        )
        with tenant_connection() as (conn, cur):
            cur.execute(
                "update ingestion_jobs set status = 'done', document_id = %s, finished_at = now() "
                "where id = %s",
                (document_id, job_id),
            )
    except Exception as e:
        with tenant_connection() as (conn, cur):
            cur.execute(
                "update ingestion_jobs set status = 'failed', error_message = %s, "
                "finished_at = now() where id = %s",
                (str(e)[:2000], job_id),
            )
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@router.post("/tenants/{tenant_id}/uploads", status_code=202)
async def create_upload(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    source_kind: str = Form(...),
    auto_approve: bool = Form(False),
    file: UploadFile | None = File(None),
    pasted_text: str | None = Form(None),
    admin: AdminUser = Depends(require_superadmin),
) -> dict:
    _require_tenant_exists(tenant_id)

    if source_kind not in ("pdf", "docx", "pptx", "text"):
        raise HTTPException(status_code=400, detail=f"unsupported source_kind: {source_kind}")
    if source_kind == "text" and not pasted_text:
        raise HTTPException(status_code=400, detail="pasted_text is required for source_kind=text")
    if source_kind != "text" and file is None:
        raise HTTPException(status_code=400, detail=f"file is required for source_kind={source_kind}")

    tmp_path = None
    if file is not None:
        suffix = os.path.splitext(file.filename or "")[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

    with tenant_connection() as (conn, cur):
        cur.execute(
            """
            insert into ingestion_jobs
                (tenant_id, source_kind, title, original_filename, requested_by, auto_approve)
            values (%s, %s, %s, %s, %s, %s)
            returning id
            """,
            (
                tenant_id,
                source_kind,
                title,
                file.filename if file else None,
                admin.id,
                auto_approve,
            ),
        )
        job_id = str(cur.fetchone()[0])

    background_tasks.add_task(run_ingestion_job, job_id, tmp_path, pasted_text)
    return {"job_id": job_id}


@router.get("/tenants/{tenant_id}/uploads/{job_id}")
def get_upload_job(
    tenant_id: str, job_id: str, admin: AdminUser = Depends(require_superadmin)
) -> UploadJob:
    with tenant_connection() as (conn, cur):
        cur.execute(
            "select id, status, error_message, document_id from ingestion_jobs "
            "where id = %s and tenant_id = %s",
            (job_id, tenant_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="job not found")
        return UploadJob(
            id=str(row[0]),
            status=row[1],
            error_message=row[2],
            document_id=str(row[3]) if row[3] else None,
        )
