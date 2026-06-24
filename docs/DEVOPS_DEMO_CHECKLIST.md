# DevOps Demo Session - Team Checklist

## Pre-Demo (48 hours before)

### Organizer Checklist
- [ ] Book meeting room (or video link)
- [ ] Send calendar invite with agenda (DEVOPS_DEMO_SESSION.md)
- [ ] Confirm all participants can attend
- [ ] Test demo machine (Docker Desktop, repo cloned, `.env.dev` working)
- [ ] Prepare slides (architecture, cost, security)
- [ ] Backup demo machine state
- [ ] Have backup demo machine ready (if primary fails)
- [ ] Test projector / screen sharing
- [ ] Ensure WiFi can handle video + Docker container pulls
- [ ] Print/share network diagrams

### Participant Prep
- [ ] Read INTERNAL_DEPLOYMENT.md overview
- [ ] Install Docker Desktop locally (if not already)
- [ ] Clone repo locally and run `docker-compose up` to familiarize
- [ ] Gather your team's external IP(s) and VPN CIDR info
- [ ] Collect company TLS cert info (if using company cert)
- [ ] Prepare list of questions/concerns

---

## During Session

### Part 1: Architecture Walkthrough (20 mins)

**Presenter: Platform Lead**

- [ ] Display architecture diagram (flowchart from guide)
- [ ] Explain "why single VM" (cost, simplicity, internal-only)
- [ ] Show compliance/security posture
- [ ] Field questions on host provider (AWS, Hetzner, etc.)

**Audience Actions:**
- [ ] Ask clarifying questions on architecture
- [ ] Note any concerns or constraints from your org
- [ ] Confirm budget and timeline expectations

---

### Part 2: Live Local Demo (30 mins)

**Presenter: Platform Lead**

**Demo Machine Terminal:**

```bash
# Show current state
docker-compose ps

# Rebuild environment (optional)
docker-compose down -v
docker-compose up -d

# Wait for startup
docker-compose logs -f backend
```

#### Checkpoint 1: Services Running
- [ ] Presenter: All services show "Up" or "healthy"
- [ ] Demo machine: Open http://localhost:3000 in browser
- [ ] Audience: Can see frontend loaded

#### Checkpoint 2: Frontend Demo
- [ ] Show login (if auth implemented)
- [ ] Navigate: Dashboard → Collections → Load Test → Analytics
- [ ] Upload sample OpenAPI spec (use `shared/samples/petstore.openapi.yaml`)
- [ ] Generate AI tests (if feature ready)
- [ ] Create test collection

#### Checkpoint 3: Backend Demo
- [ ] Open http://localhost:8000/docs (Swagger)
- [ ] Show API endpoints available
- [ ] Demo: `GET /health` should return 200
- [ ] Show request/response examples

#### Checkpoint 4: Database Inspection
```bash
docker-compose exec postgres psql -U postgres -d apidashboard -c "\dt"
```
- [ ] Show tables created
- [ ] Explain schema (users, collections, test_runs, etc.)

#### Checkpoint 5: Redis & Celery
```bash
docker-compose logs worker | tail -20
docker-compose exec redis redis-cli INFO stats
```
- [ ] Show Celery worker processing tasks
- [ ] Show Redis memory usage

#### Checkpoint 6: Upload & Persistence
- [ ] Create a collection in frontend
- [ ] Restart Docker containers: `docker-compose restart`
- [ ] Verify collection persisted after restart

**Audience Actions:**
- [ ] Follow along on personal laptop (optional)
- [ ] Ask questions about features / limitations
- [ ] Note pain points for production setup

---

### Part 3: Configuration Deep Dive (60 mins)

**Presenter: DevOps Lead**

#### 3.1 Environment Configuration (10 mins)
```bash
cat .env.prod.example
```
- [ ] Review each variable: what it is, why it's needed
- [ ] Explain: SECRET_KEY, POSTGRES_PASSWORD, API keys, domain
- [ ] Discuss: secret rotation schedule (quarterly min)
- [ ] Discuss: secret storage solution (Vault, AWS Secrets, etc.)

**Audience Task Group A (Network/Security):**
- [ ] Ask: What secrets are most critical? How do we rotate them?
- [ ] Raise: Any compliance requirements for secret storage?

**Audience Task Group B (Platform):**
- [ ] Ask: How do we inject secrets into CI/CD pipeline safely?
- [ ] Raise: Audit trail requirements for who accesses secrets?

---

#### 3.2 Docker Compose Production (10 mins)
```bash
cat deploy/internal/docker-compose.prod.yml
```

Walk through each service block:

**PostgreSQL Section:**
- [ ] Highlight: `volumes`, `healthcheck`, `environment`
- [ ] Explain: Persistent data directory, automatic restart, health verification

**Redis Section:**
- [ ] Highlight: `command: ["redis-server", "--appendonly", "yes"]`
- [ ] Explain: Persistence mode, cache for sessions/tasks

**Backend Section:**
- [ ] Highlight: `env_file`, `depends_on`, `healthcheck`, `restart`
- [ ] Explain: Dependency order, health verification, auto-restart policy
- [ ] Question: What if backend crashes? (Monitoring/alerts)

**Worker Section:**
- [ ] Explain: Same image as backend, runs Celery command
- [ ] Purpose: Process async tasks (email, reports, heavy lifting)

**Network & Volumes:**
- [ ] Explain: `app_net` keeps services isolated
- [ ] Show: Named volumes prevent data loss on container restart

**Audience Task (Infra Team):**
- [ ] Ask: How do we backup volumes daily? Where?
- [ ] Ask: What happens if disk fills up? Do we have monitoring?

---

#### 3.3 Nginx Configuration (15 mins)
```bash
tree deploy/internal/nginx/
cat deploy/internal/nginx/nginx.conf
cat deploy/internal/nginx/conf.d/site.conf
cat deploy/internal/nginx/conf.d/allowlist.conf
```

**Key Features:**
- [ ] TLS termination (certs, redirect HTTP→HTTPS)
- [ ] Reverse proxy (routes /api to backend, / to frontend)
- [ ] IP allowlist (geo-blocking, VPN-only access)
- [ ] Basic auth (htpasswd, username/password)
- [ ] Rate limiting (protect against brute force)
- [ ] Security headers (HSTS, CSP, X-Frame-Options)
- [ ] Logging (access.log, error.log for debugging)
- [ ] Gzip compression (faster downloads)

**Audience Question:**
- [ ] Where is htpasswd file stored? Who manages it?
- [ ] How do we rotate TLS certs without downtime?
- [ ] If allowlist IP changes, how quickly can we update?

---

#### 3.4 Deployment Scripts (15 mins)
```bash
ls -la deploy/internal/scripts/
```

**Walk each script:**

| Script | Purpose | Frequency | Owner |
|--------|---------|-----------|-------|
| `generate-allowlist.sh` | Create Nginx allowlist from IP list | Whenever IPs change | Network team |
| `render-nginx-config.sh` | Populate domain, certs into Nginx config | Pre-deploy | Platform |
| `provision-letsencrypt.sh` | Obtain/renew TLS certs from Let's Encrypt | Auto (certbot) | DevOps |
| `install-company-cert.sh` | Install company-issued TLS cert | Pre-deploy (if company cert) | Security |
| `create-htpasswd.sh` | Create basic auth credentials | When users added | DevOps |
| `deploy.sh` | Main: pull code, build, restart services | On every release | GitHub Actions |
| `rollback.sh` | Revert to previous version on failure | On-demand (failures) | On-call |
| `post-deploy-checks.sh` | Smoke tests (200 OK, redirects, auth) | Post-deploy (automatic) | GitHub Actions |

**Audience Actions:**
- [ ] Infra: Understand IP allowlist flow
- [ ] Platform: Understand cert provisioning flow
- [ ] Security: Review cert validation process
- [ ] DevOps: Test `deploy.sh` locally on demo machine

---

### Part 4: Hands-On Configuration (60 mins)

**Team breaks into task groups (concurrent activities)**

#### 🔐 Task Group A: IP Allowlist & Networking (15 mins)
**Assigned to:** Network/Security team

**Goal:** Create production allowlist config

**Steps:**
1. Gather team's external IPs:
   ```bash
   # Each person runs:
   curl https://ifconfig.me
   # Note: MyIP = [result]
   ```

2. Compile into CIDR blocks:
   ```
   10.0.0.0/8           # Office VPN CIDR
   203.0.113.100/32     # Alice's home office IP
   198.51.100.0/24      # Remote office branch CIDR
   ```

3. Run allowlist generator:
   ```bash
   bash deploy/internal/scripts/generate-allowlist.sh \
     --cidrs "10.0.0.0/8,203.0.113.100/32,198.51.100.0/24"
   
   # Verify output
   cat deploy/internal/nginx/conf.d/allowlist.conf
   ```

4. Plan firewall rules:
   - Inbound 443 from allowlist only
   - Inbound 80 from allowlist (for ACME renewal)
   - All other ports blocked
   - Logging enabled

**Deliverables:**
- [ ] `deploy/internal/nginx/conf.d/allowlist.conf` (production-ready)
- [ ] Firewall rule plan (cloud provider specific)
- [ ] Procedure for updating IPs (when team member travels, etc.)

**Troubleshooting:**
- Not sure of VPN CIDR? → Ask network admin
- Office IP blocks, not single IPs? → Use CIDR notation (/24, /16)
- Using residential proxy? → May not work. Ask security team.

---

#### 🔒 Task Group B: TLS Certificate Strategy (20 mins)
**Assigned to:** Infra/Security team

**Goal:** Decide on TLS approach (Let's Encrypt vs Company Cert)

**Option 1: Let's Encrypt (Recommended if no company cert requirement)**

Pros:
- Automated renewal (no manual intervention)
- Free
- Industry standard

Cons:
- Requires DNS or HTTP challenge access
- Cert renewal needs DNS update or HTTP server running

Steps:
```bash
# Test locally first
docker run -it --rm \
  -v /tmp/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --help

# Or test with staging Let's Encrypt:
docker run -it --rm \
  -v /tmp/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --test-mode \
  -d api-dashboard.internal.company
```

Review: `deploy/internal/scripts/provision-letsencrypt.sh`

**Option 2: Company Certificate (If required by org policy)**

Steps:
1. Get from security team:
   - `server.crt` (public certificate)
   - `server.key` (private key)
   - `ca-bundle.crt` (intermediate certs, if needed)

2. Validate cert:
   ```bash
   openssl x509 -in server.crt -text -noout | grep -A2 "Validity"
   # Check: CN = api-dashboard.internal.company
   # Check: Not expired
   ```

3. Review: `deploy/internal/scripts/install-company-cert.sh`

4. Test installation:
   ```bash
   bash deploy/internal/scripts/install-company-cert.sh \
     /path/to/server.crt \
     /path/to/server.key \
     /path/to/ca-bundle.crt
   ```

**Decision Matrix:**

| Factor | Let's Encrypt | Company Cert |
|--------|---------------|--------------|
| Cost | Free | Free (org issued) |
| Renewal | Auto (certbot) | Manual (set reminder) |
| Monitoring | Certbot alerts | Manual calendar alert |
| Compliance | ISO compliant | ISO compliant |
| Support | Community | Org IT |

**Deliverables:**
- [ ] Decision: Let's Encrypt OR Company Cert
- [ ] Cert provisioning script tested locally
- [ ] Renewal/rotation plan documented
- [ ] Monitoring/alerting set up (60-day expiry warning)

**Questions to answer:**
- [ ] Who gets cert expiry notifications?
- [ ] What do we do if cert expires unexpectedly?
- [ ] Can we test cert renewal on staging before production?

---

#### 🔑 Task Group C: Environment Secrets & Config (15 mins)
**Assigned to:** Platform/DevOps lead

**Goal:** Generate and securely store `.env.prod`

**Step 1: Generate Strong Secrets**
```bash
# SECRET_KEY for FastAPI
python3 << 'EOF'
import secrets
print("APP_SECRET_KEY=" + secrets.token_urlsafe(32))
EOF

# POSTGRES_PASSWORD
openssl rand -base64 32

# ENCRYPTION_KEY (if your app uses cryptography)
python3 -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"

# BOOTSTRAP_ADMIN_PASSWORD (set to strong value)
# Example: MyAdminPass_2024!Secure42
```

**Step 2: Create .env.prod from template**
```bash
cp .env.prod.example .env.prod

# Edit with generated secrets
nano .env.prod

# Key variables to populate:
APP_SECRET_KEY=<from Step 1>
POSTGRES_PASSWORD=<from Step 1>
POSTGRES_USER=apidash_prod
POSTGRES_DB=apidashboard_prod
BOOTSTRAP_ADMIN_PASSWORD=<strong password>

INTERNAL_DOMAIN=api-dashboard.internal.company
ALLOWED_CIDRS=10.0.0.0/8,203.0.113.100/32

REDIS_URL=redis://redis:6379/0

BACKEND_IMAGE=ghcr.io/yourorg/apidashboard-backend
FRONTEND_IMAGE=ghcr.io/yourorg/apidashboard-frontend
DEPLOY_TAG=v1.0.0

ENVIRONMENT=production
LOG_LEVEL=INFO
```

**Step 3: Secure Storage**

Choose ONE:

**Option A: AWS Secrets Manager** (if using AWS)
```bash
aws secretsmanager create-secret \
  --name apidashboard/prod \
  --secret-string file://.env.prod
```

**Option B: HashiCorp Vault** (if available in org)
```bash
vault kv put secret/apidashboard/prod @.env.prod
```

**Option C: GitHub Secrets + Encrypted Git** (if no Vault)
```bash
# Encrypt .env.prod before committing
git-crypt add-gpg-user <gpg-key-id>
git add .env.prod  # Now encrypted in repo
git commit -m "Add production secrets (encrypted)"
```

**Option D: GitHub Actions Secrets Only** (for CI/CD vars)
```bash
# Go to: GitHub Repo → Settings → Secrets → New repository secret
# Add each var as individual secret (not as file)
# e.g., PROD_APP_SECRET_KEY, PROD_POSTGRES_PASSWORD, etc.
```

**Step 4: Secret Rotation Plan**

Document:
- [ ] When: Quarterly (Jan, Apr, Jul, Oct)
- [ ] How: Generate new values, update storage, re-deploy
- [ ] Audit: Log who changed what, when
- [ ] Procedure: Approved by Platform Lead + 1 other DevOps

**Deliverables:**
- [ ] `.env.prod` created and stored securely
- [ ] Access control documented (who can read/update)
- [ ] Secret rotation process written down
- [ ] Monitoring: Alert if secrets are accessed unexpectedly

**Checklist:**
- [ ] No secrets in Git history (use git-crypt or GitHub Secrets)
- [ ] No secrets in Slack/email
- [ ] Secrets encrypted at rest
- [ ] Secrets encrypted in transit (HTTPS only)
- [ ] Audit log of who/when accessed secrets

---

#### 🚀 Task Group D: VM Provisioning & Deployment Dry-Run (15 mins)
**Assigned to:** Infrastructure team

**Goal:** Provision test VM and do dry-run deployment

**Step 1: VM Provisioning**

Provision new Linux VM:
- Provider: AWS / Hetzner / Azure (your choice)
- OS: Ubuntu 22.04 LTS or 24.04
- Size: t3.small (AWS) / CX22 (Hetzner) - ~$5-15/month
- Storage: 50 GB SSD minimum
- Network: Private network (VPN only access)
- DNS: Create A record `api-dashboard-test.internal.company` → VM IP

**Step 2: Bootstrap VM** (Run these on new VM)
```bash
ssh ubuntu@<vm-ip>

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install required tools
sudo apt-get install -y \
  docker.io \
  docker-compose-plugin \
  git \
  curl \
  gettext-base \
  htpasswd

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Verify
docker --version
docker compose version
```

**Step 3: Clone Repository**
```bash
git clone https://github.com/yourorg/APIDashboard.git \
  /opt/apidashboard
cd /opt/apidashboard

# Create data directories
mkdir -p data/{postgres,redis,uploads}
mkdir -p secrets
chmod 700 secrets

# Copy env file
cp .env.prod.example .env.prod

# Edit with real values (use secrets from Group C)
nano .env.prod
```

**Step 4: Test Deployment**
```bash
cd /opt/apidashboard/deploy/internal

# Source environment (or edit docker-compose.prod.yml)
export BACKEND_IMAGE=ghcr.io/yourorg/backend:v1.0.0
export FRONTEND_IMAGE=ghcr.io/yourorg/frontend:v1.0.0
export DEPLOY_TAG=v1.0.0

# Show config
docker compose -f docker-compose.prod.yml config | head -50

# Start services
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
sleep 30
docker compose -f docker-compose.prod.yml ps

# Check health
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

**Step 5: Verify Deployment**
```bash
# Run smoke tests
bash scripts/post-deploy-checks.sh

# Expected output: All checks PASSED
```

**Step 6: Rollback Test** (Optional but recommended)
```bash
# Simulate previous version
export DEPLOY_TAG=v0.9.0

# Run rollback
bash scripts/rollback.sh

# Services should restart with old tag
docker compose -f docker-compose.prod.yml ps
```

**Deliverables:**
- [ ] Test VM deployed and accessible
- [ ] Services running and healthy
- [ ] Health checks passing
- [ ] Rollback tested and working
- [ ] Deployment runbook updated with actual commands

**Troubleshooting Reference:**
```bash
# If services won't start
docker compose -f docker-compose.prod.yml logs

# If specific service failing
docker compose -f docker-compose.prod.yml logs backend

# Check resource usage
docker stats

# Inspect network
docker network inspect app_net

# Interactive troubleshooting
docker compose -f docker-compose.prod.yml exec backend bash
```

---

### Part 5: CI/CD Pipeline Deep Dive (15 mins)

**Presenter: Platform Lead**

**Show:** `.github/workflows/internal-deploy.yml`

**Workflow Stages:**

1. **Trigger:**
   - Push to `main` branch
   - Or manual trigger with version tag

2. **Build:**
   - Backend: `docker build -t backend:v1.0.0`
   - Frontend: `docker build -t frontend:v1.0.0`

3. **Push:**
   - Registry: GitHub Packages / DockerHub
   - Auth: Using GitHub token

4. **Deploy:**
   - SSH to VM
   - Run `deploy.sh` with new image tags
   - Wait for healthchecks

5. **Verify:**
   - Post-deploy checks
   - Smoke tests
   - Log aggregation

**Audience Task (Platform Team):**
- [ ] Create GitHub Secrets:
  ```
  DEPLOY_HOST=api-dashboard-test.internal.company
  DEPLOY_USER=ubuntu
  DEPLOY_KEY=<private SSH key>
  REGISTRY_USERNAME=<docker registry user>
  REGISTRY_PASSWORD=<docker registry token>
  ```

- [ ] Test GitHub Actions workflow:
  ```bash
  # Push to staging branch
  git checkout -b staging/test
  git push origin staging/test
  # Watch: GitHub → Actions → see workflow run
  ```

**Questions:**
- [ ] How do we approve deployments before they run?
- [ ] Can we add manual approval step in workflow?
- [ ] How do we rollback if deployment fails?

---

### Part 6: Monitoring & Alerting (15 mins)

**Presenter: DevOps Lead**

**Current State (in place):**
- Docker health checks
- Container logs (json-file driver)
- Manual log inspection: `docker-compose logs -f`

**Recommended Setup (to-do):**

1. **Log Aggregation:**
   - [ ] ELK Stack (self-hosted) OR CloudWatch OR Splunk
   - [ ] Ship logs from all containers
   - [ ] Searchable dashboards

2. **Metrics Monitoring:**
   - [ ] Prometheus + Grafana (self-hosted) OR CloudWatch
   - [ ] Track: CPU, memory, disk, request rate, error rate
   - [ ] Dashboard with key metrics

3. **Alerting:**
   - [ ] Slack channel `#api-dashboard-alerts`
   - [ ] Alert on: High error rate, service down, cert expiry soon
   - [ ] On-call rotation setup (PagerDuty or similar)

4. **Health Checks:**
   - [ ] External uptime monitoring (UptimeRobot, Datadog)
   - [ ] Daily: "Is api-dashboard.internal.company responding?"
   - [ ] Alert if down for >5 mins

**Audience Question:**
- [ ] What's our SLA for internal tool? (99%, 99.9%)
- [ ] On-call rotation: Who? How often?
- [ ] Budget for monitoring tools?

---

## Post-Demo Actions

### Immediately After (Next 24 hours)

**All Participants:**
- [ ] Fill out feedback form (link from organizer)
- [ ] Share concerns or blockers via chat channel

**Platform Team:**
- [ ] Consolidate: IP allowlist, cert strategy, secrets
- [ ] Create: Final `.env.prod` (for staging)
- [ ] Add: GitHub Secrets for CI/CD

**Infra Team:**
- [ ] Provision: Staging VM
- [ ] Configure: Firewall rules
- [ ] Create: DNS record

**Security Team:**
- [ ] Review: Allowlist, cert plan, secrets storage
- [ ] Approve: Go/no-go for staging deployment

---

### Week 1: Staging Deployment

**Platform Lead:**
- [ ] Deploy to staging VM
- [ ] Run all smoke tests
- [ ] Document any issues

**All Team Members:**
- [ ] Test staging environment
- [ ] Report bugs / configuration issues

**Decision Point:**
- [ ] Is staging stable? YES → Continue to prod prep
- [ ] Issues found? → Fix and re-test

---

### Week 2-3: Production Deployment

**Pre-Deployment:**
- [ ] Staging validation: PASSED
- [ ] All team approved: YES
- [ ] Backups: CREATED
- [ ] Rollback plan: REVIEWED

**Deployment:**
- [ ] Tag release: `git tag v1.0.0-prod`
- [ ] Trigger: GitHub Actions with prod secrets
- [ ] Monitor: First 24 hours continuously

**Post-Deployment:**
- [ ] Error rate: <0.1%
- [ ] Response times: Acceptable
- [ ] Resource usage: Normal
- [ ] No unexpected logs/warnings

---

## Sign-Off

**Demo Session Completed:** ____________ (Date)

**Attendees Sign-Off:**
- [ ] Platform Lead: _________________ (Signature)
- [ ] DevOps Lead: ___________________ (Signature)
- [ ] Infra Lead: ____________________ (Signature)
- [ ] Security Lead: __________________ (Signature)

**Next Steps Owner:** _________________ (Name)
**Follow-up Meeting:** _______________ (Date - recommend 1 week)

---

**Questions? Contact:** Platform Team (`#api-dashboard-dev` Slack)
