# Nginx Configuration Files

This directory contains nginx configuration files for different deployment scenarios.

## Available Configurations

### orchestratorai.conf
**Purpose:** Development/local deployment configuration
**Use when:** Running locally or in a development environment
**Features:**
- Simple reverse proxy to local services
- No SSL termination (handled by CloudFlare or local)
- Basic proxy headers

### orchestratorai-production.conf
**Purpose:** Production deployment with full features
**Use when:** Deploying to production servers
**Features:**
- Optimized for performance
- Proper proxy headers for CloudFlare
- WebSocket support
- Gzip compression
- Security headers

### orchestratorai-simple.conf
**Purpose:** Minimal configuration for quick testing
**Use when:** Quick testing or debugging
**Features:**
- Bare minimum configuration
- Easy to understand and modify
- Good starting point for custom configs

## Usage

1. Choose the appropriate configuration file
2. Copy to nginx sites-available:
   ```bash
   sudo cp orchestratorai-production.conf /etc/nginx/sites-available/orchestratorai
   ```
3. Create symlink in sites-enabled:
   ```bash
   sudo ln -s /etc/nginx/sites-available/orchestratorai /etc/nginx/sites-enabled/
   ```
4. Test configuration:
   ```bash
   sudo nginx -t
   ```
5. Reload nginx:
   ```bash
   sudo systemctl reload nginx
   ```

## Port Configuration

| Service | Development | Production |
|---------|-------------|------------|
| API     | 6100        | 9000       |
| Web     | 6101        | 9001       |
| LangGraph | 6200      | 9200       |

## SSL/TLS

SSL is handled by CloudFlare in production. The nginx configs expect HTTP connections from CloudFlare and proxy to local services.

See `cloudflare-setup.md` for CloudFlare configuration details.
