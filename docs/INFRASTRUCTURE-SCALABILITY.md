# Altius — Infrastructure Scalability Assessment

> How Altius scales from a single VPS to enterprise-grade infrastructure.
> Infrastructure is a rounding error in the cost structure — API costs dominate 170:1.

---

## Executive Summary

Altius is an **I/O-bound application**, not a compute-bound one. The Next.js server receives chat messages, proxies them to Anthropic's API, waits for a response, and streams it back. The actual "work" happens at Anthropic and at the customer's OTCS server. This means a single $5/mo VPS can serve hundreds of concurrent users, and infrastructure costs remain under $200/mo even at enterprise scale with thousands of users.

**Key finding:** At the 5,000-user enterprise scenario, monthly infrastructure costs are **$65-200** while API costs are **$14,000-30,000**. Infrastructure is 0.3-1% of total cost. The scaling strategy is: don't over-engineer early, add nodes when load demands it, move to Kubernetes when ops complexity justifies it.

---

## 1. Why Infrastructure Isn't the Bottleneck

### What Altius Actually Does Per Request

| Component | What It Does | CPU/Memory Load |
|---|---|---|
| Next.js app | Receives chat message, calls Anthropic API, streams response | **Minimal** — mostly I/O wait |
| OTCS tool calls | HTTP proxy to customer's Content Server | **Minimal** — proxying JSON |
| PostgreSQL | Auth lookups, usage records, connections (~100 byte rows) | **Minimal** — low write volume |
| Caddy | TLS termination, reverse proxy | **Minimal** |

Each chat request holds an open HTTP connection for **5-30 seconds** while streaming the response from Anthropic. With Node.js, this is not a problem — the event loop handles thousands of concurrent I/O-bound connections efficiently.

### Connection Capacity

- **Single Node.js process**: ~10,000 concurrent open connections
- **At 1,000 concurrent users**: ~1,000 connections + tool call overhead
- **Hetzner CX22 (2 vCPU, 4GB)**: Handles this comfortably
- **Actual bottleneck**: Anthropic API rate limits (per API key), not server capacity

You won't need to scale infrastructure until you exceed **2,000-5,000 concurrent streaming connections** — roughly **10,000-25,000 DAU** (daily active users), since users aren't all chatting simultaneously.

---

## 2. Current Architecture

```
[Internet] → [Caddy TLS] → [Next.js :3000] → [PostgreSQL]
                                   ↓
                          [Anthropic API]
                          [Customer OTCS]
```

**Stack:**
- 1 Next.js app (Node.js, single process)
- 1 PostgreSQL instance (Docker, same host)
- 1 Caddy reverse proxy (auto-TLS via Let's Encrypt)
- All on 1 VPS via Docker Compose

**Current deployment files:**
- `docker-compose.yml` — base services (app + postgres)
- `docker-compose.prod.yml` — production overrides (Caddy, env vars, restart policies)
- `Caddyfile` — reverse proxy + gzip/zstd compression
- `scripts/deploy.sh` — SSH-based deploy script

---

## 3. Multi-Tenancy (Already Built)

Altius already has application-level multi-tenancy:

```
Request → auth middleware (JWT) → extract orgId → decrypt org's OTCS connection → proxy to their OTCS server
```

**Isolation model:**
- Each org's data isolated by `orgId` in PostgreSQL (11 tables, all org-scoped)
- Each org's OTCS connection encrypted separately (AES-256-GCM, unique IV per row)
- No shared state between tenants in memory
- Per-client TLS agents (undici `Agent` per OTCS connection, not global)

**What we DON'T have (and don't need yet):**
- Tenant-level resource isolation (CPU/memory guarantees per org)
- Separate databases per tenant
- Tenant-level rate limiting (currently per-IP, not per-org)

**When tenant isolation matters:** Only if an enterprise customer contractually demands dedicated resources (SLA with resource guarantees) or if one tenant's usage degrades others. At that point, deploy a **dedicated instance** for that customer — a separate Docker Compose stack on a separate VPS.

---

## 4. Deployment Evolution Path

### Stage 1: Single VPS (Current) — $5-20/mo

```
[Internet] → [Caddy TLS] → [Next.js] → [PostgreSQL]
                                 ↓
                        [Anthropic API]
                        [Customer OTCS]
```

| Attribute | Value |
|---|---|
| **Handles** | 0-50 customers, 0-500 DAU |
| **Cost** | Hetzner CX22 ($5.39/mo) or CX32 ($9.59/mo) |
| **Risk** | Single point of failure, no backup strategy |
| **Scaling** | Vertical only (bigger VPS) |

---

### Stage 2: Single VPS + Backup + Monitoring — $20-50/mo

Same architecture, add operational resilience:

| Addition | Cost | Purpose |
|---|---|---|
| Automated PostgreSQL backups (pg_dump → S3/Backblaze) | $1-3/mo | Data recovery |
| Uptime monitoring (UptimeRobot/Better Stack) | $0-10/mo | Alerting |
| Structured logging | $0/mo (stdout) | Debugging |
| Standby VPS image | $0 (snapshot) | 5-minute failover |

| Attribute | Value |
|---|---|
| **Handles** | 50-200 customers, 500-2,000 DAU |
| **Cost** | $20-50/mo |
| **SLA** | 99% (~7hr downtime/mo) |
| **When** | Before first paying customer |

---

### Stage 3: Two-Node High Availability — $50-150/mo

```
[Internet] → [Hetzner Load Balancer $5/mo]
                    ↓               ↓
            [VPS-1: Next.js]  [VPS-2: Next.js]
                    ↓               ↓
            [Managed PostgreSQL or primary/replica]
```

Key changes:
- **2 app servers** behind a load balancer (Hetzner LB at $5.39/mo)
- **Managed PostgreSQL** (Hetzner Managed DB from $15/mo, or self-hosted with streaming replication)
- **Zero-downtime deploys**: Roll one server at a time
- **Automatic failover**: LB routes around a dead node

| Component | Cost |
|---|---|
| 2x CX22 (app servers) | $10.78/mo |
| Hetzner Load Balancer | $5.39/mo |
| Managed PostgreSQL (CPX11) | $15/mo |
| Backups + monitoring | $10-15/mo |
| **Total** | **$41-46/mo** |

| Attribute | Value |
|---|---|
| **Handles** | 200-1,000 customers, 2,000-10,000 DAU |
| **SLA** | 99.5% (~3.6hr downtime/mo) |
| **When** | Professional/Business tier customers |

---

### Stage 4: Kubernetes or Managed Platform — $200-800/mo

At this point, three options:

#### Option A: Managed Kubernetes

```
[LB] → [K8s Ingress] → [Next.js pods (2-10 replicas)]
                              ↓
                    [Managed PostgreSQL]
                    [Redis for sessions/cache]
```

- Auto-scaling: pods scale from 2 to 10 based on CPU/connections
- Self-healing: crashed pods restart automatically
- Rolling deploys: zero downtime
- Cost: Hetzner K8s ($35/mo base + node costs)

#### Option B: Managed Platform (Railway, Fly.io, Render)

- Same outcome as K8s but fully managed
- Higher per-unit cost but zero ops overhead
- Good if you don't want to hire DevOps
- Cost: $100-400/mo depending on usage

#### Option C: AWS/GCP (Enterprise Procurement)

- ECS/Fargate or Cloud Run for containers
- RDS for PostgreSQL
- ALB for load balancing
- Cost: $300-800/mo minimum
- Main reason: Enterprise procurement requires "runs on AWS" checkbox

| Attribute | Value |
|---|---|
| **Handles** | 1,000+ customers, 10,000+ DAU |
| **SLA** | 99.9% (~43min downtime/mo) |
| **When** | Enterprise SLA requirements, or 500+ customers |

---

## 5. Kubernetes: What It Buys You and When You Need It

| Capability | Docker Compose | Kubernetes |
|---|---|---|
| Run containers | Yes | Yes |
| Health checks + restart | `restart: unless-stopped` | Liveness/readiness probes, auto-restart |
| Scale replicas | Manual (add VPS) | `kubectl scale --replicas=5` or HPA auto |
| Rolling deploys | Manually (one server at a time) | Built-in (`strategy: RollingUpdate`) |
| Auto-scaling | No | Yes (HPA based on CPU, memory, custom metrics) |
| Service discovery | Docker DNS | Built-in DNS + Services |
| Secret management | `.env` files | K8s Secrets, Vault integration |
| Multi-region | No | Yes (with federation) |

**You need K8s when:**
- More than 5 application instances
- Auto-scaling is a requirement (bursty enterprise traffic)
- Enterprise customers require it for procurement compliance
- You hire a DevOps engineer who can manage it

**You DON'T need K8s when:**
- 1-3 app instances serve your traffic
- Manual scaling (add another VPS) is fast enough
- Docker Compose + a load balancer handles the load

---

## 6. Serverless: Why Not

**Should Altius go serverless (Vercel, AWS Lambda)?**

**No.** Here's why specifically for this workload:

### 1. Streaming Responses

Altius streams AI responses for 5-30 seconds per request. Serverless functions have timeouts (Vercel: 60s free, 300s pro; Lambda: 15 min max). This works but is expensive — you pay per GB-second of execution time, and you're mostly **waiting** on Anthropic.

### 2. Cold Starts

Serverless functions cold-start in 200-2000ms. The Next.js app with all OTCS tool schemas loaded takes the upper end. This adds user-visible latency to every first request.

### 3. Cost Inversion

For I/O-bound, long-running streaming requests, serverless is **more expensive** than a VPS. A Vercel Pro plan at $20/user/mo is fine for a website, but for an API that holds connections open for 30 seconds under load, you'll hit bandwidth and function-duration charges quickly.

### 4. Connection Limits

Altius needs persistent connections to customer OTCS servers (with per-client TLS agents). Serverless functions are stateless — every invocation re-establishes connections.

### 5. Cost Comparison

| Scenario | VPS (Docker) | Serverless (Vercel Pro) |
|---|---|---|
| 1,000 requests/day, 15s avg | $5.39/mo (CX22) | ~$30-60/mo (function duration) |
| 10,000 requests/day, 15s avg | $9.59/mo (CX32) | ~$200-400/mo |
| 100,000 requests/day, 15s avg | $31/mo (2x CX32) | ~$1,500-3,000/mo |

**Containers (Docker) are the correct choice for Altius.** The architecture is I/O-bound, long-lived streaming, with per-tenant connection state — the opposite of what serverless optimizes for.

---

## 7. Infrastructure Cost at Enterprise Scale

### The 5,000-User Enterprise Customer

For the scenario from the API Cost Analysis (5,000 users, 380K messages/mo, 50 agents):

**SaaS Deployment (Shared Infrastructure):**

| Component | Monthly Cost |
|---|---|
| 3x Hetzner CX32 (app servers) | $29/mo |
| 1x Hetzner Managed DB (CPX21) | $15/mo |
| 1x Load Balancer | $5/mo |
| Backups + monitoring | $15/mo |
| CDN (Cloudflare free or $20) | $0-20/mo |
| **Total infrastructure** | **$64-84/mo** |

**Dedicated Instance (Enterprise SLA):**

| Component | Monthly Cost |
|---|---|
| 2x Hetzner CCX13 (dedicated vCPU) | $36/mo |
| 1x Managed DB | $15/mo |
| 1x Load Balancer | $5/mo |
| Backups + monitoring | $10/mo |
| **Total infrastructure** | **$66/mo** |

### Cost Comparison at Scale

| Cost Category | Monthly at 5,000 Users | % of Total |
|---|---|---|
| Anthropic API | $14,000-30,000 | 96-99% |
| Support (CSM) | $5,000-10,000 | — |
| **Infrastructure** | **$65-200** | **0.3-1%** |
| Total | $19,000-40,000 | |

**Infrastructure is 0.3-1% of total cost.** API costs dominate by a factor of 170x.

---

## 8. Redundancy and Failover

### SLA Tiers

| SLA | Max Downtime/Month | Architecture Required | Cost |
|---|---|---|---|
| Best-effort | Unlimited | Single VPS, Docker Compose | $5-10/mo |
| 99% | ~7 hours | Single VPS + backups + monitoring | $15-30/mo |
| 99.5% | ~3.6 hours | 2 VPS + LB + DB replication | $50-120/mo |
| 99.9% | ~43 minutes | K8s or managed platform + managed DB | $200-800/mo |

### What Each Level Requires

**99% (first paying customers):**
- Daily PostgreSQL backups to off-site storage
- Uptime monitoring with alerting
- Documented recovery procedure (restore from backup, spin up standby)
- Recovery time: 5-30 minutes

**99.5% (professional/business tier):**
- Two app servers behind a load balancer
- Managed PostgreSQL with automated failover
- Zero-downtime deploys (rolling)
- Recovery time: automatic for app, <5 min for DB

**99.9% (enterprise SLA):**
- Kubernetes with auto-scaling and self-healing
- Managed PostgreSQL with multi-zone replication
- Health checks with automatic pod replacement
- CDN for static assets
- Recovery time: automatic (<1 min for app failures)

---

## 9. Dedicated vs Shared Infrastructure

### When to Offer Dedicated Instances

| Signal | Action |
|---|---|
| Enterprise customer requires it contractually | Deploy dedicated Docker Compose on separate VPS |
| Customer has data residency requirements | Deploy in required region |
| Customer's usage degrades other tenants | Isolate on dedicated hardware |
| On-premise/self-hosted license | Customer runs on their own infrastructure |

### Dedicated Instance Architecture

```
[Customer's dedicated VPS]
├── Caddy (TLS)
├── Next.js (Altius)
├── PostgreSQL (customer data only)
└── .env (customer-specific config)
```

Cost to Altius: ~$50-100/mo per dedicated customer
Revenue from customer: $5,000-25,000/mo
**Margin on infrastructure: 99%+**

### CI/CD for Multi-Instance

When managing both shared and dedicated instances:
1. Build Docker images in CI (GitHub Actions)
2. Push to container registry (ghcr.io)
3. Deploy script pulls and restarts per-instance
4. Each instance has its own `.env` and domain

---

## 10. Action Plan

### Now (Before First Paying Customer)

| Action | Effort | Cost Impact |
|---|---|---|
| Set up automated PostgreSQL backups (pg_dump → S3 daily) | 30 minutes | +$1-3/mo |
| Add uptime monitoring (UptimeRobot free tier) | 5 minutes | $0 |
| Document recovery procedure | 30 minutes | $0 |
| **Total** | **~1 hour** | **+$3-5/mo** |

### When You Have 5-20 Paying Customers

| Action | Effort | Cost Impact |
|---|---|---|
| Move to Stage 2 (backup + monitoring) | 2 hours | ~$20-30/mo total |
| Add structured logging (pino) | 2-4 hours | $0 |
| Create VPS snapshot for quick failover | 15 minutes | $0 |

### When You Sign First Enterprise Customer

| Action | Effort | Cost Impact |
|---|---|---|
| Deploy dedicated instance (separate VPS + Docker Compose) | 2-4 hours | +$50-100/mo |
| Set up CI/CD for multi-instance deploys | 4-8 hours | $0 |
| Add tenant-level rate limiting | 4-8 hours | $0 |

### When You Have 500+ Customers

| Action | Effort | Cost Impact |
|---|---|---|
| Migrate to Kubernetes (Hetzner K8s) | 1-2 weeks | $200-500/mo |
| Hire/contract DevOps engineer | Ongoing | $5-10K/mo |
| Implement auto-scaling (HPA) | 1-2 days | $0 (included in K8s) |
| Add Redis for session cache | 2-4 hours | $10-15/mo |

---

## 11. Key Takeaways

1. **Infrastructure is a rounding error.** API costs are 170x infrastructure costs at enterprise scale. Don't over-invest in infrastructure before you have customers.

2. **Your current Docker Compose setup is correct.** It handles everything through Stage 3 (1,000 customers). Kubernetes is a Stage 4 optimization.

3. **Multi-tenancy is already built.** Per-org database isolation, encrypted connections, per-client TLS agents. No architectural changes needed.

4. **Don't go serverless.** Altius is I/O-bound with long-lived streaming connections — the opposite of serverless's sweet spot. Containers are 5-50x cheaper for this workload.

5. **Scale horizontally, not vertically.** Add more $5 VPS nodes behind a load balancer, don't buy bigger servers. Node.js apps are trivially horizontally scalable because they share nothing in memory.

6. **Dedicated instances for enterprise.** When an enterprise customer demands isolation, deploy a separate Docker Compose stack on a separate VPS. Cost: $50-100/mo. Revenue: $5,000-25,000/mo.

7. **Kubernetes is a when, not an if.** You'll need it eventually (500+ customers, auto-scaling, enterprise procurement). But not before then. Docker Compose + load balancer handles years of growth.

---

## Sources

- Hetzner Cloud pricing: CX22 ($5.39/mo), CX32 ($9.59/mo), Load Balancer ($5.39/mo), Managed DB (from $15/mo)
- Altius codebase: `docker-compose.yml`, `docker-compose.prod.yml`, `Caddyfile`, `scripts/deploy.sh`
- API Cost Analysis: `docs/API-COST-ANALYSIS.md`
- Monetization Strategy: `docs/MONETIZATION-STRATEGY.md`

---

**Last Updated:** February 8, 2026
**Purpose:** Internal planning — infrastructure scaling roadmap from Phase 1 to enterprise
