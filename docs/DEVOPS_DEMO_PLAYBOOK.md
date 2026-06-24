# DevOps Demo Session - Quick Reference Playbook

**Purpose:** Presenter's quick guide to run the 2.5-hour demo smoothly without losing pace.

---

## ⏱️ Timeline & Pace

| Time | Duration | Activity | Who | Notes |
|------|----------|----------|-----|-------|
| 0:00 | 5 min | Welcome & agenda | Lead | "Today we're moving from local to production. By end, everyone knows their role." |
| 0:05 | 15 min | Architecture overview | Platform Lead | Slides: why single VM, cost, security |
| 0:20 | 30 min | **LIVE DEMO**: Local app | DevOps Lead | Show: Frontend, Backend, DB, Celery, Uploads |
| 0:50 | 20 min | Docker Compose prod config | Platform Lead | Walk: services, volumes, healthchecks, networking |
| 1:10 | 15 min | Nginx configuration | Platform Lead | Show: TLS, allowlist, auth, security headers |
| 1:25 | 15 min | Deployment scripts | DevOps Lead | Cat each script, explain purpose |
| 1:40 | 60 min | **BREAKOUT TASKS** (concurrent) | Teams A-D | IP allowlist, TLS cert strategy, secrets, VM provisioning |
| 2:40 | 15 min | CI/CD pipeline | Platform Lead | GitHub Actions workflow |
| 2:55 | 15 min | Monitoring & Q&A | DevOps Lead | Future setup, burn-down Q&A |
| 3:10 | 5 min | Wrap-up & next steps | Lead | Sign-off checklist, follow-up meeting scheduled |

---

## 🎬 Before Demo Starts (30 mins prior)

### Presenter Setup
```bash
# Open terminal in demo machine
cd /path/to/APIDashboard

# Ensure containers are fresh
docker-compose down -v
docker-compose up -d

# Wait for everything to start
docker-compose logs -f backend | grep "Application startup complete"
# Press Ctrl+C when done

# Quick verification
docker-compose ps                           # All running?
curl http://localhost:8000/health           # Backend OK?
curl http://localhost:3000 -I | head -1    # Frontend OK?

# Have these open in browser tabs before demo starts:
# Tab 1: http://localhost:3000 (Frontend)
# Tab 2: http://localhost:8000/docs (Swagger)
# Tab 3: GitHub repo (docs/INTERNAL_DEPLOYMENT.md)
# Tab 4: GitHub repo (deploy/internal/scripts/)

# Have terminals ready:
# Terminal 1: cd /path/to/APIDashboard (for docker-compose commands)
# Terminal 2: cd /path/to/APIDashboard/deploy/internal (for script walkthrough)
# Terminal 3: Ready for breakout group support
```

### Audience Setup
- [ ] Everyone has Slack open
- [ ] Everyone can see screen (or screenshare working)
- [ ] Everyone has laptop ready for hands-on tasks
- [ ] WiFi is stable

### Test AV
- [ ] Projector / TV working
- [ ] Screen mirroring stable
- [ ] Audio (if remote) clear
- [ ] Chat/Q&A tool ready

---

## 🚀 Demo Execution

### ✅ Part 1: Welcome & Architecture (5 min)

**Talking Points (use own words):**
```
"Good morning everyone. Today we're moving APIDashboard from 'fun local dev project' 
to 'production internal tool that the whole company will use.'

Here's what we'll do:
1. See what we built (live demo)
2. Understand how it runs in production (architecture)
3. Each team takes specific configuration tasks
4. Leave with clear ownership and next steps

By 3pm, everyone knows: 
  - What they'll build/configure
  - When it's needed
  - Who to ask if stuck

Any questions before we start? [Wait 5 seconds]
Great, let's go!"
```

**Slide 1:** Title: "APIDashboard: Local → Production"
**Slide 2:** Today's agenda (as table above)
**Slide 3:** Participants & roles
**Slide 4:** Success criteria (from DEVOPS_DEMO_SESSION.md Part 6)

---

### ✅ Part 2: Architecture Walkthrough (15 min)

**Talking Points:**

```
"Why are we building this way? Three reasons:

COST: One mid-tier VM ($10/month) runs everything - app, DB, Redis, workers.
  Much cheaper than managed services ($100+/month).

SIMPLICITY: Docker Compose is our deployment tool. Same thing runs locally
  and in production. No 'works on my machine' surprises.

SECURITY: Internal-only. Locked behind VPN + IP allowlist + TLS.
  Not exposed to public internet."
```

**Show Architecture Diagram:**
- Users → VPN → Firewall → Nginx (TLS, auth, allowlist) → App

**Key Decisions:**
- [ ] Single VM: Yes, we start with one.
- [ ] Scaling: Only if >200 concurrent users later.
- [ ] Database: PostgreSQL 16 (not SQLite, needs reliability).
- [ ] Workers: Celery + Redis (for async tasks: emails, exports).

**Estimated Costs:**
- VM: $10/month
- DNS (if needed): $0-5/month
- TLS cert: $0 (Let's Encrypt)
- **Total: ~$10-15/month**

**Attendee Questions:** [Take 2-3 questions, keep moving]

---

### ✅ Part 3: Live Local Demo (30 min) - CRITICAL

**Demo Machine Terminal (left half):**

```bash
# 1. Show services running
$ docker-compose ps
# Output should show: postgres, redis, backend, frontend, worker all "Up"

# 2. Navigate to frontend
# [Open browser: http://localhost:3000]
# Show: App loads, UI responsive, can navigate

# 3. Show login (if implemented)
# Login as: admin@internal.company / [password]

# 4. Dashboard walkthrough
# - Collections tab: Show existing or create new
# - Upload: Use shared/samples/petstore.openapi.yaml
# - Test generation: Generate tests from spec
# - Load Test tab: Show setup, past results
# - Analytics: Show dashboard metrics

# 5. Backend Swagger
# [Open browser: http://localhost:8000/docs]
# - Show endpoints available
# - Try: GET /health → Should return 200 ✓

# 6. Database check
$ docker-compose exec postgres psql -U postgres -d apidashboard -c "\dt"
# Show tables: users, collections, test_runs, etc.

# 7. Celery workers
$ docker-compose logs worker | tail -20
# Show: "Received task...", "Task accepted"

# 8. Persistence check (optional)
# - Go back to frontend
# - Create a collection: "Demo Collection"
# - Restart containers: docker-compose restart
# - Refresh page: Collection still there ✓
```

**Talking Points During Demo:**

```
"What you're seeing is the complete application stack:

Frontend (React, Vite): The UI you see. Built locally, bundled, served by Nginx.

Backend (FastAPI): REST API serving the frontend. Handles authentication, 
collections CRUD, test generation orchestration.

Database (PostgreSQL): Stores everything - users, collections, test results.
Built-in replication features for future scaling.

Redis: Acts as message broker for Celery.

Workers (Celery): Background task processor. Runs long-running tasks without 
blocking the API. Example: Generating 100 test cases takes 2 min. We don't want 
the user waiting - so it's async.

All services are in network 'app_net' - they can talk to each other, 
but external traffic only comes through Nginx."
```

**Demo Checkpoints - Verify:**
- [ ] Frontend loads without errors
- [ ] Can see sample data or create new
- [ ] Swagger docs accessible
- [ ] No red errors in browser console or terminal

**If Demo Fails:**
```
Plan B: Skip live navigation, show pre-recorded screenshots.
  - Have screenshots of working app in a PowerPoint as backup.
  - Say: "Network hiccup. Let me show you these screenshots..."
  - Continue with config walkthrough.
```

---

### ✅ Part 4: Prod Config Walkthrough (50 min)

**4a) Environment Configuration (10 min)**

```bash
# Show template
$ cat .env.prod.example

# Point to each section:
# Section 1: App secrets
#   APP_SECRET_KEY     - Cryptographic signing key for JWT tokens
#   BOOTSTRAP_ADMIN_PW - Initial admin password for first login

# Section 2: Database
#   POSTGRES_PASSWORD  - DB admin password
#   POSTGRES_DB        - DB name in production

# Section 3: Networking
#   INTERNAL_DOMAIN    - DNS name: api-dashboard.internal.company
#   ALLOWED_CIDRS      - IP allowlist: VPN CIDR + office IPs

# Section 4: Images
#   BACKEND_IMAGE      - Docker image URL for backend
#   DEPLOY_TAG         - Version tag (v1.0.0)
```

**Key Point:** Secrets are *not* in Git. They live in secure storage (Vault, AWS Secrets, etc). 
Environment Team (Group C) will handle this.

---

**4b) Docker Compose Prod (10 min)**

```bash
$ cat deploy/internal/docker-compose.prod.yml

# Highlight each service:

POSTGRES:
  - Persistent volume: /var/lib/postgresql/data
  - Healthcheck every 10s
  - Restart: unless-stopped
  - Production database, replicated, backed up daily

REDIS:
  - Persistent volume: append-only mode
  - Message broker for task queue
  - Healthcheck every 10s

BACKEND:
  - env_file: Loads all secrets from .env.prod
  - depends_on: postgres, redis (wait for health)
  - Healthcheck: curl /health endpoint
  - Restart: unless-stopped

WORKER:
  - Same image as backend, but runs "celery worker" command
  - Processes async tasks from Redis queue
  - Restart: unless-stopped

VOLUMES:
  - Named volumes (postgres_data, redis_data, uploads)
  - Data persists even if containers restart
  - Must be backed up daily

NETWORK:
  - app_net: Internal network only
  - Services communicate via service name (backend, postgres, etc.)
  - External traffic only through Nginx reverse proxy
```

**Question:** "What if the backend crashes? How does it recover?"
Answer: Docker sees it crashed, restarts it automatically. 
If it keeps crashing, Healthcheck fails → Docker logs it → We get alerts → On-call team investigates.

---

**4c) Nginx Configuration (15 min)**

```bash
# Show structure
$ ls -la deploy/internal/nginx/
  nginx.conf            # Global Nginx config
  conf.d/
    site.conf           # Application-specific config
    allowlist.conf      # IP allowlist (auto-generated)

# Show global config
$ cat deploy/internal/nginx/nginx.conf
# Points:
# - worker_processes auto: Use all CPU cores
# - access_log: Nginx access log (who requested what)
# - sendfile on: Efficient file serving
# - gzip on: Compress responses (faster download)

# Show application config
$ cat deploy/internal/nginx/conf.d/site.conf
# Points:
# - ssl_certificate: Path to TLS cert
# - ssl_protocols TLSv1.3: Modern crypto, drop old TLS
# - http->https redirect: Force encrypted connection
# - upstream backend: Point to FastAPI backend
# - location /api: Route /api/... to backend
# - location /: Route everything else to frontend
# - auth_basic: Basic auth (username/password)
# - rate_limit: Max 10 requests/second per IP

# Show allowlist config
$ cat deploy/internal/nginx/conf.d/allowlist.conf
# Contains: IP allow/deny rules
# Auto-generated by generate-allowlist.sh
# Example:
#   allow 10.0.0.0/8;           # Office VPN
#   allow 203.0.113.100/32;      # Specific IP
#   deny all;                    # Block everyone else

# Show certs
$ ls -la /etc/nginx/certs/
# Expected: server.crt (public), server.key (private)
```

**Key Features:**
1. **TLS Termination:** Nginx handles HTTPS. Backend is plain HTTP internally.
2. **Reverse Proxy:** Nginx sits between users and app, routes requests.
3. **Security Headers:** Nginx adds: HSTS, X-Frame-Options, CSP.
4. **Rate Limiting:** Protects against DDoS / brute force attacks.
5. **IP Allowlist:** No one gets in except VPN or office IPs.

**Question:** "Can we change allowlist IPs without restarting?"
Answer: We can, but Nginx needs to reload config. Current approach: 
  - Edit allowlist.conf
  - Reload Nginx: nginx -s reload (no connection drops)
  - Takes ~1 second

---

**4d) Deployment Scripts (10 min)**

```bash
$ cd deploy/internal/scripts
$ ls -la

# Briefly explain each:
```

| Script | What it does | When run |
|--------|-------------|----------|
| `generate-allowlist.sh` | Creates allowlist.conf from IP list | When IPs change |
| `render-nginx-config.sh` | Fills in domain name, cert paths | Pre-deploy |
| `provision-letsencrypt.sh` | Gets/renews TLS cert from Let's Encrypt | First deploy + auto-renew |
| `install-company-cert.sh` | Installs company-issued TLS cert | If using company cert |
| `create-htpasswd.sh` | Creates basic auth credentials file | When users change |
| `deploy.sh` | **MAIN**: Pull code, build images, restart | On every release |
| `rollback.sh` | Revert to previous version | If deploy fails |
| `post-deploy-checks.sh` | Smoke tests (200 OK, auth works, etc.) | Post-deploy |

**Show deploy.sh flow:**
```bash
$ cat scripts/deploy.sh | grep -E "^(echo|docker)" | head -20

# Simplified flow:
1. cd /opt/apidashboard
2. git pull origin main                    # Get latest code
3. docker compose pull                     # Download new images
4. docker compose up -d                    # Start/restart services
5. sleep 30                                # Wait for startup
6. bash scripts/post-deploy-checks.sh      # Run smoke tests
7. If tests pass: Deployment complete ✓
8. If tests fail: Rollback automatically
```

**Question:** "How long does deployment take?"
Answer: ~2-3 minutes. Image pull (~1 min) + startup (~1 min) + tests (~30 sec).

---

### ✅ Part 5: Breakout Tasks (60 min)

**At 1:40, announce:**

```
"Now we split into teams. Each team has a specific task that's needed for 
production deployment. You have 15 minutes per task.

After your task, review the deliverables with [task lead].
Any issues, raise them now - don't wait until production.

When I call time, we'll reconvene and show what each team built."
```

**Room Setup for Breakouts:**
- Team A: Corner 1 (Networking)
- Team B: Corner 2 (Security/TLS)
- Team C: Corner 3 (Platform/Secrets)
- Team D: Corner 4 (Infra/VM)

**Facilitator Notes:**
- Walk between teams every 5 minutes
- Answer questions, but don't do the work for them
- If a team finishes early: Have them review another team's work
- If a team is stuck: Simplify the task (do the hard part, let team verify)

---

### ✅ Part 6: CI/CD Pipeline (15 min)

**Reconvene at 2:40.**

```bash
$ cat .github/workflows/internal-deploy.yml | head -50

# Simplified pipeline:
name: Deploy to Production
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Build backend Docker image
      - Build frontend Docker image
      - Push images to registry
      - SSH to production VM
      - Run: docker compose pull && docker compose up -d
      - Run: bash scripts/post-deploy-checks.sh
      - If checks pass: Deployment done ✓
      - If checks fail: Rollback & alert
```

**Key Points:**
- Every push to `main` triggers deployment automatically.
- Images built and tested in CI before reaching production.
- SSH key is stored in GitHub Secrets (not in Git).
- Rollback is automatic if post-deploy checks fail.

**Questions:**
- [ ] Can we require manual approval? YES (add `environment` block to workflow)
- [ ] Can we deploy specific versions? YES (tag git commits, manually trigger with version)
- [ ] What if GitHub Actions is down? Manual deployment: SSH to VM, run `deploy.sh` locally

---

### ✅ Part 7: Monitoring & Alerting (15 min)

```
"Right now, we have:
✓ Docker health checks (auto-restart failing services)
✓ Container logs (stored 10MB per file, 5 files max)
✗ Centralized log aggregation
✗ Metrics dashboards
✗ Alerting

For production, we need to add:

LOGGING:
- ELK Stack (self-hosted, free) OR CloudWatch (AWS managed)
- All logs flow to central place
- Searchable: "Show me all 500 errors from today"

METRICS:
- Prometheus + Grafana (self-hosted, free) OR CloudWatch
- Track: CPU%, memory%, disk%, request count, error rate
- Dashboard: Real-time visibility

ALERTS:
- Slack #api-dashboard-alerts channel
- Alert on: Error rate >1%, service down, cert expires in 60 days
- PagerDuty: Escalate to on-call if not acknowledged in 15 mins

ON-CALL ROTATION:
- Who: 2-3 engineers rotate weekly
- Responsibility: First to respond to alerts
- Tools: PagerDuty, or Slack integration

This is FUTURE WORK. For launch, we have basics.
After 2 weeks of production, we add logging + metrics."
```

---

### ✅ Part 8: Q&A & Wrap-Up (15 min)

**Burn-down common questions:**

**Q: "What if we find a bug in production?"**
A: 
1. Fix the bug in code (develop/main branch)
2. Push to main
3. GitHub Actions auto-deploys within 2 minutes
4. If there are issues, rollback: `bash scripts/rollback.sh`

**Q: "What if database gets corrupted?"**
A:
1. We have daily backups (VM snapshots + DB export to S3)
2. Can restore to any day in past 30 days
3. Data loss window: At most, last 24 hours

**Q: "Can a non-DevOps person deploy?"**
A:
Yes, but restricted:
- Only via GitHub push to `main` (gated by PR reviews)
- Or GitHub Actions manual trigger (requires role-based access)
- Never direct SSH access to production

**Q: "How long can we run on a single VM?"**
A:
Internal tool (let's say 50 concurrent users):
- Single VM: Sustained easily
- 200 concurrent users: Still OK
- 500+ concurrent users: Time to scale (add more VMs, load balancer, managed DB)

**Q: "What's the worst case scenario?"**
A:
VM hardware dies → 4-hour recovery:
1. Spin up new VM (10 min)
2. Restore from backup (2 hours)
3. Run deploy.sh (10 min)
4. All data recovered, zero data loss

---

**Final Checklist:**

```
Before we finish, let's confirm:

Team A (Networking):
  ✓ Allowlist config created
  ✓ Firewall rules documented
  ✓ Next: Implement firewall rules on cloud provider

Team B (Security/TLS):
  ✓ Cert strategy decided (Let's Encrypt or Company)
  ✓ Renewal plan documented
  ✓ Next: Test cert provisioning on staging

Team C (Platform/Secrets):
  ✓ .env.prod created and secured
  ✓ Secret rotation schedule documented
  ✓ Next: Add GitHub Actions secrets

Team D (Infra/VM):
  ✓ Staging VM provisioned and deployed
  ✓ Smoke tests passing
  ✓ Rollback tested
  ✓ Next: Document runbook

If everything above has checkmarks ✓, we're ready for next phase.
Any blockers? Speak now."

[Wait for concerns - address quickly]

"Great! Next meeting: [DATE] at [TIME]
At that meeting, we'll:
1. Review blocking items (if any)
2. Finalize prod environment
3. Schedule prod deployment day

Questions? Slack: #api-dashboard-dev or email me.

Thank you all - solid work today!"
```

---

## 🚨 Troubleshooting During Demo

### Symptom: Docker containers won't start
**Diagnosis:**
```bash
docker-compose logs postgres
# Check for: password mismatch, port already in use, image not found
```
**Fix:**
```bash
# Restart Docker daemon
sudo systemctl restart docker

# Or rebuild from scratch
docker-compose down -v
docker-compose up -d
```
**Fallback:** Skip to slides/screenshots, explain what should be happening

---

### Symptom: Frontend not loading (localhost:3000 timeout)
**Diagnosis:**
```bash
docker-compose logs frontend
# Check for: build errors, port binding issues
```
**Fix:**
```bash
# Rebuild frontend
docker-compose down
docker-compose up -d --build frontend

# Check if port 3000 is free
sudo netstat -tlnp | grep 3000
```
**Fallback:** Show API docs (localhost:8000/docs) instead, say "Frontend build in progress"

---

### Symptom: Network issues / slow pulling images
**Prevention:** Pre-pull all images before demo starts:
```bash
docker-compose pull
```
**During demo:** If pulling is slow, skip that step, use local images

---

### Symptom: Team members can't SSH to their test VM
**Diagnosis:**
```bash
ssh -v ubuntu@<vm-ip>
# Check: Security group allows 22, SSH key is correct, VM is reachable
```
**Fix:**
- [ ] Test SSH from different network
- [ ] Check security group / firewall rules
- [ ] Verify SSH key has right permissions: `chmod 600 ~/.ssh/id_rsa`
**Fallback:** One person SSH in, screen-share the process for others

---

## 📋 After Demo Ends

**Send Follow-up Email:**

```
Subject: APIDashboard DevOps Demo - Follow-Up & Next Steps

Hi team,

Great session today! Here are the next steps and assigned owners:

📋 DELIVERABLES FROM BREAKOUT TASKS:

Team A (Networking) - [Name]:
  ✓ Allowlist config: deploy/internal/nginx/conf.d/allowlist.conf
  ✓ Firewall rules: Implement on [AWS/Hetzner/Azure]
  📅 Due: [DATE]

Team B (Security/TLS) - [Name]:
  ✓ Cert strategy: [Let's Encrypt / Company]
  ✓ Renewal plan: Documented
  📅 Due: [DATE]

Team C (Platform/Secrets) - [Name]:
  ✓ .env.prod: Stored securely in [Vault/Secrets Manager]
  ✓ GitHub Secrets added: DEPLOY_HOST, DEPLOY_KEY, etc.
  📅 Due: [DATE]

Team D (Infra/VM) - [Name]:
  ✓ Staging VM: Running and healthy
  ✓ Deployment tested: docker-compose up works
  ✓ Rollback tested: Works
  📅 Due: [DATE]

🎯 NEXT PHASE - STAGING DEPLOYMENT:
  Week 1: All deliverables complete
  Week 2: Deploy to staging, team testing
  Week 3: Production deployment (if staging validates)

📚 REFERENCE DOCS:
  - Full guide: docs/DEVOPS_DEMO_SESSION.md
  - Checklist: docs/DEVOPS_DEMO_CHECKLIST.md
  - Troubleshooting: docs/TROUBLESHOOTING.md

❓ QUESTIONS?
  - Slack: #api-dashboard-dev
  - Email: platform-team@company.com

See you next week!

[Your Name]
```

---

**Tips for Success:**

✅ **DO:**
- Keep demo moving (if something takes >30 seconds, skip it)
- Have backup slides/screenshots
- Split into teams early (time is precious)
- End on time (respect everyone's calendars)
- Assign clear next-step owners (don't leave ambiguous)

❌ **DON'T:**
- Go too deep into Nginx configs (level of detail matters)
- Answer every "what if" question (note it, address later)
- Let one person derail the discussion
- Leave without assigning owners to each task

---

**Demo Presenter Confidence Check:**

Before the demo, confirm you're comfortable with:
- [ ] Running `docker-compose up` and explaining each service
- [ ] Walking through Docker Compose prod file
- [ ] Explaining Nginx config (TLS, allowlist, auth, reverse proxy)
- [ ] Walking through each deployment script
- [ ] Answering: "How do we rollback?" (Answer: `bash scripts/rollback.sh`)
- [ ] Answering: "How long does deployment take?" (Answer: 2-3 mins)
- [ ] Handling: "Docker isn't starting" troubleshooting

If not comfortable, practice with a colleague beforehand. 30 mins of prep → 2.5 hours of confidence.

---

**Good luck! You've got this.** 🚀
