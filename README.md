# ZPE API Testing Platform

A centralized API validation and automation platform for **ZPE Systems Pvt Ltd**, used by QA Engineers, Developers, SREs, and DevOps teams to replace fragmented API-testing workflows with a single, governed, enterprise platform.

## Capabilities

- Swagger / OpenAPI upload, validation, and endpoint extraction
- Auto-generated test artifacts: Postman, cURL, Robot Framework, Playwright, k6
- OAuth2 / Bearer / API Key / Basic Auth vault with encrypted storage and auto-refresh
- Request execution + schema / status / header / contract assertions
- Mock API server with stateful responses, delays and error injection
- AI-assisted assertion generation, retry logic suggestions, test case generation
- Load test starter scripts for k6 and JMeter
- Multi-environment (Dev / QA / Stage / Prod) execution & history
- Enterprise dashboards (pass/fail trends, reliability, slowest APIs)
- RBAC (Super Admin, QA Lead, QA Engineer, Developer, Viewer), audit logs

## Architecture

```
┌───────────────┐   HTTPS    ┌──────────────────┐   asyncpg   ┌─────────────┐
│  React + TS   │ ─────────► │  FastAPI Backend │ ──────────► │ PostgreSQL  │
│  Tailwind     │            │  (modular DDD)   │             └─────────────┘
│  shadcn/ui    │ ◄──── WS ─ │  JWT + OAuth2    │   redis://  ┌─────────────┐
└───────────────┘            │  Celery workers  │ ──────────► │   Redis     │
                             └──────────────────┘             └─────────────┘
```

### Stack

| Layer        | Technology                                                  |
| ------------ | ----------------------------------------------------------- |
| Frontend     | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Zustand, React Query, Axios |
| Backend      | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic    |
| Auth         | JWT (PyJWT), OAuth2 (Authlib), bcrypt                       |
| DB / Cache   | PostgreSQL 16, Redis 7                                      |
| Workers      | Celery + Redis (load tests, scheduled reports)              |
| AI           | Pluggable LLM provider (OpenAI / Azure OpenAI / local)      |
| DevOps       | Docker, Docker Compose, GitHub Actions                      |

## Repository layout

```
.
├── backend/          FastAPI service (modular app/)
├── frontend/         React + Vite SPA
├── shared/           OpenAPI contract, JSON schemas, shared types
├── infra/            Terraform / k8s manifests (placeholders)
├── docker/           Per-service Dockerfiles + nginx config
├── .github/workflows CI/CD pipelines
└── docker-compose.yml
```

## Quick start

```powershell
copy .env.example .env
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:8000  (Swagger UI at /docs)
- Postgres → localhost:5432  (user: zpe / pass: zpe)
- Redis    → localhost:6379

Default super admin (created on first boot): `admin@zpesystems.com` / `ChangeMe!123`.

## Local development (without Docker)

```powershell
# Backend
cd backend
python -m venv .venv; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Testing

```powershell
cd backend; pytest -q
cd frontend; npm test
```

## Modules

| Module | Path |
| ------ | ---- |
| Swagger parser        | [backend/app/modules/swagger](backend/app/modules/swagger) |
| Collection generator  | [backend/app/modules/collections](backend/app/modules/collections) |
| Token vault & OAuth   | [backend/app/modules/auth_vault](backend/app/modules/auth_vault) |
| Validation engine     | [backend/app/modules/validation](backend/app/modules/validation) |
| Mock API server       | [backend/app/modules/mocks](backend/app/modules/mocks) |
| AI assist             | [backend/app/modules/ai](backend/app/modules/ai) |
| Load testing          | [backend/app/modules/loadtest](backend/app/modules/loadtest) |
| Reporting             | [backend/app/modules/reporting](backend/app/modules/reporting) |
| Users / RBAC          | [backend/app/modules/users](backend/app/modules/users) |

## License

Internal — © ZPE Systems Pvt Ltd. All rights reserved.
