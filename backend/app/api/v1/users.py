import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, DbSession, require_role
from app.modules.users.models import UserRole
from app.modules.users.schemas import UserCreate, UserOut, UserUpdate
from app.modules.users.service import UserService

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.get("", response_model=list[UserOut])
async def list_users(
    db: DbSession, _: Annotated[object, Depends(require_role(UserRole.qa_lead))]
) -> list[UserOut]:
    users = await UserService(db).list()
    return [UserOut.model_validate(u) for u in users]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate, db: DbSession, _: Annotated[object, Depends(require_role(UserRole.super_admin))]
) -> UserOut:
    u = await UserService(db).create(payload)
    return UserOut.model_validate(u)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: DbSession,
    _: Annotated[object, Depends(require_role(UserRole.super_admin))],
) -> UserOut:
    u = await UserService(db).update(user_id, payload)
    return UserOut.model_validate(u)
