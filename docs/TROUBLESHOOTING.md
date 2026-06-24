# Troubleshooting: Site Can't Be Reached

If you see "site can't be reached" or connection timeout when accessing `https://api-dashboard.internal.company/`, follow this troubleshooting guide.

## Step 1: Verify DNS Resolution

```bash
# On your local machine
nslookup api-dashboard.internal.company
# or
dig api-dashboard.internal.company

# Should return the VM's internal IP (e.g., 10.x.x.x)
```

**If DNS fails:**
- Check your internal DNS server has the correct record
- Verify you're on the VPN
- Try using the VM's direct IP instead: `https://10.20.0.100` (replace with actual IP)

---

## Step 2: Verify Network Connectivity to VM

```bash
# Check if VM is reachable
ping api-dashboard.internal.company
# or
ping <VM_IP>

# Check if port 443 is open
nc -zv api-dashboard.internal.company 443
# or
curl -v https://api-dashboard.internal.company --connect-timeout 5
```

**If ping/port fails:**
- Verify you're connected to VPN
- Check VM firewall allows inbound 443 from your IP
- Check cloud provider security group/firewall rules allow 443
- Verify the INTERNAL_DOMAIN and VM IP in .env.prod match your actual setup

---

## Step 3: SSH to VM and Check Container Status

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard

# Check if containers are running
docker ps

# Expected output:
# - nginx (port 443)
# - backend (port 8000)
# - frontend (port 80)
# - postgres
# - redis
# - worker
```

**If containers are not running:**
```bash
# View compose logs
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs

# Try to start them
bash ./deploy/internal/scripts/deploy.sh
```

---

## Step 4: Check Nginx is Listening on 443

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard

# Check if Nginx is listening
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs nginx

# Should see:
# nginx: configuration file /etc/nginx/nginx.conf test is successful
# [notice] signal process started
```

**If Nginx failed to start:**
```bash
# Check Nginx config syntax
docker run --rm -v $(pwd)/deploy/internal/nginx:/etc/nginx:ro nginx:1.27-alpine nginx -t

# View detailed Nginx error logs
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec nginx cat /var/log/nginx/error.log
```

---

## Step 5: Verify SSL Certificate Exists

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard

# Check certificate location
ls -la deploy/internal/nginx/certbot/conf/live/internal/

# Should show:
# fullchain.pem
# privkey.pem

# Check certificate validity
openssl x509 -in deploy/internal/nginx/certbot/conf/live/internal/fullchain.pem -noout -text | grep -A2 "Validity"
```

**If certificate doesn't exist:**
- Run: `bash ./deploy/internal/scripts/provision-letsencrypt.sh` (Let's Encrypt)
- Or: `bash ./deploy/internal/scripts/install-company-cert.sh /path/to/cert /path/to/key` (company cert)

---

## Step 6: Test Backend and Frontend Containers

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard

# Test backend health
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec backend curl -s http://localhost:8000/health

# Should return: {"status":"ok","app":"...","env":"production"}

# Test frontend
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec frontend curl -s http://localhost/healthz

# Should return: ok

# View backend logs for errors
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs backend | tail -50
```

**If backend fails to start:**
- Check database connection: `DATABASE_URL` in .env.prod
- Check Redis connection: `REDIS_URL` in .env.prod
- Verify Postgres is healthy: `docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs postgres`

---

## Step 7: Test Nginx Locally on VM

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard

# Test health check endpoint (no auth required)
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec nginx \
  curl -v http://localhost/healthz

# Should return: ok

# Test with HTTPS and basic auth (internally, without cert verification)
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec nginx \
  curl -v -k https://localhost/healthz
```

**If Nginx responds but you can't reach from client:**
- Firewall is blocking 443 (check cloud provider rules)
- You're not on the VPN
- VM's public IP has changed (verify with `curl ifconfig.me` on VM)

---

## Step 8: Check .env.prod Configuration

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard
cat .env.prod | grep -E "INTERNAL_DOMAIN|ALLOWED_CIDRS|POSTGRES_PASSWORD|DATABASE_URL"

# Verify:
# - INTERNAL_DOMAIN matches your DNS name
# - ALLOWED_CIDRS includes your VPN CIDR
# - DATABASE_URL has correct POSTGRES_PASSWORD
# - All required variables are set (no empty values)
```

---

## Step 9: Regenerate Nginx Config

If you changed .env.prod values:

```bash
ssh ubuntu@<VM_IP>
cd /opt/apidashboard

bash ./deploy/internal/scripts/generate-allowlist.sh
bash ./deploy/internal/scripts/render-nginx-config.sh

# Restart Nginx
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml restart nginx

# Check it started
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs nginx | tail -20
```

---

## Step 10: Test from Local Machine

Once everything is running on VM:

```bash
# From your local machine (on VPN)

# 1. Check DNS
nslookup api-dashboard.internal.company

# 2. Check IP connectivity
ping <resolved_ip>

# 3. Check port is open
nc -zv api-dashboard.internal.company 443

# 4. Test HTTPS (ignore cert warning if using self-signed)
curl -v -k https://api-dashboard.internal.company/healthz

# 5. Test in browser with auth
# Visit: https://api-dashboard.internal.company
# Enter username/password from htpasswd
```

---

## Quick Diagnostic Script

Run this on the VM to gather diagnostic info:

```bash
#!/bin/bash
cd /opt/apidashboard

echo "=== Containers ==="
docker ps --all

echo "=== Nginx Status ==="
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs nginx | tail -10

echo "=== Backend Status ==="
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml logs backend | tail -10

echo "=== Certificate ==="
ls -la deploy/internal/nginx/certbot/conf/live/internal/ 2>/dev/null || echo "No certificate found"

echo "=== Health Checks ==="
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec -T nginx curl -s http://localhost/healthz 2>&1 | head -1
docker compose --env-file .env.prod -f deploy/internal/docker-compose.prod.yml exec -T backend curl -s http://localhost:8000/health 2>&1 | head -1

echo "=== Network ==="
ip addr | grep "inet " | grep -v "127.0"
```

---

## Common Issues & Solutions

| Symptom | Cause | Solution |
|---------|-------|----------|
| Connection timeout | Firewall blocks 443 | Check cloud security group/firewall |
| DNS not resolving | Wrong DNS record | Update internal DNS with VM IP |
| 502 Bad Gateway | Backend not running | Check `docker compose logs backend` |
| 403 Forbidden | Wrong Nginx basic auth | Verify htpasswd file exists and user added |
| SSL certificate error | Cert not found/expired | Run cert provision script |
| Containers exit immediately | Config error | Check `docker compose logs` for errors |

---

## If Still Stuck

Gather this info and share with your DevOps team:

1. VM public/private IP
2. INTERNAL_DOMAIN you're trying to access
3. Your VPN CIDR (or office IP)
4. Output of: `docker compose logs` on VM
5. Output of: `curl -v https://api-dashboard.internal.company` from your machine
6. Output of: `openssl s_client -connect api-dashboard.internal.company:443` from your machine
