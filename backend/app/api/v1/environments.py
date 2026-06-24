import uuid

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.errors import NotFoundError
from app.modules.environments.models import Environment, EnvironmentKind

router = APIRouter()


class EnvIn(BaseModel):
    name: str
    kind: EnvironmentKind = EnvironmentKind.dev
    base_url: str = ""
    variables: dict[str, str] = {}


class EnvOut(EnvIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


@router.get("", response_model=list[EnvOut])
async def list_envs(db: DbSession, _: CurrentUser) -> list[EnvOut]:
    res = await db.execute(select(Environment).order_by(Environment.name))
    return [EnvOut.model_validate(e) for e in res.scalars().all()]


@router.post("", response_model=EnvOut, status_code=201)
async def create_env(payload: EnvIn, db: DbSession, _: CurrentUser) -> EnvOut:
    env = Environment(**payload.model_dump())
    db.add(env)
    await db.commit()
    await db.refresh(env)
    return EnvOut.model_validate(env)


@router.put("/{env_id}", response_model=EnvOut)
async def update_env(env_id: uuid.UUID, payload: EnvIn, db: DbSession, _: CurrentUser) -> EnvOut:
    env = await db.get(Environment, env_id)
    if not env:
        raise NotFoundError("Environment not found")
    for k, v in payload.model_dump().items():
        setattr(env, k, v)
    await db.commit()
    await db.refresh(env)
    return EnvOut.model_validate(env)


@router.delete("/{env_id}", status_code=204)
async def delete_env(env_id: uuid.UUID, db: DbSession, _: CurrentUser) -> None:
    env = await db.get(Environment, env_id)
    if not env:
        raise NotFoundError("Environment not found")
    await db.delete(env)
    await db.commit()

