"""Aggregate model imports so Alembic / metadata can see them."""
from app.db.session import Base  # noqa: F401
from app.modules.users.models import User, AuditLog  # noqa: F401
from app.modules.swagger.models import SwaggerSpec, ApiEndpoint  # noqa: F401
from app.modules.collections.models import Collection, CollectionItem  # noqa: F401
from app.modules.auth_vault.models import TokenProfile  # noqa: F401
from app.modules.validation.models import TestRun, TestAssertion  # noqa: F451
from app.modules.mocks.models import MockEndpoint  # noqa: F401
from app.modules.environments.models import Environment  # noqa: F401

__all__ = ["Base"]
