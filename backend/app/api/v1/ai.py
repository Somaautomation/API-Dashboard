from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.modules.ai.service import AIService, AssertSuggestRequest, RetrySuggestRequest, TestCaseRequest

router = APIRouter()


@router.post("/assertions")
async def suggest_assertions(payload: AssertSuggestRequest, _: CurrentUser) -> dict:
    return {"assertions": await AIService().suggest_assertions(payload)}


@router.post("/retry-policy")
async def suggest_retry(payload: RetrySuggestRequest, _: CurrentUser) -> dict:
    return await AIService().suggest_retry_policy(payload)


@router.post("/test-cases")
async def generate_test_cases(payload: TestCaseRequest, _: CurrentUser) -> dict:
    return await AIService().generate_test_cases(payload)
