# Altius — Pilot Customer Deployment & Implementation Guide

## Deployment Strategy

You have **two viable models**. The right one depends on the customer.

### Option A: Dedicated Instance (Recommended for Pilot)

Deploy a Docker stack on **their infrastructure** (or a VPS you manage for them). This is what enterprise OTCS customers expect — their data never leaves their network.

**What already works:**
- `docker-compose.prod.yml` + `Caddyfile` + `deploy.sh` — all set up for single-instance deployment
- OTDS auth — their users log in with existing OpenText credentials
- Per-org OTCS connections with AES-256-GCM encrypted passwords
- Audit logging

**What to strip out or bypass:**
- **Stripe billing** — irrelevant. Invoice them directly (annual license, SOW, whatever). Hardcode their plan to `'enterprise'` in the DB seed.
- **Google OAuth** — remove it. Enterprise customers authenticate via OTDS (or add LDAP).
- **Self-signup / org creation flow** — pre-seed the database with their org + admin user during install.

**What to add:**
- An install/setup script that creates the `.env`, runs migrations, seeds the org
- A simple admin panel or CLI to add users (or just OTDS handles it)
- Monitoring: usage is already tracked in `usageRecords` — just need a way to view it

### Option B: Managed SaaS Container (Per-Customer)

Host it on your own infrastructure, one container stack per customer. They get a subdomain like `acme.altius.app`.

**Pros:** You control updates, monitoring, backups. Easier to support.
**Cons:** Their OTCS server must be reachable from your infrastructure (often not the case — OTCS is usually behind a firewall).

---

## Why Option A for the Pilot

1. **OTCS is almost always internal.** The app needs to reach their Content Server. If it's behind a VPN/firewall, a SaaS model won't work without them exposing it.
2. **Enterprise trust.** "It runs on your servers, your data never leaves" is a selling point.
3. **The Docker stack already exists.** The gap to a proper install package is small.

---

## Billing Strategy

**Don't use Stripe for dedicated deployments.** Invoice directly:

- **Annual license fee** — flat rate for the software
- **Per-seat pricing** (optional) — charge per named user
- **Usage-based component** (optional) — already tracking `inputTokens`, `outputTokens`, `costUsd` in `usageRecords`. Add a monthly usage report they can review.
- **Anthropic API costs** — either they provide their own API key (pass-through), or include a usage allowance in the license and charge overages

**Cleanest model for a pilot:** flat annual fee + they provide their own Anthropic API key. Zero metering complexity.

---

## Usage Monitoring

`usageRecords` already tracks tokens and costs per org/user. What's needed:

1. **Admin dashboard page** — query `usageRecords` grouped by day/week/month, show token counts and estimated cost
2. **Monthly usage export** — simple CSV or PDF report (for invoicing if usage-based)
3. **Health endpoint** — `/api/health` already exists; add uptime monitoring (UptimeRobot, etc.)

---

## User Management: AD/LDAP

The OTDS provider already handles this for OpenText shops. If the customer uses plain Active Directory:

- Add an LDAP credentials provider (using `ldapts` npm package) — ~50 lines in `auth.ts`
- User logs in with AD username/password, authenticate against their LDAP server
- Auto-create the local user on first login, associate with the single org

Most OpenText customers **have OTDS**, so this may not be needed for the pilot.

---

## What to Build for the Pilot

| Item | Effort | Description |
|------|--------|-------------|
| **Install script** | Small | Shell script: creates `.env` from prompts, runs `docker compose up`, runs DB migrations, seeds org + admin user |
| **Disable billing conditionally** | Small | `BILLING_ENABLED=false` env var → skip Stripe routes, hardcode `enterprise` plan |
| **Admin usage dashboard** | Medium | New page at `/admin/usage` showing token consumption, cost, user activity from `usageRecords` |
| **Deployment guide** | Small | Markdown doc: prerequisites, install steps, configuration, troubleshooting |
| **LDAP provider** | Small | Optional — only if customer doesn't use OTDS |

---

## Current Architecture Reference

### What Exists (SaaS Mode)

| Aspect | Current State | On-Prem Change |
|--------|---------------|----------------|
| **Auth** | Google + Email + OTDS | OTDS + internal users only |
| **Tenancy** | Multi-org per DB (`orgId` everywhere) | Single org, collapse tenant isolation |
| **Billing** | Stripe per-org | Hardcoded `enterprise`, no billing |
| **Domain** | Dynamic `${DOMAIN}` | Customer's internal domain |
| **SSL** | Let's Encrypt auto | Self-signed or internal CA |
| **OTCS** | Per-org connections | Single shared OTCS (or per-customer config) |
| **Deployment** | docker-compose + Caddy | Docker on customer's VPS |
| **Scaling** | Horizontal (stateless) | Single-instance suffices |

### Auth Providers

| Provider | Status | Enterprise Use |
|----------|--------|----------------|
| Google OAuth | Built | Remove for on-prem |
| Email/Password | Built | Keep as fallback / admin accounts |
| OTDS | Built | Primary for OpenText customers |
| LDAP/AD | Not built | ~50 lines to add if needed |
| SAML/SSO | Not built | NextAuth supports it, add if required |

### Database Schema (Multi-Tenant)

```
users (unique email)
  ↓ 1:N
orgMemberships (org_id + user_id unique, role: owner/admin/member)
  ↓
organizations (unique slug)
  ↓ 1:N
  ├── otcsConnections (per-org, encrypted passwords)
  ├── agents (per-org config)
  ├── subscriptions (unique per org)
  ├── usageRecords (per org + user)
  ├── apiKeys (per org)
  └── auditLogs (per org)
```

For dedicated: pre-seed one org, one subscription (enterprise), one connection. Skip multi-org UI.

### Environment Variables

**Required for any deployment:**
- `DATABASE_URL`, `POSTGRES_PASSWORD`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `ANTHROPIC_API_KEY`
- `ENCRYPTION_KEY` (32-byte hex, AES-256-GCM)

**Required for dedicated (add to required list):**
- `OTCS_BASE_URL`, `OTCS_USERNAME`, `OTCS_PASSWORD`

**Remove for dedicated:**
- `STRIPE_*` (all Stripe vars)
- `GOOGLE_CLIENT_*` (unless they want Google OAuth)

**Add for dedicated:**
- `BILLING_ENABLED=false`
- `SINGLE_TENANT_MODE=true` (skip org creation flow)

### Docker Stack

```
docker-compose.prod.yml
├── postgres (PostgreSQL 16 Alpine, pgdata volume)
├── app (Next.js standalone, port 3000 internal only)
└── caddy (reverse proxy, auto-TLS, gzip/zstd)
```

Deploy script: `./scripts/deploy.sh user@vps-ip` — SSH, git pull, docker compose up, health check.

### Security Already in Place

- AES-256-GCM encryption for OTCS passwords in DB
- bcrypt (12 rounds) for user passwords
- Rate limiting (10 req/min on auth endpoints)
- Security headers (HSTS, CSP, X-Frame-Options)
- CORS (same-origin only)
- Per-connection TLS configuration
- Audit logging for all actions
- Non-root Docker user
