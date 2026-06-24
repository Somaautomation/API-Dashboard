"""FastAPI dependencies: DB session, current user, RBAC guard."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthError, ForbiddenError
from app.core.security import decode_token
from app.db.session import get_session
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    db: DbSession,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("Missing bearer token")
    try:
        payload = decode_token(authorization.split(" ", 1)[1])
    except Exception as exc:
        raise AuthError(f"Invalid token: {exc}") from exc
    if payload.get("type") != "access":
        raise AuthError("Wrong token type")
    user = await UserService(db).get(uuid.UUID(payload["sub"]))
    if not user.is_active:
        raise AuthError("User disabled")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    """Dependency factory that allows only the listed roles."""
    allowed = set(roles) | {UserRole.super_admin}

    def _guard(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise ForbiddenError(f"Role {user.role.value} is not permitted for this action")
        return user

    return _guard
