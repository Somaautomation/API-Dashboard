# DevOps Demo Session - Pre-Demo Setup Checklist

**Use this 24-48 hours before the demo to ensure everything is ready.**

---

## 🏢 Meeting Room / Virtual Setup (48 hours before)

### Room Booking
- [ ] Book room with large display/projector
- [ ] Test projector / HDMI cable
- [ ] Ensure WiFi is stable and fast (test: `speedtest-cli`)
- [ ] Arrange seating: Presenter in front, 4 tables for breakout teams
- [ ] Set up breakout room signs (Team A, B, C, D)

### Virtual Setup (if remote)
- [ ] Create Zoom / Teams meeting link
- [ ] Send link in calendar invite 
- [ ] Enable recording (for those who can't attend live)
- [ ] Test screen sharing (presenter)
- [ ] Have backup screen share method (if primary fails)

### AV Equipment Checklist
- [ ] Projector works and displays clearly
- [ ] Speaker/microphone working (if large room)
- [ ] Backup HDMI adapter (USB-C, VGA, etc.)
- [ ] Laptop has charge (or power cable available)

### Materials Printed/Shared
- [ ] Print agenda (1 per person)
- [ ] Print task assignment cards (Team A, B, C, D)
- [ ] Print Q&A reference card (troubleshooting tips)
- [ ] Upload docs to shared drive (Confluence, SharePoint)

---

## 💻 Demo Machine Setup (24 hours before)

### Machine Prep
```bash
# 1. Clone repository fresh
cd /tmp
rm -rf APIDashboard
git clone https://github.com/yourorg/APIDashboard.git
cd APIDashboard

# 2. Verify Docker installed
docker --version
# Expected: Docker version X.X.X

docker compose version
# Expected: Docker Compose version X.X.X

# 3. Pull all images (saves time during demo)
docker-compose pull

# 4. Start fresh containers
docker-compose down -v
docker-compose up -d

# 5. Wait for services to start
sleep 30
docker-compose logs backend | tail -20
# Expected: "Application startup complete"

# 6. Verify all services healthy
docker-compose ps
# Expected: All show "Up" or "healthy"

# 7. Quick smoke test
curl http://localhost:8000/health
# Expected: {"status": "ok"}

curl http://localhost:3000 -I | head -1
# Expected: HTTP/1.1 200 OK
```

- [ ] All containers running and healthy
- [ ] Frontend accessible at localhost:3000
- [ ] Backend accessible at localhost:8000
- [ ] Swagger docs at localhost:8000/docs
- [ ] No error logs in docker-compose logs

### Test Sample Data (Optional but recommended)
```bash
# Seed sample data if your app has fixtures
docker-compose exec backend python -m scripts.seed_sample_data

# Or manually create:
# - 1 user (admin@company.com)
# - 1 OpenAPI spec (upload petstore.yaml)
# - 1 collection with test cases
# - 1 load test scenario
```

- [ ] Frontend shows sample data (collections, tests, etc.)
- [ ] Can navigate without errors
- [ ] Can see what features look like in action

### Browser Tab Preparation
```
Have these tabs open BEFORE demo starts:
1. http://localhost:3000              (Frontend demo)
2. http://localhost:8000/docs         (Swagger docs)
3. https://github.com/yourorg/API...  (Repo, for showing code)
   - Bookmark: docs/INTERNAL_DEPLOYMENT.md
   - Bookmark: deploy/internal/docker-compose.prod.yml
   - Bookmark: deploy/internal/nginx/
   - Bookmark: deploy/internal/scripts/
4. Presentation slides (PowerPoint/Google Slides)
5. Shared doc: DEVOPS_DEMO_SESSION.md (for reference)
```

- [ ] All tabs load quickly (pre-load them now)
- [ ] No authentication required (or login beforehand)
- [ ] Zoom to readable font size (125-150%)

### Terminal Preparation
```
Have 3 terminals open, positioned on screen:

Terminal 1 (left): Docker commands
  $ cd /path/to/APIDashboard
  [Ready for: docker-compose ps, logs, exec, etc.]

Terminal 2 (right): File viewing
  $ cd /path/to/APIDashboard/deploy/internal
  [Ready for: cat scripts/*.sh, showing configs]

Terminal 3 (bottom): Spare
  [For troubleshooting if needed]
```

- [ ] All terminals SSH'd into correct directories
- [ ] Fonts sized large enough for audience to read

---

## 🎯 Participant Prep (Send email 48 hours before)

### Email Template to Send

```
Subject: DevOps Demo Session - [DATE] - Please Prepare

Hi team,

We're hosting an internal demo of APIDashboard's production deployment architecture.
This is a hands-on session where each team will configure a critical piece of the 
infrastructure puzzle.

📅 DATE: [DATE]
⏰ TIME: [TIME] - [END TIME] (2.5 hours)
📍 LOCATION: [ROOM / ZOOM LINK]

👥 WHO SHOULD ATTEND:
- DevOps/Infrastructure engineers
- Platform team
- Security/Compliance team
- SRE team
- Backend platform leads

📋 WHAT TO PREPARE:

1. LAPTOP & DOCKER:
   - Bring laptop with Docker Desktop installed
   - If not installed: https://docs.docker.com/get-docker/
   - Have 5 GB free disk space for Docker images

2. INFORMATION GATHERING:
   Bring (or look up during session):
   - Your external IP: curl https://ifconfig.me
   - Company VPN CIDR (ask network team)
   - Office IP address / range
   - Any regional considerations for hosting
   
3. READING:
   - Read (5 mins): docs/INTERNAL_DEPLOYMENT.md - Overview section
   - Skim (10 mins): docs/INTERNAL_DEPLOYMENT.md - Files Added section
   
4. QUESTIONS:
   Come with questions like:
   - "How do we handle HA (high availability)?"
   - "What if this VM goes down?"
   - "How do we monitor this in production?"

📚 DOCUMENTS:
After the session, refer to:
- docs/DEVOPS_DEMO_SESSION.md (detailed guide)
- docs/DEVOPS_DEMO_CHECKLIST.md (task breakdowns)
- docs/DEVOPS_DEMO_PLAYBOOK.md (presenter notes)

🔗 REPO:
Clone the repo to follow along (optional):
  git clone https://github.com/yourorg/APIDashboard.git
  cd APIDashboard
  docker-compose up -d

❓ QUESTIONS BEFORE SESSION?
Contact: [Platform Lead] @ [email/slack]

Looking forward to seeing you there!

[Your Name]
```

**Send to all participants:**
- [ ] 48 hours before: Full email with prep instructions
- [ ] 24 hours before: Calendar reminder
- [ ] 1 hour before: Zoom link / room details re-confirmation

---

## 🎓 Slides Preparation

### Slide Deck Outline

**Slide 1: Title**
- APIDashboard: Moving from Local Development to Production
- Date, Time, Agenda

**Slide 2: Agenda (5-minute version)**
```
1. Why we're doing this (cost, simplicity, security)
2. See the app working (live demo)
3. Understand production architecture
4. Teams configure critical pieces
5. CI/CD pipeline walkthrough
6. Monitoring & next steps
```

**Slide 3: Team Roles**
```
Platform Lead:  Explains architecture, runs demo
DevOps Lead:    Deep dive on configs and scripts
Infra Lead:     VM provisioning and deployment
Security Lead:  Cert strategy and security review
```

**Slide 4: Success Criteria**
```
✓ Everyone understands the architecture
✓ Each team knows their task
✓ Blockers identified and noted
✓ Next meeting scheduled with clear owners
✓ Timeline clear: Staging (Week 1), Production (Week 3)
```

**Slide 5: Architecture Diagram**
```
Show:
Users → VPN → Firewall → Nginx (TLS + Auth + Allowlist) 
                          → App (Backend + Frontend)
                          → PostgreSQL
                          → Redis
                          → Celery Workers
```

**Slide 6: Cost Breakdown**
```
Single VM:              $10-15/month
  ✓ App runs here
  ✓ Database runs here
  ✓ Redis runs here
  ✓ Workers run here

DNS:                    $0-5/month
TLS Certificates:       $0 (Let's Encrypt)
Backups:                $5-10/month (cloud storage)
─────────────────────
TOTAL:                  ~$20-30/month
```

**Slide 7: Security Posture**
```
✓ VPN-only access (no public internet)
✓ IP allowlist (specific offices/IPs only)
✓ Basic auth (username/password)
✓ TLS encryption (all traffic encrypted)
✓ No direct database access (only through app)
✓ Audit logs (who did what, when)
```

**Slide 8-10: Live Demo Notes**
```
(Slide with key points)
- Frontend: React app with dashboard
- Backend: FastAPI REST API
- Database: PostgreSQL for persistence
- Workers: Celery for background tasks
- Redis: Message broker + cache
```

**Slide 11: Breakout Tasks Summary**
```
Team A: IP Allowlist & Firewall Rules
  📋 Deliverable: allowlist.conf + firewall plan
  ⏱️ Time: 15 mins

Team B: TLS Certificate Strategy
  📋 Deliverable: Cert choice + renewal plan
  ⏱️ Time: 20 mins

Team C: Secrets & Environment Config
  📋 Deliverable: .env.prod + secret rotation plan
  ⏱️ Time: 15 mins

Team D: VM Provisioning & Deployment
  📋 Deliverable: Staging VM ready + rollback tested
  ⏱️ Time: 15 mins
```

**Slide 12: Deployment Pipeline**
```
Git Push to main
    ↓
GitHub Actions triggered
    ↓
Build Docker images
    ↓
Push to registry
    ↓
SSH to production VM
    ↓
Docker compose pull & up
    ↓
Health checks
    ↓
Deployment complete ✓ or Rollback ✗
```

**Slide 13: Q&A + Next Steps**
```
Next Meeting: [DATE] [TIME]
  - Review blockers
  - Finalize prod environment
  - Approve deployment window

Deliverable Due: [DATE]
  - Staging environment fully functional
  - All team tasks complete
  - No critical blockers

Production Deploy: [DATE] (if approved)
  - During [TIME WINDOW]
  - With [PARTICIPANTS] on-call
```

---

## 📝 Task Assignment Cards

### Print These for Distribution During Breakout Tasks

**Card A - Team A: Networking & IP Allowlist**
```
┌─────────────────────────────────────┐
│ 🔐 TEAM A: IP ALLOWLIST & FIREWALL  │
├─────────────────────────────────────┤
│ GOAL: Create production IP allowlist │
│       and firewall rules             │
│                                     │
│ TASKS (15 mins):                    │
│ 1. Gather team IPs (curl ifconfig)  │
│ 2. Run generate-allowlist.sh        │
│ 3. Plan firewall rules              │
│ 4. Review with security team        │
│                                     │
│ DELIVERABLE:                        │
│ ☐ allowlist.conf (ready to use)     │
│ ☐ Firewall rules doc                │
│                                     │
│ HELP: grep -r "allowlist" *.conf    │
│ STUCK? Ask DevOps Lead              │
└─────────────────────────────────────┘
```

**Card B - Team B: TLS Certificates**
```
┌─────────────────────────────────────┐
│ 🔒 TEAM B: TLS CERTIFICATE STRATEGY │
├─────────────────────────────────────┤
│ GOAL: Decide cert approach and plan │
│       renewal process               │
│                                     │
│ TASKS (20 mins):                    │
│ 1. Decide: Let's Encrypt vs Company │
│ 2. Document renewal process         │
│ 3. Set up monitoring/alerting       │
│ 4. Test provisioning (optional)     │
│                                     │
│ DELIVERABLE:                        │
│ ☐ Cert decision documented          │
│ ☐ Renewal plan                      │
│ ☐ Expiry monitoring set up          │
│                                     │
│ HELP: cat deploy/internal/scripts/  │
│       provision-letsencrypt.sh      │
│ STUCK? Ask Security Lead            │
└─────────────────────────────────────┘
```

**Card C - Team C: Secrets & Config**
```
┌─────────────────────────────────────┐
│ 🔑 TEAM C: SECRETS & ENVIRONMENT    │
├─────────────────────────────────────┤
│ GOAL: Generate and securely store   │
│       production environment config  │
│                                     │
│ TASKS (15 mins):                    │
│ 1. Generate strong secrets          │
│ 2. Create .env.prod                 │
│ 3. Store securely (Vault/Secrets)   │
│ 4. Document rotation plan           │
│                                     │
│ DELIVERABLE:                        │
│ ☐ .env.prod (secure storage)        │
│ ☐ Secret rotation procedure         │
│ ☐ Access control documented         │
│                                     │
│ HELP: cat .env.prod.example         │
│       openssl rand -base64 32       │
│ STUCK? Ask Platform Lead            │
└─────────────────────────────────────┘
```

**Card D - Team D: VM & Deployment**
```
┌─────────────────────────────────────┐
│ 🚀 TEAM D: VM PROVISIONING & DEPLOY │
├─────────────────────────────────────┤
│ GOAL: Set up test VM and validate   │
│       deployment process works      │
│                                     │
│ TASKS (15 mins):                    │
│ 1. Bootstrap VM (Docker, git)       │
│ 2. Clone repo and .env.prod         │
│ 3. Run docker-compose up -d         │
│ 4. Test rollback script             │
│                                     │
│ DELIVERABLE:                        │
│ ☐ Test VM ready and healthy         │
│ ☐ Services running                  │
│ ☐ Rollback tested                   │
│ ☐ Runbook documented                │
│                                     │
│ HELP: bash scripts/deploy.sh        │
│       bash scripts/post-deploy-*.sh │
│ STUCK? Ask Infra Lead               │
└─────────────────────────────────────┘
```

---

## ✅ Demo Machine Final Checklist

### 30 Minutes Before Demo Starts

- [ ] All containers still running (docker-compose ps)
- [ ] All services healthy (no warnings/errors)
- [ ] Sample data visible in frontend
- [ ] All browser tabs open and responsive
- [ ] All terminals ready and positioned
- [ ] Slides open and readable
- [ ] WiFi stable (run: ping -c 5 8.8.8.8)
- [ ] Projector/display working
- [ ] Audio/microphone working
- [ ] Recording enabled (if capturing session)

### 5 Minutes Before Demo Starts

- [ ] Greet first arrivals
- [ ] Have them sit and test WiFi on their laptops
- [ ] Point to printed materials on tables
- [ ] Answer any last-minute questions

---

## 🆘 Troubleshooting Pre-Demo

### Issue: Docker containers not starting
```bash
# Check what's wrong
docker-compose logs postgres
docker-compose logs backend

# Fix: Restart Docker
sudo systemctl restart docker
docker-compose down -v
docker-compose up -d --build
```

### Issue: Port already in use
```bash
# Find what's using port 3000, 8000, 5432, etc.
sudo lsof -i :3000
sudo lsof -i :8000

# Kill process (if safe) or use different port
kill -9 <PID>
```

### Issue: Not enough disk space
```bash
# Check available space
df -h

# Clean up Docker images/volumes
docker system prune -a
docker volume prune
```

### Issue: WiFi is unstable
**Solution:** Use ethernet cable instead. If not available:
- Move closer to router
- Ask IT to increase signal in meeting room
- Have backup: Run demo on phone hotspot as Plan B

### Issue: Last-minute code changes needed
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose down -v
docker-compose up -d --build

# Wait for startup
docker-compose logs -f backend | grep "startup complete"
```

---

## 📞 On-Demo Emergency Contacts

**Have these on speed-dial:**

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Platform Lead | [Name] | [#] | @[username] |
| DevOps Lead | [Name] | [#] | @[username] |
| IT Support | [Name] | [#] | @[username] |
| Backup Presenter | [Name] | [#] | @[username] |

---

## 🎬 Demo Day (Morning Of)

### 1 Hour Before
- [ ] Arrive early to room/log into Zoom
- [ ] Final systems check (all running, tabs loaded)
- [ ] Personal prep (bathroom, coffee, notes)

### 30 Minutes Before
- [ ] Greet arriving attendees
- [ ] Make sure WiFi works for everyone
- [ ] Distribute task assignment cards (face-down on tables)
- [ ] Acknowledge: "We'll flip these over at [TIME]"

### 15 Minutes Before
- [ ] Start recording (if applicable)
- [ ] Have everyone take seats
- [ ] Do quick WiFi speed test (should be >10 Mbps)
- [ ] Say: "We'll start in 15 minutes. Grab coffee/water now."

### Demo Start
- [ ] START ON TIME (shows respect for calendars)
- [ ] Acknowledge late arrivals but keep going
- [ ] Welcome everyone and launch into agenda

---

## ✨ After Demo

### Immediately After
- [ ] Thank everyone for attendance
- [ ] Announce follow-up meeting date/time
- [ ] Share link to recorded session (if recorded)
- [ ] Share link to all documents (GitHub repo)

### Within 1 Hour
- [ ] Send follow-up email (template in DEVOPS_DEMO_PLAYBOOK.md)
- [ ] List action items and owners
- [ ] Confirm dates and commitments

### Within 24 Hours
- [ ] Capture feedback (2-min anonymous survey)
- [ ] Note any issues or confusion for future sessions
- [ ] Update docs based on Q&A

---

## 📊 Success Metrics

After demo, you should have:

✅ **Attendance:** 90%+ of invited attendees present
✅ **Engagement:** Teams actively participated in breakout tasks
✅ **Deliverables:** All 4 teams completed their tasks
✅ **Understanding:** Audience can explain: what's being built, why, when, who does what
✅ **Commitment:** Clear owners assigned to each deliverable
✅ **Timeline:** Staging deployment date set and approved

---

**Demo Lead Confidence Checklist:**

Before hitting "start" on the presentation, confirm:

- [ ] You can run `docker-compose up` and it works every time
- [ ] You understand why each service exists (can explain to non-tech person)
- [ ] You can navigate the app frontend without errors
- [ ] You can walk through Nginx config and explain TLS/allowlist/auth
- [ ] You know the scripts: what each does, when it runs
- [ ] You can answer: "What if it fails?" → Rollback
- [ ] You can answer: "How long does deploy take?" → 2-3 mins
- [ ] You can troubleshoot basic Docker issues

If not confident in any of above, practice with a colleague first. 30 mins practice = 2.5 hours confidence.

---

**You're ready! 🚀**

Print this checklist, check off items as you prep, and bring it to the demo.
Questions? Slack #api-dashboard-dev.
