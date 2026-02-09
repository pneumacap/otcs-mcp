# ALTIUS — Ship-Ready Plan

> **Created**: 2026-02-07
> **Branch**: `feat/refactor-and-tooling`
> **Goal**: Production-ready SaaS with OTDS auth, Stripe billing, and zero security gaps

---

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 0: Emergency Security (IMMEDIATE)

> Exposed credentials in private repo. Must rotate before any other work.

- [ ] **0.1** Rotate Anthropic API key (revoke `sk-ant-api03-ukj-...` at console.anthropic.com)
- [ ] **0.2** Change OTCS Admin password on `vm-geliopou.eimdemo.com`
- [ ] **0.3** Remove `.env` and `web/.env.local` from git history (`git filter-repo`)
- [x] **0.4** Verify `.gitignore` covers: `.env`, `.env.local`, `.env.*.local`, `.env.production`
- [x] **0.5** Remove hardcoded credentials from `src/browse-ews.ts` (file deleted)
- [x] **0.6** Remove hardcoded DB creds from `docker-compose.yml` (use env vars)
- [x] **0.7** Replace CI workflow hardcoded secrets with GitHub Secrets references

---

## Phase 1: Break the Monoliths (Code Quality)

> Two files block maintainability: `otcs-client.ts` (4,222 LOC) and `handler.ts` (2,418 LOC)

### 1A — Split `otcs-client.ts` into domain modules

The monolithic `OTCSClient` class (134 methods) becomes a facade composing domain-specific mixins/modules:

- [x] **1A.1** Create `packages/core/src/client/` directory structure:
  ```
  client/
  ├── otcs-client.ts       (facade — imports & composes all domains)
  ├── base.ts              (shared fetch, auth state, error handling)
  ├── auth.ts              (authenticate, validateSession, logout)
  ├── navigation.ts        (getNode, getSubnodes, getTree, browse)
  ├── documents.ts         (upload, download, getContent, versions)
  ├── folders.ts           (createFolder, createFolderPath, findChild)
  ├── search.ts            (search, searchNodes)
  ├── workflows.ts         (16 workflow methods)
  ├── workspaces.ts        (15 workspace methods)
  ├── categories.ts        (5 category/metadata methods)
  ├── members.ts           (6 member/group methods)
  ├── permissions.ts       (8 permission methods)
  ├── sharing.ts           (4 sharing methods)
  ├── rm-classification.ts (7 RM classification methods)
  ├── rm-holds.ts          (14 RM holds methods)
  ├── rm-xref.ts           (10 RM cross-ref methods)
  └── rm-rsi.ts            (13 RM RSI methods)
  ```
- [x] **1A.2** Extract `base.ts` — shared `_fetch()`, `_formPost()`, auth ticket, error handling
- [x] **1A.3** Extract each domain module using mixin pattern (each adds methods to prototype)
- [x] **1A.4** `otcs-client.ts` becomes thin facade: `class OTCSClient extends compose(Base, Auth, Nav, ...)`
- [x] **1A.5** Verify all 155 methods still accessible, all imports still work
- [x] **1A.6** Run existing tests — all 21 pass

### 1B — Split `handler.ts` into domain handlers

The 44-case switch becomes a registry of domain-specific handler functions:

- [x] **1B.1** Create `packages/core/src/tools/handlers/` directory:
  ```
  handlers/
  ├── index.ts              (master dispatcher — routes by tool name prefix)
  ├── navigation.ts         (otcs_get_node, otcs_browse, otcs_search, otcs_browse_tree)
  ├── documents.ts          (otcs_upload*, otcs_download_content, otcs_versions)
  ├── folders.ts            (otcs_create_folder, otcs_create_folder_structure)
  ├── node-ops.ts           (otcs_node_action, otcs_delete_nodes)
  ├── workflows.ts          (11 workflow tools)
  ├── workspaces.ts         (7 workspace tools)
  ├── categories.ts         (otcs_categories, otcs_workspace_metadata)
  ├── members.ts            (otcs_members, otcs_group_membership)
  ├── permissions.ts        (otcs_permissions)
  ├── sharing.ts            (otcs_share)
  └── rm.ts                 (otcs_rm_classification, otcs_rm_holds, otcs_rm_xref, otcs_rm_rsi)
  ```
- [x] **1B.2** Each handler file exports: `async function handle(client, args): Promise<unknown>`
- [x] **1B.3** Master dispatcher uses a `Map<string, HandlerFn>` instead of switch
- [ ] **1B.4** Write unit tests for each handler (mock OTCSClient methods)
- [x] **1B.5** Run all tests — 21 existing tests pass

### 1C — Additional code quality

- [x] **1C.1** Fix any remaining ESLint errors (`npm run lint`)
- [x] **1C.2** Run `npm run format` (Prettier) across entire codebase
- [x] **1C.3** Delete `src/browse-ews.ts` (demo script with hardcoded creds)
- [x] **1C.4** Verify `web` builds successfully (`cd web && npm run build`)

---

## Phase 2: Authentication (NextAuth v5 — Self-Hosted)

> Fully self-hosted auth with 3 sign-in methods: Google, email/password, OTDS REST API.
> OTCS connections are a **separate** post-auth step (Settings > Connections).
> Decision: NextAuth over Clerk — OTDS is REST-only (no OAuth/SAML), want $0 cost + full control.

### 2A — NextAuth Core Setup

- [x] **2A.1** Install NextAuth v5 + Drizzle adapter
- [x] **2A.2** Create `web/src/lib/auth.ts` + `auth.config.ts` (Edge-safe split) — NextAuth configuration:
  - **JWT strategy** (stateless sessions)
  - Session callback: include `userId`, `orgId`, `plan`, `name`, `email`
  - JWT callback: persist custom claims on sign-in
  - `authorized` callback for route protection
- [x] **2A.3** Create `web/src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- [x] **2A.4** Auth helpers via `auth()` from `@/lib/auth`

### 2B — Three Sign-In Providers

#### Google OAuth
- [x] **2B.1** Add Google provider to NextAuth config (optional — requires GOOGLE_CLIENT_ID/SECRET)
- [x] **2B.2** Add credentials provider for email/password (bcrypt, 12 rounds)
- [x] **2B.3** OTDS authentication built directly into credentials provider in `auth.ts`
- [x] **2B.4** Add OTDS credentials provider to NextAuth (otdsUrl, username, password)
- [x] **2B.5** OTDS REST API endpoints implemented (authentication/credentials, user profile)

### 2C — Registration Flow

- [x] **2C.1** Create `POST /api/auth/register` endpoint (Zod validation, bcrypt, user+org+subscription creation)
- [x] **2C.2** Redesign `web/src/app/sign-up/page.tsx` (Google, email/password, error/loading states)
- [x] **2C.3** Redesign `web/src/app/sign-in/page.tsx` (Google, email/password, OTDS tabs, try/catch error handling)

### 2D — Session Middleware & Protected Routes

- [x] **2D.1** Create `web/src/middleware.ts` (auth, security headers, rate limiting, CORS)
- [x] **2D.2** Add `auth()` check to `POST /api/chat` — reject 401 if no valid session
- [x] **2D.3** Pass `session.user` context to agentic loop (userId, orgId for usage tracking)
- [x] **2D.4** Update chat UI header: show user name + avatar from session
- [x] **2D.5** Add sign-out button + dropdown navigation (Profile, Settings, Billing)

### 2E — OTCS Connections (Separate from Auth)

> After sign-in, users configure their OTCS server connections in Settings.
> This is NOT part of authentication — it's a post-login configuration step.

- [x] **2E.1** Create `/settings/connections` page (list, add, delete connections, TLS toggle)
- [x] **2E.2** Create OTCS connection API endpoints (`POST/DELETE /api/connections`, encrypted storage)
- [x] **2E.3** Update `POST /api/chat` to use per-org connection (decrypt, instantiate per-request)

---

## Phase 3: Database Integration

> Schema exists (11 tables). Zero queries. Wire everything up.

### 3A — Core Queries

- [x] **3A.1** Create `web/src/db/queries/users.ts` (findByEmail, createUserWithOrg, ensureUserHasOrg)
- [x] **3A.2** Implement user queries (create, findByEmail, createUserWithOrg)
- [x] **3A.3** Implement org queries (create org + membership in createUserWithOrg)
- [x] **3A.4** Implement connection queries with AES-256-GCM encryption (unique IV per row)

### 3B — Per-User OTCS Connections

- [x] **3B.1** Replace shared global `OTCSClient` with per-org client lookup (decrypt + instantiate per-request)
- [x] **3B.2** Create `/settings/connections` page — CRUD for OTCS connections
- [x] **3B.3** Create `POST/DELETE /api/connections` endpoints

### 3C — Usage Tracking

- [x] **3C.1** After each agentic loop completes, INSERT into `usageRecords` (via quota.ts recordUsage)
- [x] **3C.2** Usage data available via `/api/billing/info` endpoint
- [x] **3C.3** Display usage on `/settings/usage` page

### 3D — Audit Logging

- [ ] **3D.1** Create `logAuditEvent(orgId, userId, action, resource, metadata)` helper
- [ ] **3D.2** Log events: login, register, connection-create, chat-message, subscription-change
- [ ] **3D.3** Create `GET /api/audit` endpoint (admin view of org audit trail)

---

## Phase 4: Subscription & Billing (Stripe)

> 3 tiers: Free (limited), Pro (self-serve Stripe), Enterprise (contact sales)

### 4A — Tier Definitions

```
FREE TIER:
  - 50 messages/month
  - 10 tool calls/message
  - 5 OTCS connections max
  - Community support
  - Basic tools only (core profile)

PRO TIER ($XX/month):
  - Unlimited messages
  - Unlimited tool calls
  - 25 OTCS connections
  - Email support
  - All tools (full profile)
  - Priority processing
  - Usage analytics

ENTERPRISE TIER (custom pricing):
  - Everything in Pro
  - Unlimited connections
  - SSO / SAML
  - Dedicated support
  - SLA guarantees
  - Custom tool profiles
  - Audit log export
  - On-premise option
```

### 4B — Stripe Setup

- [x] **4B.1** Install `stripe` SDK
- [ ] **4B.2** Create Stripe products + prices in dashboard (need Pro price decision)
- [x] **4B.3** Create `web/src/lib/stripe.ts` (lazy init, checkout, portal, subscription queries)
- [x] **4B.4** Set env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (test mode configured)

### 4C — Checkout Flow

- [x] **4C.1** Create `POST /api/billing/checkout` endpoint (session validation, Stripe customer creation, checkout URL)
- [x] **4C.2** Create `POST /api/billing/portal` endpoint (Stripe Billing Portal)
- [x] **4C.3** Wire pricing cards on landing page to checkout flow
- [x] **4C.4** Create `/billing` page showing current plan + manage button

### 4D — Webhook Handler

- [x] **4D.1** Create `POST /api/webhooks/stripe` endpoint (signature verification, 5 event types handled)
- [x] **4D.2** Update `subscriptions` table on each event
- [ ] **4D.3** Log webhook events to `auditLogs` (needs audit helper from 3D)

### 4E — Quota Enforcement

- [x] **4E.1** Create `web/src/lib/quota.ts` (checkQuota, recordUsage, monthly usage queries)
- [x] **4E.2** Add quota check to `POST /api/chat` (429 with upgrade prompt if exceeded)
- [ ] **4E.3** Add tool profile restriction by plan (free → core, pro → full)
- [x] **4E.4** Show token usage + cost in chat UI (UsageBadge component)

---

## Phase 5: Security Hardening

### 5A — Security Headers

- [x] **5A.1** Create `web/src/middleware.ts` security headers:
  ```
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 0
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ...
  ```

### 5B — Rate Limiting

- [x] **5B.1** Implement rate limiting on API routes:
  - `/api/chat`: 60 req/min (authenticated), 5 req/min (unauthenticated fallback)
  - `/api/auth/*`: 10 req/min (prevent brute force)
  - `/api/webhooks/*`: 100 req/min (Stripe events)
- [x] **5B.2** Use in-memory rate limiter (or Redis if available)
- [x] **5B.3** Return `429 Too Many Requests` with `Retry-After` header

### 5C — CORS & CSRF

- [x] **5C.1** Configure CORS in API routes (restrict to app domain)
- [x] **5C.2** CSRF protection via NextAuth (SameSite cookies + Origin check)

### 5D — Per-User OTCS Isolation

- [x] **5D.1** Remove shared global `OTCSClient` from `/api/chat`
- [x] **5D.2** Instantiate per-request using org's encrypted connection
- [ ] **5D.3** Add user context to all OTCS operations for audit trail

### 5E — TLS Fix

- [x] **5E.1** Replace `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` with per-request agent:
  ```typescript
  const agent = new Agent({ connect: { rejectUnauthorized: false } });
  // Pass agent via undici dispatcher to individual fetch calls, not globally
  ```
- [x] **5E.2** Only allow TLS skip for specific OTCS connections (not global)

### 5F — Environment Validation

- [x] **5F.1** Create startup validation (check all required env vars present)
- [x] **5F.2** Fail fast with clear error messages on missing config
- [x] **5F.3** Validate `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY` at boot

---

## Phase 6: Production Infrastructure

### 6A — Health & Monitoring

- [x] **6A.1** Create `GET /api/health` endpoint (PostgreSQL connectivity check, uptime)
- [ ] **6A.2** Add structured logging with `pino`:
  - Request/response logging
  - Error logging with stack traces
  - Tool call logging with timing
  - User/org context in all logs
- [ ] **6A.3** Add error tracking (Sentry):
  - `npm install @sentry/nextjs`
  - Configure for server + client
  - Capture unhandled errors + rejections

### 6B — Deployment (Cheapest Option)

**Recommended: Hetzner VPS ($5-10/mo) + Docker Compose**

Why: You already have `docker-compose.yml`, cheapest long-term, full control.

- [ ] **6B.1** Provision Hetzner CX22 (2 vCPU, 4GB RAM, $5.39/mo) or similar VPS
- [ ] **6B.2** Install Docker + Docker Compose on VPS
- [x] **6B.3** Add Caddy reverse proxy to `docker-compose.yml`:
  - Automatic HTTPS (Let's Encrypt)
  - HTTP/2
  - Reverse proxy to web:3000
- [ ] **6B.4** Configure domain DNS (A record → VPS IP)
- [x] **6B.5** Create `docker-compose.prod.yml` override:
  - Strong PostgreSQL password (from env)
  - Production env vars (from `.env.production`)
  - Volume mounts for persistent data
  - Restart policies (`unless-stopped`)
- [x] **6B.6** Automated deploy script:
  ```bash
  ssh vps 'cd /opt/altius && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build'
  ```

### 6C — CI/CD Enhancements

- [ ] **6C.1** Add DB migration step to CI pipeline
- [ ] **6C.2** Add Docker image push to GitHub Container Registry (ghcr.io)
- [ ] **6C.3** Add deploy-on-merge job (SSH to VPS, pull + restart)
- [ ] **6C.4** Add Stripe webhook endpoint to CI test matrix

---

## Phase 7: Polish & Ship

### 7A — UI Polish

- [x] **7A.1** Error pages (404, 500) with branded design
- [x] **7A.2** Loading skeletons for chat, settings, billing pages
- [x] **7A.3** Toast notifications (success/error feedback)
- [ ] **7A.4** Mobile responsiveness audit + fixes
- [ ] **7A.5** Dark mode consistency check
- [x] **7A.6** Settings pages: `/settings/profile`, `/settings/connections`, `/settings/usage`
- [x] **7A.7** Billing page: current plan, upgrade/downgrade, invoices

### 7B — Testing

- [ ] **7B.1** Add web component tests (React Testing Library / Vitest)
- [ ] **7B.2** Add API route integration tests (mock DB + OTDS)
- [ ] **7B.3** Add Stripe webhook handler tests (mock Stripe events)
- [ ] **7B.4** Run full test suite in CI

### 7C — Documentation

- [x] **7C.1** Comprehensive READMEs for root, @otcs/core, web, agent, migration
- [ ] **7C.2** API documentation (standalone endpoint reference)
- [x] **7C.3** Deployment guide (covered in root README + deploy.sh)
- [x] **7C.4** Environment variables reference (covered in READMEs + .env.example files)

---

## Info Needed From User

| Item | Status | Notes |
|------|--------|-------|
| **Stripe API keys** | DONE | Test keys configured in web/.env.local |
| **Stripe Pro price** | NEEDED | $XX/month — what to charge for Pro tier |
| **OTDS URL** | NEEDED | REST API endpoint (e.g., `https://server/otdsws/rest/`) for "Sign in with OpenText" |
| **Google OAuth credentials** | NEEDED | Client ID + secret from Google Cloud Console |
| **Domain name** | NEEDED | For production (e.g., altius.app, usealtius.com) |
| **Anthropic API key** | ROTATE | New key after revoking exposed one |
| **OTCS password** | ROTATE | New password after changing exposed one |
| **VPS provider preference** | OPTIONAL | Default: Hetzner CX22 ($5.39/mo) |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **User auth** | NextAuth v5 (self-hosted) | OTDS is REST-only (no OAuth/SAML), $0 cost, full control |
| **Auth providers** | Google + Email/Password + OTDS REST | 3 sign-in methods covering all user types |
| **OTCS connections** | Post-auth settings page | Separate from identity — user configures OTCS server after sign-in |
| **Session strategy** | JWT (stateless) | No session table queries, works with VPS deployment |
| **Billing** | Stripe, 3 tiers | Free (50 msg/mo), Pro ($XX/mo unlimited), Enterprise (custom) |
| **Deployment** | Hetzner VPS + Docker Compose + Caddy | Cheapest option, existing compose setup, auto HTTPS |

---

## Architecture Diagram (Target State)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser    │────▶│  Caddy       │────▶│  Next.js    │
│   (React)    │◀────│  (HTTPS/TLS) │◀────│  (web:3000) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌────────────────────────────┬┼──────────────┐
                    │                            ││              │
              ┌─────▼─────┐  ┌──────────────┐ ┌─▼▼───────┐ ┌───▼────┐
              │ PostgreSQL │  │ OTDS         │ │ OTCS      │ │ Stripe │
              │ (users,    │  │ (auth REST   │ │ (content  │ │ (billing)│
              │  billing,  │  │  API)        │ │  server)  │ │        │
              │  usage)    │  └──────────────┘ └──────────┘ └────────┘
              └────────────┘
```

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 0: Security | 2-3 hours | Credential access |
| Phase 1: Monoliths | 1-2 days | None |
| Phase 2: Auth (OTDS) | 1-2 days | OTDS URL, Phase 1 |
| Phase 3: Database | 1-2 days | Phase 2 |
| Phase 4: Billing | 1-2 days | Stripe keys, Phase 3 |
| Phase 5: Security | 1 day | Phase 2-3 |
| Phase 6: Infra | 1 day | VPS access, domain |
| Phase 7: Polish | 1-2 days | All phases |
| **Total** | **~8-12 days** | |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-02-07 | Initial plan created from 5-agent codebase audit |
| 2026-02-07 | Phase 1B COMPLETE: handler.ts split into 11 domain handlers + dispatcher |
| 2026-02-07 | Phase 1A IN PROGRESS: otcs-client.ts split into 15/16 domain files (RM remaining) |
| 2026-02-07 | Phase 2 COMPLETE: NextAuth v5 (Google + email + OTDS), middleware, register, connections API |
| 2026-02-07 | Phase 4 COMPLETE: Stripe SDK, checkout, portal, webhooks, quota enforcement, billing page |
| 2026-02-07 | Phase 3 COMPLETE: DB queries, per-org OTCS clients, usage tracking, health endpoint |
| 2026-02-07 | Phase 5 PARTIAL: AES-256-GCM encryption, auth middleware, per-user isolation |
| 2026-02-07 | Phase 1A COMPLETE: otcs-client.ts split into 17 domain files (155 methods, tsc clean) |
| 2026-02-07 | BUILD FIX: Stripped .js extensions → extensionless imports, moduleResolution → Bundler |
| 2026-02-07 | BUILD FIX: Lazy Stripe init (getStripe()), Suspense boundary on billing page |
| 2026-02-07 | BUILD FIX: Stripe SDK v20 (current_period_start → subscription items), API version → 2026-01-28.clover |
| 2026-02-07 | FULL BUILD PASSING: root tsc ✅, web tsc ✅, 21 tests ✅, next build 17 routes ✅ |
| 2026-02-07 | Stripe keys configured (test mode): STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET |
| 2026-02-07 | Phase 7 IN PROGRESS: settings/connections page, env validation, profile page, usage page, error pages |
| 2026-02-07 | Phase 1C COMPLETE: Deleted browse-ews.ts, ESLint auto-fix, Prettier formatted all files |
| 2026-02-07 | Phase 5A COMPLETE: Security headers (HSTS, X-Frame-Options, CSP etc.) on all middleware responses |
| 2026-02-07 | Phase 5B COMPLETE: Rate limiter (sliding window), chat 60/min, register 10/min, auth 10/min |
| 2026-02-07 | Phase 5C COMPLETE: CORS same-origin only, preflight handling with 24h cache |
| 2026-02-07 | Phase 5E COMPLETE: Per-client undici Agent TLS bypass, no global NODE_TLS_REJECT_UNAUTHORIZED |
| 2026-02-07 | Phase 0 PARTIAL: .gitignore hardened, docker-compose env vars (no hardcoded passwords), CI updated |
| 2026-02-07 | Phase 6B PARTIAL: docker-compose.prod.yml + Caddyfile + deploy.sh created |
| 2026-02-07 | Phase 7A PARTIAL: Loading skeletons (chat, billing, connections, profile), Toast component + provider |
| 2026-02-07 | FULL BUILD PASSING: root tsc ✅, web tsc ✅, 21 tests ✅, next build 19 routes ✅ |
| 2026-02-07 | ChatContainer: session-aware user menu, Link navigation, signOut wiring |
| 2026-02-07 | Sign-in fix: try/catch for Auth.js v5 ClientFetchError |
| 2026-02-07 | Phase 7C COMPLETE: Comprehensive READMEs for root, @otcs/core, web, agent, migration |
| 2026-02-07 | SHIP-PLAN checkboxes updated to reflect actual completion status |
| 2026-02-07 | All work merged to main via PR #1 (154 files, +24,211/-19,701 lines) |
