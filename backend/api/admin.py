"""Superadmin API: tenant onboarding and document/upload management.
Every route here depends on verify_admin (api/auth.py) -- mounted under
/api/admin in main.py.
"""

from fastapi import APIRouter, Depends

from api.auth import AdminUser, verify_admin

router = APIRouter()


@router.get("/me")
def me(admin: AdminUser = Depends(verify_admin)) -> AdminUser:
    return admin
