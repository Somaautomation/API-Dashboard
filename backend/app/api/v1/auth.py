from fastapi import APIRouter

from app.api.deps import DbSession
from app.modules.users.schemas import LoginRequest, TokenPair
from app.modules.users.service import UserService

router = APIRouter()


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, db: DbSession) -> TokenPair:
    return await UserService(db).authenticate(payload)
