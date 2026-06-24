"""Pydantic DTOs for the test-generation module."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

TestCategory = Literal["positive", "negative", "boundary", "edge_case", "security"]
JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class Assertion(BaseModel):
    """One assertion to evaluate against the response of a generated test.

    The ``type`` mirrors the dispatcher in
    ``app.modules.validation.assertions`` so generated suites can run
    unchanged through the existing collection runner.
    """

    model_config = ConfigDict(extra="allow")

    type: str
    description: str = ""
    # Common type-specific fields (extras allowed for forward-compat).
    expected: Any = None
    expected_in: list[int] | None = None
    name: str | None = None
    contains: str | None = None
    path: list[str] | None = None
    response_schema: dict[str, Any] | None = Field(default=None, alias="schema")
    threshold_ms: int | None = None


class GeneratedTestCase(BaseModel):
    id: str
    name: str
    category: TestCategory
    description: str = ""
    method: str
    path: str
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    query: dict[str, Any] = Field(default_factory=dict)
    body: Any | None = None
    assertions: list[Assertion] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    expected_status: int | None = None


class EdgeCaseSuggestion(BaseModel):
    field: str
    type: str = "string"
    suggestions: list[str]
    rationale: str = ""
    source: Literal["heuristic", "ai"] = "heuristic"


class TestSuite(BaseModel):
    endpoint_id: str | None = None
    method: str
    path: str
    summary: str = ""
    operation_id: str | None = None
    base_url: str = ""
    positive: list[GeneratedTestCase] = []
    negative: list[GeneratedTestCase] = []
    boundary: list[GeneratedTestCase] = []
    edge_cases: list[GeneratedTestCase] = []
    security: list[GeneratedTestCase] = []
    edge_suggestions: list[EdgeCaseSuggestion] = []
    counts: dict[str, int] = {}
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    def all_cases(self) -> list[GeneratedTestCase]:
        return [*self.positive, *self.negative, *self.boundary, *self.edge_cases, *self.security]

    def recompute_counts(self) -> None:
        self.counts = {
            "positive": len(self.positive),
            "negative": len(self.negative),
            "boundary": len(self.boundary),
            "edge_case": len(self.edge_cases),
            "security": len(self.security),
            "total": len(self.all_cases()),
        }


class GenerateOptions(BaseModel):
    include_positive: bool = True
    include_negative: bool = True
    include_boundary: bool = True
    include_edge_cases: bool = True
    include_security: bool = False
    response_time_threshold_ms: int = 2000
    use_ai: bool = True
    base_url: str = "{{baseUrl}}"
    auth_header_name: str = "Authorization"
    auth_header_value: str = "Bearer {{token}}"


class FailureInput(BaseModel):
    endpoint_method: str
    endpoint_path: str
    test_name: str
    expected_status: int | None = None
    actual_status: int | None = None
    expected_assertion: dict[str, Any] | None = None
    request_body: Any | None = None
    response_body: str | None = None
    response_headers: dict[str, str] | None = None
    error: str | None = None


class FailureExplanation(BaseModel):
    title: str
    summary: str
    technical: dict[str, Any]
    possible_causes: list[str]
    suggested_actions: list[str]
    severity: Literal["info", "low", "medium", "high", "critical"] = "medium"
    source: Literal["heuristic", "ai"] = "heuristic"


class JobOut(BaseModel):
    job_id: str
    status: JobStatus
    total: int = 0
    completed: int = 0
    failed: int = 0
    progress: int = 0  # 0..100
    suites: list[TestSuite] = []
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
