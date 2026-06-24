import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.modules.auth_vault.service import TokenProfileIn, TokenProfileOut, TokenVaultService

router = APIRouter()


@router.get("", response_model=list[TokenProfileOut])
async def list_profiles(db: DbSession, _: CurrentUser) -> list[TokenProfileOut]:
    svc = TokenVaultService(db)
    return [svc.to_out(p) for p in await svc.list()]


@router.post("", response_model=TokenProfileOut, status_code=201)
async def create_profile(payload: TokenProfileIn, db: DbSession, _: CurrentUser) -> TokenProfileOut:
    svc = TokenVaultService(db)
    return svc.to_out(await svc.create(payload))


@router.post("/{profile_id}/refresh", response_model=TokenProfileOut)
async def refresh_profile(profile_id: uuid.UUID, db: DbSession, _: CurrentUser) -> TokenProfileOut:
    svc = TokenVaultService(db)
    prof = await svc.get(profile_id)
    await svc.get_access_token(prof, force_refresh=True)
    return svc.to_out(prof)


@router.delete("/{profile_id}", status_code=204)
async def delete_profile(profile_id: uuid.UUID, db: DbSession, _: CurrentUser) -> None:
    await TokenVaultService(db).delete(profile_id)
