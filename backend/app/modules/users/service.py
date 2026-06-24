"""User service: CRUD, auth, bootstrap admin."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthError, ConflictError, NotFoundError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import LoginRequest, TokenPair, UserCreate, UserUpdate


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id: uuid.UUID) -> User:
        user = await self.db.get(User, user_id)
        if not user:
            raise NotFoundError("User not found")
        return user

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def list(self) -> list[User]:
        result = await self.db.execute(select(User).order_by(User.created_at.desc()))
        return list(result.scalars().all())

    async def create(self, payload: UserCreate) -> User:
        if await self.get_by_email(payload.email):
            raise ConflictError("Email already registered")
        user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            role=payload.role,
            hashed_password=hash_password(payload.password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user_id: uuid.UUID, payload: UserUpdate) -> User:
        user = await self.get(user_id)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(user, k, v)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate(self, payload: LoginRequest) -> TokenPair:
        user = await self.get_by_email(payload.email)
        if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
            raise AuthError("Invalid credentials")
        return TokenPair(
            access_token=create_access_token(str(user.id), {"role": user.role.value}),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def ensure_bootstrap_admin(self, email: str, password: str) -> None:
        existing = await self.get_by_email(email)
        if existing:
            return
        self.db.add(
            User(
                email=email.lower(),
                full_name="ZPE Super Admin",
                role=UserRole.super_admin,
                hashed_password=hash_password(password),
                is_active=True,
            )
        )
        await self.db.commit()
