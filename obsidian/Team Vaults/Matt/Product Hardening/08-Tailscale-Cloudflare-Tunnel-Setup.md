# Tailscale + Cloudflare Tunnel Setup Guide

## Overview

This guide explains how to combine **Tailscale** (private network access) with **Cloudflare Tunnels** (public access) to create a flexible, secure infrastructure on your Mac Studio.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Mac Studio                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Orchestrator │  │  Hyperarchy  │  │ Book Writer  │     │
│  │ AI (v1)      │  │              │  │              │     │
│  │ Port 9000    │  │ Port 9100    │  │ Port 9200    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Orchestrator │  │ Research AI   │  │  Supabase    │     │
│  │ AI (v2)      │  │               │  │  Port 9010  │     │
│  │ Port 9001    │  │ Port 9300    │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │                              │
    ┌────▼────┐                    ┌────▼────┐
    │Tailscale│                    │Cloudflare│
    │(Private)│                    │  Tunnel  │
    │         │                    │ (Public) │
    └─────────┘                    └──────────┘
         │                              │
         │                              │
    Authorized                    Public Internet
    Devices Only                  (via Cloudflare)
```

## How They Work Together

### Tailscale (Private Access)
- **Purpose**: Secure, encrypted access for authorized devices only
- **Access**: MacBook, nephews' computers, your devices
- **Use Cases**: 
  - Development/testing
  - Admin access
  - Internal tools (Supabase Studio)
  - Services that should never be public

### Cloudflare Tunnel (Public Access)
- **Purpose**: Public access to specific apps/services
- **Access**: Anyone on the internet (with Cloudflare security)
- **Use Cases**:
  - Customer-facing apps
  - Demo environments
  - Public APIs
  - Apps you want to share publicly

### Key Benefits

1. **Same Services, Different Access Methods**
   - Tailscale: `http://mac-studio-name:9000` (private)
   - Cloudflare: `https://orchestrator-v1.yourdomain.com` (public)

2. **Security Layers**
   - Tailscale: Encrypted mesh network
   - Cloudflare: DDoS protection, WAF, rate limiting, SSL/TLS

3. **Flexibility**
   - Some apps private only (Supabase Studio)
   - Some apps public only (customer demos)
   - Some apps both (development + public demo)

---

## Setup: Cloudflare Tunnel

### Step 1: Install Cloudflared

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Or download from:
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### Step 2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window. Log in to your Cloudflare account and authorize the tunnel.

### Step 3: Create a Tunnel

```bash
# Create a named tunnel
cloudflared tunnel create mac-studio-tunnel

# This creates a tunnel and saves credentials
# Output shows: Tunnel ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 4: Create Configuration File

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: mac-studio-tunnel
credentials-file: /Users/yourusername/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

# Route different apps to different subdomains
ingress:
  # Orchestrator AI v1
  - hostname: orchestrator-v1.yourdomain.com
    service: http://localhost:9000
  
  # Orchestrator AI v2
  - hostname: orchestrator-v2.yourdomain.com
    service: http://localhost:9001
  
  # Hyperarchy
  - hostname: hyperarchy.yourdomain.com
    service: http://localhost:9100
  
  # Book Writer (Nephew's app)
  - hostname: bookwriter.yourdomain.com
    service: http://localhost:9200
  
  # Research AI (Son's app)
  - hostname: research-ai.yourdomain.com
    service: http://localhost:9300
  
  # Catch-all (optional - returns 404 for unmatched routes)
  - service: http_status:404
```

### Step 5: Create DNS Records

For each subdomain, create a CNAME record in Cloudflare DNS:

```bash
# Via Cloudflare Dashboard:
# DNS → Records → Add Record

# For each app:
Type: CNAME
Name: orchestrator-v1 (or orchestrator-v2, hyperarchy, etc.)
Target: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com
Proxy: ON (orange cloud)
```

**Or use Cloudflare API:**

```bash
# Get your Zone ID from Cloudflare Dashboard
ZONE_ID="your-zone-id"
TUNNEL_ID="your-tunnel-id"

# Create DNS record for each app
cloudflared tunnel route dns mac-studio-tunnel orchestrator-v1.yourdomain.com
cloudflared tunnel route dns mac-studio-tunnel orchestrator-v2.yourdomain.com
cloudflared tunnel route dns mac-studio-tunnel hyperarchy.yourdomain.com
cloudflared tunnel route dns mac-studio-tunnel bookwriter.yourdomain.com
cloudflared tunnel route dns mac-studio-tunnel research-ai.yourdomain.com
```

### Step 6: Run the Tunnel

**Option A: Run as Service (Recommended)**

```bash
# Install as macOS service
sudo cloudflared service install

# Start the service
sudo cloudflared service start

# Check status
sudo cloudflared service status

# View logs
sudo cloudflared service logs
```

**Option B: Run Manually (Testing)**

```bash
cloudflared tunnel run mac-studio-tunnel
```

**Option C: Run in Background (Development)**

```bash
# Using nohup
nohup cloudflared tunnel run mac-studio-tunnel > /tmp/cloudflared.log 2>&1 &

# Or using tmux/screen
tmux new -s cloudflared
cloudflared tunnel run mac-studio-tunnel
# Press Ctrl+B then D to detach
```

---

## Port Allocation Strategy

### Current Port Assignments

Based on your codebase, here's a suggested port allocation:

| Port | Service | Access Method | Notes |
|------|---------|---------------|-------|
| 9000 | Orchestrator AI v1 | Both | Main production version |
| 9001 | Orchestrator AI v2 | Both | Next version/dev |
| 9100 | Hyperarchy | Public (Cloudflare) | Customer-facing |
| 9200 | Book Writer | Public (Cloudflare) | Nephew's app |
| 9300 | Research AI | Public (Cloudflare) | Son's app |
| 9010 | Supabase API | Private (Tailscale) | Never expose publicly |
| 9012 | Supabase Studio | Private (Tailscale) | Admin only |
| 6200 | LangGraph | Private (Tailscale) | Internal service |
| 5678 | N8N | Private (Tailscale) | Workflow automation |

### Environment Variables

Create separate `.env` files for each app/service:

**Orchestrator AI v1** (`.env.v1`):
```env
API_PORT=9000
NODE_ENV=production
SUPABASE_URL=http://localhost:9010
```

**Orchestrator AI v2** (`.env.v2`):
```env
API_PORT=9001
NODE_ENV=production
SUPABASE_URL=http://localhost:9010
```

**Hyperarchy** (`.env.hyperarchy`):
```env
PORT=9100
NODE_ENV=production
```

---

## Security Considerations

### What to Expose Publicly

✅ **Safe to Expose:**
- Customer-facing applications
- Public APIs (with rate limiting)
- Demo environments
- Marketing sites

❌ **Never Expose Publicly:**
- Supabase Studio (database admin)
- Internal admin panels
- Development tools
- Services with sensitive data

### Cloudflare Security Features

Enable these in Cloudflare Dashboard:

1. **WAF (Web Application Firewall)**
   - Blocks common attacks
   - Custom rules for your apps

2. **Rate Limiting**
   - Prevent abuse
   - Per-IP or per-user limits

3. **Access Control**
   - IP allowlists
   - Country blocking
   - Cloudflare Access (SSO)

4. **SSL/TLS**
   - Automatic HTTPS
   - Always use SSL mode: "Full"

5. **DDoS Protection**
   - Automatic mitigation
   - Always enabled

### Example: Secure Public App

```yaml
# In Cloudflare Dashboard → Rules → Transform Rules
# Add rule for orchestrator-v1.yourdomain.com:

# Rate Limiting
Rate Limit: 100 requests per minute per IP

# WAF Rules
Block: SQL injection attempts
Block: XSS attempts
Block: Known bad user agents

# Access Control (Optional)
Only allow: Specific IP ranges
Or: Require Cloudflare Access (SSO)
```

---

## Access Patterns

### Private Access (Tailscale)

```bash
# From MacBook (connected via Tailscale)
# Access Supabase Studio (admin only)
open http://mac-studio-name:9012

# Access internal API
curl http://mac-studio-name:9000/api/health

# Access LangGraph
curl http://mac-studio-name:6200/workflows
```

### Public Access (Cloudflare)

```bash
# From anywhere on internet
# Access Orchestrator AI v1
open https://orchestrator-v1.yourdomain.com

# Access Hyperarchy
open https://hyperarchy.yourdomain.com

# Access Book Writer
open https://bookwriter.yourdomain.com
```

---

## Managing Multiple Apps

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file: ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'orchestrator-v1',
      script: 'apps/api/dist/main.js',
      cwd: '/path/to/orchestrator-ai-v2',
      env: {
        NODE_ENV: 'production',
        API_PORT: 9000,
      },
      env_file: '.env.v1',
    },
    {
      name: 'orchestrator-v2',
      script: 'apps/api/dist/main.js',
      cwd: '/path/to/orchestrator-ai-v2',
      env: {
        NODE_ENV: 'production',
        API_PORT: 9001,
      },
      env_file: '.env.v2',
    },
    {
      name: 'hyperarchy',
      script: 'apps/hyperarchy/dist/main.js',
      cwd: '/path/to/hyperarchy',
      env: {
        NODE_ENV: 'production',
        PORT: 9100,
      },
    },
    // ... more apps
  ],
};

# Start all apps
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Restart specific app
pm2 restart orchestrator-v1
```

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  orchestrator-v1:
    build: .
    ports:
      - "9000:9000"
    environment:
      - API_PORT=9000
    env_file:
      - .env.v1

  orchestrator-v2:
    build: .
    ports:
      - "9001:9001"
    environment:
      - API_PORT=9001
    env_file:
      - .env.v2

  hyperarchy:
    build: ./hyperarchy
    ports:
      - "9100:9100"
    environment:
      - PORT=9100

  # ... more services
```

---

## Monitoring & Health Checks

### Cloudflare Tunnel Status

```bash
# Check tunnel status
cloudflared tunnel info mac-studio-tunnel

# View tunnel metrics
cloudflared tunnel metrics mac-studio-tunnel
```

### App Health Checks

Create health check endpoints for each app:

```typescript
// In each app
@Get('/health')
healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
  };
}
```

Then monitor via Cloudflare:

```bash
# Cloudflare Dashboard → Health Checks
# Create health check for each app:
# https://orchestrator-v1.yourdomain.com/health
# https://hyperarchy.yourdomain.com/health
```

---

## Troubleshooting

### Tunnel Not Connecting

```bash
# Check tunnel is running
cloudflared tunnel list

# Check logs
cloudflared tunnel run mac-studio-tunnel --loglevel debug

# Verify DNS records
dig orchestrator-v1.yourdomain.com
# Should resolve to Cloudflare IPs
```

### App Not Accessible

```bash
# Check app is running locally
curl http://localhost:9000/health

# Check Cloudflare tunnel can reach it
# From Mac Studio:
curl http://localhost:9000/health

# Check Cloudflare Dashboard → Analytics → HTTP Requests
# See if requests are reaching the tunnel
```

### Port Conflicts

```bash
# Check what's using a port
lsof -i :9000

# Kill process if needed
kill -9 <PID>
```

---

## Best Practices

1. **Separate Environments**
   - Use different subdomains for dev/staging/prod
   - Example: `dev-orchestrator.yourdomain.com`, `staging-orchestrator.yourdomain.com`

2. **Monitor Usage**
   - Set up Cloudflare Analytics
   - Monitor bandwidth and request counts
   - Set up alerts for unusual activity

3. **Backup Strategy**
   - Keep tunnel config in version control
   - Document all port assignments
   - Keep DNS records documented

4. **Security Updates**
   - Keep `cloudflared` updated: `brew upgrade cloudflared`
   - Regularly review Cloudflare WAF rules
   - Monitor for security alerts

5. **Cost Management**
   - Cloudflare Tunnels are free
   - Monitor bandwidth usage
   - Use Cloudflare's free tier features

---

## Quick Reference

### Common Commands

```bash
# Tunnel Management
cloudflared tunnel list                    # List all tunnels
cloudflared tunnel create <name>          # Create tunnel
cloudflared tunnel delete <name>          # Delete tunnel
cloudflared tunnel run <name>             # Run tunnel

# DNS Management
cloudflared tunnel route dns <tunnel> <hostname>  # Create DNS record
cloudflared tunnel route dns list                  # List routes

# Service Management (macOS)
sudo cloudflared service install          # Install as service
sudo cloudflared service start            # Start service
sudo cloudflared service stop             # Stop service
sudo cloudflared service status           # Check status
sudo cloudflared service logs             # View logs
```

### Configuration File Location

- **macOS**: `~/.cloudflared/config.yml`
- **Credentials**: `~/.cloudflared/<tunnel-id>.json`

### DNS Records Format

```
Type: CNAME
Name: <subdomain>
Target: <tunnel-id>.cfargotunnel.com
Proxy: ON (orange cloud)
```

---

## Next Steps

1. ✅ Set up Tailscale (already done)
2. ✅ Install Cloudflared
3. ✅ Create tunnel and configure apps
4. ✅ Set up DNS records
5. ✅ Test public access
6. ✅ Configure Cloudflare security features
7. ✅ Set up monitoring and alerts
8. ✅ Document all apps and ports

---

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare WAF Rules](https://developers.cloudflare.com/waf/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Tailscale Documentation](https://tailscale.com/kb/)

