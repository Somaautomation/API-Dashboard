# GitHub Secrets & VM Setup Guide

This guide walks you through configuring GitHub secrets and preparing your VM for automated deployments.

## 1) VM Preparation

### 1a) Provision Linux VM (Ubuntu 22.04/24.04)

On your cloud provider (AWS, Azure, Hetzner, etc.):
- Create VM with at least 2 CPU, 4GB RAM, 50GB disk
- Allow inbound 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Assign static public IP or elastic IP
- Create internal DNS record (e.g., api-dashboard.internal.company) pointing to the VM

### 1b) SSH into VM and install dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
  docker.io \
  docker-compose-plugin \
  git \
  curl \
  gettext-base

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker works
docker --version
docker compose version
```

### 1c) Clone repository and prepare deployment directory

```bash
mkdir -p /opt/apidashboard
cd /opt/apidashboard
git clone https://github.com/Somaautomation/API-Dashboard.git .
git checkout main

# Create secrets directory
mkdir -p secrets

# Copy and customize production environment
cp .env.prod.example .env.prod
```

### 1d) Configure .env.prod

Edit `/opt/apidashboard/.env.prod` with your values:

```bash
nano .env.prod
```

Key values to change:

```env
# -------- Deployment metadata --------
DEPLOY_TAG=latest
BACKEND_IMAGE=ghcr.io/Somaautomation/apidashboard-backend
FRONTEND_IMAGE=ghcr.io/Somaautomation/apidashboard-frontend
INTERNAL_DOMAIN=api-dashboard.internal.company          # Your internal domain
LETSENCRYPT_EMAIL=devops@company.com                     # Your email for cert renewal
ALLOWED_CIDRS=10.20.0.0/16,10.30.0.0/16,203.0.113.10/32 # Your VPN/office CIDRs

# -------- Postgres container --------
POSTGRES_USER=zpe
POSTGRES_PASSWORD=StrongPostgresPasswordHere             # Change this!

# -------- App --------
APP_ENV=production
APP_DEBUG=false
APP_SECRET_KEY=replace-with-64-char-random-value        # Generate: openssl rand -hex 32
APP_ENCRYPTION_KEY=replace-with-valid-fernet-key        # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# -------- Auth --------
BOOTSTRAP_ADMIN_EMAIL=admin@company.com
BOOTSTRAP_ADMIN_PASSWORD=StrongAdminPasswordHere         # Change this!

# -------- Database --------
DATABASE_URL=postgresql+asyncpg://zpe:StrongPostgresPasswordHere@postgres:5432/zpe_api_platform
DATABASE_SYNC_URL=postgresql+psycopg://zpe:StrongPostgresPasswordHere@postgres:5432/zpe_api_platform
```

### 1e) Create Nginx basic auth user

```bash
bash ./deploy/internal/scripts/create-htpasswd.sh internal_user StrongPasswordHere
```

This creates `secrets/htpasswd` file used by Nginx.

### 1f) Generate Nginx allowlist and render config

```bash
bash ./deploy/internal/scripts/generate-allowlist.sh
bash ./deploy/internal/scripts/render-nginx-config.sh
```

### 1g) Install SSL certificate

**Option A: Company/Internal Certificate (recommended)**

If you have a certificate from your internal CA or company:

```bash
bash ./deploy/internal/scripts/install-company-cert.sh \
  /path/to/fullchain.pem \
  /path/to/privkey.pem
```

**Option B: Let's Encrypt**

```bash
bash ./deploy/internal/scripts/provision-letsencrypt.sh
```

Then enable automatic renewal (optional):

```bash
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml --profile certbot up -d certbot
```

### 1h) Test manual deployment

```bash
bash ./deploy/internal/scripts/deploy.sh
bash ./deploy/internal/scripts/post-deploy-checks.sh
```

Verify:
```bash
curl -k https://api-dashboard.internal.company/healthz
```

---

## 2) GitHub Secrets Configuration

### 2a) Generate SSH key pair for deployment

On a local machine or your deployment user on the VM:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -C "github-actions@apidashboard"
# Press Enter twice (no passphrase for CI/CD)
```

This creates:
- `~/.ssh/github-deploy` (private key)
- `~/.ssh/github-deploy.pub` (public key)

### 2b) Add public key to VM authorized_keys

On the VM:

```bash
# As deployment user or sudo
mkdir -p ~/.ssh
echo "$(cat /path/to/github-deploy.pub)" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 2c) Add secrets to GitHub

Navigate to: **GitHub Repository → Settings → Secrets and variables → Actions**

Click **"New repository secret"** and add these 6 secrets:

| Secret Name | Value | Example |
|---|---|---|
| `DEPLOY_SSH_HOST` | VM public IP or DNS | `203.0.113.10` or `deploy.example.com` |
| `DEPLOY_SSH_USER` | SSH user on VM | `ubuntu` or `deploy` |
| `DEPLOY_SSH_KEY` | Contents of private key (github-deploy) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_SSH_PORT` | SSH port (usually 22) | `22` |
| `DEPLOY_PATH` | Absolute path to repo on VM | `/opt/apidashboard` |
| `INTERNAL_DOMAIN` | Internal domain from .env.prod | `api-dashboard.internal.company` |

**To copy the private key safely:**

```bash
# On local machine
cat ~/.ssh/github-deploy | xclip -selection clipboard
# Or on macOS
cat ~/.ssh/github-deploy | pbcopy
# Or on Windows PowerShell
Get-Content ~/.ssh/github-deploy | Set-Clipboard
```

Then paste into the GitHub secret value field.

### 2d) Verify SSH connectivity from GitHub

In GitHub, go to **Settings → Deploy keys** and verify the public key is listed (GitHub may add it automatically).

Test SSH connectivity from any GitHub Actions runner logs or manually:

```bash
ssh -i path/to/github-deploy -p 22 ubuntu@203.0.113.10 "cd /opt/apidashboard && git status"
```

---

## 3) Trigger Your First Deployment

### 3a) Push a commit to main

```bash
# On your local machine
git add .
git commit -m "Enable automated deployments"
git push origin main
```

### 3b) Monitor the workflow

1. Go to **GitHub Repository → Actions**
2. Click the latest **"internal-deploy"** workflow run
3. Watch logs as it builds, pushes images, and deploys to your VM

### 3c) Verify deployment succeeded

Check the workflow logs for:
- ✅ Build backend image
- ✅ Build frontend image
- ✅ Push to GHCR
- ✅ Deploy over SSH
- ✅ Health checks pass

Then verify manually:

```bash
curl -k -u internal_user:StrongPasswordHere https://api-dashboard.internal.company/healthz
```

---

## 4) Manual Rollback

If a deployment breaks, rollback to a previous image tag via the GitHub Actions UI:

1. Go to **Actions → internal-deploy**
2. Click **"Run workflow"**
3. Select **mode: "rollback"**
4. Enter the previous **rollback_tag** (commit SHA visible in workflow logs)
5. Click **"Run workflow"**

Or do it manually on the VM:

```bash
bash ./deploy/internal/scripts/rollback.sh <previous_commit_sha>
bash ./deploy/internal/scripts/post-deploy-checks.sh
```

---

## 5) Troubleshooting

### SSH key rejected by GitHub Actions

- Verify the private key is in the secret exactly as-is (including `-----BEGIN...-----END-----`)
- Ensure no extra whitespace
- Check DEPLOY_SSH_HOST and DEPLOY_SSH_USER are correct

### Deployment fails on "permission denied"

- Verify SSH user has write permissions to `/opt/apidashboard`
- Check Docker group membership: `groups ubuntu`
- Re-add to group if needed: `sudo usermod -aG docker ubuntu`

### health check fails after deploy

- Check logs: `docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs backend`
- Verify .env.prod DATABASE_URL is correct
- Check Nginx config: `docker compose logs nginx`

### Certificate issues

- Verify cert path in `deploy/internal/nginx/conf.d/site.conf`
- Check cert expiration: `openssl x509 -in deploy/internal/nginx/certbot/conf/live/internal/fullchain.pem -noout -text | grep -A2 "Validity"`

---

## 6) Monitoring and Maintenance

### View logs

```bash
# All services
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs -f

# Specific service
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs -f backend
```

### Update secrets without redeploying

Edit `.env.prod` directly on the VM and restart:

```bash
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml restart backend
```

### Backup database

```bash
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec postgres \
  pg_dump -U zpe zpe_api_platform > /opt/apidashboard/backups/db-$(date +%Y%m%d-%H%M%S).sql
```

---

## 7) Quick Reference Commands

```bash
# SSH into VM
ssh -i ~/.ssh/github-deploy ubuntu@203.0.113.10

# Start/stop deployment
cd /opt/apidashboard
bash ./deploy/internal/scripts/deploy.sh
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml stop

# Check status
curl -k https://api-dashboard.internal.company/healthz
docker ps

# View logs
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs -f
```
