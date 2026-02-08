# Altius Web UI

Multi-tenant SaaS platform providing conversational AI for OpenText Content Server. Built with Next.js 16, React 19, TypeScript 5, Drizzle ORM, PostgreSQL 16, NextAuth v5, and Stripe.

## Features

- **Multi-tenant SaaS** — Organizations with role-based access control (owner/admin/member)
- **Authentication** — NextAuth v5 with Google OAuth, email/password, and OTDS integration
- **Subscription billing** — Stripe integration with 3 tiers (Free/Pro/Enterprise), quota enforcement
- **AI chat interface** — Streaming agentic loop with Claude Sonnet 4.5, up to 10 tool-use rounds
- **44 OTCS tools** — Browse, search, upload, workflow management, records management, permissions
- **Parallel execution** — Batch of 6 concurrent tool calls for faster response times
- **Real-time cost tracking** — Token usage and cost displayed per message
- **Data visualization** — Interactive charts (bar/line/area/pie) via Recharts
- **Document intelligence** — Extract text from PDF, Word, CSV, JSON, XML, HTML, Markdown
- **Enterprise security** — AES-256-GCM encryption, rate limiting, CORS, security headers

## Architecture

```
web/
├── src/
│   ├── app/                      # Next.js 16 App Router
│   │   ├── page.tsx              # Landing page
│   │   ├── sign-in/              # Email/password + OAuth login
│   │   ├── sign-up/              # User registration
│   │   ├── chat/                 # Chat interface (protected)
│   │   ├── billing/              # Subscription management
│   │   ├── settings/             # Profile, connections, usage
│   │   └── api/                  # API routes
│   │       ├── auth/             # NextAuth handlers + registration
│   │       ├── chat/             # SSE streaming chat endpoint
│   │       ├── billing/          # Stripe checkout + portal + info
│   │       ├── connections/      # OTCS connection CRUD
│   │       ├── health/           # Health check
│   │       └── webhooks/stripe/  # Stripe webhooks
│   ├── components/               # React 19 components
│   │   ├── ChatContainer.tsx    # Message state, SSE parsing, auto-scroll
│   │   ├── MessageBubble.tsx    # Markdown + charts + tool calls
│   │   ├── ToolCallDisplay.tsx  # Expandable tool execution cards
│   │   ├── ChartBlock.tsx       # Recharts wrapper
│   │   ├── ChatInput.tsx        # Auto-expanding textarea
│   │   ├── UsageBadge.tsx       # Real-time cost tracking
│   │   └── landing/             # Landing page sections
│   ├── lib/                      # Core logic
│   │   ├── ai-orchestrator.ts   # Agentic loop with Anthropic SDK
│   │   ├── auth.ts              # NextAuth v5 config (Node.js runtime)
│   │   ├── auth.config.ts       # NextAuth config (Edge runtime)
│   │   ├── encryption.ts        # AES-256-GCM for OTCS passwords
│   │   ├── rate-limit.ts        # Sliding window rate limiter
│   │   ├── system-prompt.ts     # AI behavior instructions
│   │   └── validations.ts       # Zod schemas
│   ├── db/                       # Database layer
│   │   ├── schema.ts            # Drizzle ORM schemas (11 tables)
│   │   ├── client.ts            # PostgreSQL connection pool
│   │   └── queries/             # Database queries
│   └── middleware.ts             # Auth + rate limiting + security headers
├── drizzle/                      # Database migrations
├── drizzle.config.ts             # Drizzle ORM configuration
├── Dockerfile                    # Multi-stage production build
└── package.json                  # Dependencies + scripts
```

## Prerequisites

- Node.js 22+
- PostgreSQL 16+
- OpenText Content Server instance with REST API enabled
- Anthropic API key
- Stripe account (for billing features)

## Setup

### 1. Install dependencies

```bash
cd web
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# ── Database ──
DATABASE_URL=postgresql://altius:altius@localhost:5432/altius

# ── NextAuth ──
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>

# ── Security ──
ENCRYPTION_KEY=<openssl rand -hex 32>

# ── Anthropic API ──
ANTHROPIC_API_KEY=sk-ant-...

# ── OTCS (default connection) ──
OTCS_BASE_URL=https://your-server.com/otcs/cs.exe/api
OTCS_USERNAME=admin
OTCS_PASSWORD=password
OTCS_DOMAIN=
OTCS_TLS_SKIP_VERIFY=false

# ── Stripe ──
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# ── OAuth (optional) ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

### 3. Start PostgreSQL

```bash
# Using docker-compose (from root)
cd ..
docker-compose up -d postgres

# Or install locally and start
brew install postgresql@16
brew services start postgresql@16
createdb altius
```

### 4. Run database migrations

```bash
npx drizzle-kit push
```

### 5. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Application URL (e.g., `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | Secret for JWT signing (32+ random bytes) |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key for encrypting OTCS passwords (64 hex chars) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `OTCS_BASE_URL` | No | Default OTCS base URL (can be overridden per org) |
| `OTCS_USERNAME` | No | Default OTCS username |
| `OTCS_PASSWORD` | No | Default OTCS password |
| `OTCS_DOMAIN` | No | Default OTCS domain |
| `OTCS_TLS_SKIP_VERIFY` | No | Skip TLS verification (use only for development) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (required for billing) |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key (client-side) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | No | Stripe price ID for Pro plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | No | Stripe price ID for Enterprise plan |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | No | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | No | Microsoft OAuth client secret |

## Database Schema

PostgreSQL 16 with Drizzle ORM. Run migrations with `npx drizzle-kit push`.

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `users` | User accounts | `id`, `email`, `passwordHash`, `name`, `image` |
| `organizations` | Multi-tenant organizations | `id`, `name`, `slug` |
| `orgMemberships` | User-org relationships | `userId`, `orgId`, `role` (owner/admin/member) |
| `sessions` | NextAuth sessions | `sessionToken`, `userId`, `expires` |
| `accounts` | OAuth accounts | `userId`, `provider`, `providerAccountId` |
| `verificationTokens` | Email verification tokens | `identifier`, `token`, `expires` |
| `otcsConnections` | Per-org OTCS connections | `orgId`, `baseUrl`, `username`, `passwordEncrypted` |
| `subscriptions` | Stripe subscriptions | `orgId`, `plan`, `status`, `stripeSubscriptionId` |
| `usageRecords` | Token usage tracking | `orgId`, `userId`, `inputTokens`, `outputTokens`, `costUsd` |
| `apiKeys` | API keys for programmatic access | `orgId`, `keyHash`, `revokedAt` |
| `auditLogs` | Audit trail | `orgId`, `userId`, `action`, `resourceType`, `metadata` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Landing page |
| GET | `/sign-in` | No | Sign in page (email/password + OAuth) |
| POST | `/api/auth/register` | No | User registration |
| GET/POST | `/api/auth/[...nextauth]` | No | NextAuth handlers |
| GET | `/chat` | Yes | Chat interface |
| POST | `/api/chat` | Yes | SSE streaming chat endpoint |
| GET | `/billing` | Yes | Subscription management |
| POST | `/api/billing/checkout` | Yes | Create Stripe checkout session |
| GET | `/api/billing/info` | Yes | Get subscription info |
| POST | `/api/billing/portal` | Yes | Create Stripe customer portal session |
| POST | `/api/webhooks/stripe` | No | Stripe webhook handler |
| GET | `/settings/profile` | Yes | User profile settings |
| GET | `/settings/connections` | Yes | OTCS connection management |
| GET/POST | `/api/connections` | Yes | CRUD for OTCS connections |
| GET | `/settings/usage` | Yes | Usage statistics |
| GET | `/api/health` | No | Health check endpoint |

## Authentication

NextAuth v5 with 3 authentication providers:

### 1. Email/Password

- bcrypt hashing with 12 rounds
- Email verification flow
- Password reset via verification tokens
- Account linking via email (Google OAuth automatically links if email matches)

### 2. Google OAuth

- OAuth 2.0 flow with Google
- Auto-links to existing account if email matches
- Creates new account if no match

### 3. OTDS (OpenText Directory Services)

- REST API authentication via `/api/v1/auth`
- Validates against OpenText Directory Services
- Creates/updates local user account on successful auth

### Session Management

- JWT sessions stored in PostgreSQL
- Edge-compatible middleware via `auth.config.ts`
- Session includes `userId`, `orgId`, `plan` for authorization

## Multi-tenancy

### Organizations

- Every user belongs to one or more organizations
- Each organization has a `slug` for URL routing (e.g., `/org/acme/chat`)
- Organizations own OTCS connections, subscriptions, and usage records

### Roles

- **Owner** — Full access, can delete organization
- **Admin** — Can manage members and settings
- **Member** — Can use chat interface and view usage

### OTCS Connections

- Per-organization OTCS connections
- Passwords encrypted with AES-256-GCM
- Multiple connections per organization (future feature)

## Billing

Stripe integration with 3 subscription tiers:

| Tier | Price | Messages/Month | Features |
|------|-------|----------------|----------|
| Free | $0 | 100 | Basic chat, 44 OTCS tools |
| Pro | $49 | 5,000 | Priority support, advanced tools |
| Enterprise | Custom | Unlimited | Dedicated support, custom integrations, SLA |

### Implementation

- Checkout sessions via `/api/billing/checkout`
- Customer portal for subscription management via `/api/billing/portal`
- Webhooks at `/api/webhooks/stripe` for subscription lifecycle events
- Quota enforcement in middleware (checks usage against plan limits)
- Usage tracking in `usageRecords` table

### Webhook Events

Handled events:
- `checkout.session.completed` — Create subscription
- `customer.subscription.updated` — Update subscription status
- `customer.subscription.deleted` — Cancel subscription
- `invoice.payment_succeeded` — Record payment
- `invoice.payment_failed` — Handle failed payment

## AI Chat

### Orchestrator

Agentic loop in `ai-orchestrator.ts`:

1. Send user message to Claude Sonnet 4.5
2. Stream text deltas to client via SSE
3. Detect `tool_use` blocks in response
4. Execute up to 6 tools in parallel via `@otcs/core/tools/handler`
5. Send `tool_result` blocks back to Claude
6. Repeat for up to 10 rounds or until `end_turn`
7. Stream usage statistics and cost

### Features

- **Streaming SSE** — Text appears as it's generated
- **Prompt caching** — System prompt cached to reduce costs by 90%
- **Parallel execution** — Up to 6 concurrent tool calls
- **Cost tracking** — Real-time display of tokens and USD cost
- **Error handling** — Graceful degradation on tool failures
- **Token optimization** — Compact tool results using `compactToolResult()`

### Available Tools

44 OTCS tools from `@otcs/core` package:

- **Auth**: `otcs_authenticate`, `otcs_session_status`, `otcs_logout`
- **Browse**: `otcs_browse`, `otcs_browse_tree`, `otcs_get_node`
- **Search**: `otcs_search`, `otcs_search_workspaces`
- **Upload**: `otcs_upload`, `otcs_upload_folder`, `otcs_upload_batch`, `otcs_upload_with_metadata`
- **Download**: `otcs_download_content`
- **Folders**: `otcs_create_folder`, `otcs_create_folder_structure`, `otcs_node_action`
- **Workspaces**: `otcs_workspace_types`, `otcs_create_workspace`, `otcs_create_workspaces`, `otcs_get_workspace`, `otcs_workspace_metadata`, `otcs_workspace_relations`, `otcs_workspace_roles`
- **Workflows**: `otcs_get_assignments`, `otcs_workflow_status`, `otcs_workflow_definition`, `otcs_workflow_tasks`, `otcs_workflow_activities`, `otcs_start_workflow`, `otcs_workflow_form`, `otcs_workflow_task`, `otcs_draft_workflow`, `otcs_workflow_info`, `otcs_manage_workflow`
- **Records Management**: `otcs_rm_classification`, `otcs_rm_holds`, `otcs_rm_xref`, `otcs_rm_rsi`
- **Permissions**: `otcs_permissions`, `otcs_share`
- **Members**: `otcs_members`, `otcs_group_membership`
- **Categories**: `otcs_categories`
- **Versions**: `otcs_versions`
- **Delete**: `otcs_delete_nodes`

## UI Components

### ChatContainer

- Manages message state (user + assistant messages)
- Parses SSE events from `/api/chat`
- Auto-scrolls to latest message
- Handles retry on error

### MessageBubble

- Renders Markdown with `react-markdown` + `remark-gfm`
- Detects and renders chart blocks via `ChartBlock`
- Displays tool calls via `ToolCallDisplay`
- User/assistant message styling

### ChartBlock

- Recharts wrapper supporting bar, line, area, pie charts
- Parses JSON from chart code blocks
- Responsive sizing
- Light/dark theme support

### ToolCallDisplay

- Expandable cards showing tool name, args, and result
- Syntax highlighting for JSON
- Error state styling
- Execution time display

### UsageBadge

- Real-time token and cost tracking
- Displays input/output/cache tokens
- Shows USD cost per message
- Responsive tooltip

## Security

### Encryption

- **OTCS passwords** — AES-256-GCM encryption with random IV per record
- **Encryption key** — 64-character hex string in `ENCRYPTION_KEY` env var
- **JWT sessions** — Signed with `NEXTAUTH_SECRET`

### Rate Limiting

- Sliding window algorithm in `rate-limit.ts`
- Auth endpoints: 10 requests/minute per IP
- Chat endpoint: 20 requests/minute per user
- Enforced in middleware

### CORS

- Same-origin policy enforced
- Preflight requests handled for API routes
- Dynamic origin detection based on request

### Security Headers

Applied to all responses via middleware:

- `X-Frame-Options: DENY` — Prevent clickjacking
- `X-Content-Type-Options: nosniff` — Prevent MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — Limit referrer leakage
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — Disable unnecessary features
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — Force HTTPS

### Input Validation

- Zod schemas in `validations.ts`
- Server-side validation for all API endpoints
- Type-safe request/response handling

## Deployment

### Docker

Multi-stage Dockerfile for optimized production builds:

```bash
# Build image
docker build -t altius-web .

# Run container
docker run -p 3000:3000 --env-file .env.local altius-web
```

### Docker Compose

Full stack with PostgreSQL and Caddy reverse proxy:

```bash
# From root directory
docker-compose up -d
```

Services:
- `web` — Next.js application on port 3000
- `postgres` — PostgreSQL 16 on port 5432
- `caddy` — Reverse proxy with automatic HTTPS on port 443

### Environment

Set these environment variables in production:

- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — Public URL (e.g., `https://app.altius.ai`)
- All other vars from `.env.example`

## Testing

Vitest configuration at `vitest.config.ts`. Currently 0 web-specific tests (core package tests run from root).

```bash
# Run tests (from root)
npm test

# Run tests in watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## Scripts

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
npx drizzle-kit push # Push schema changes to database
npx drizzle-kit studio # Open Drizzle Studio (database GUI)
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 |
| Payments | Stripe |
| AI | Anthropic SDK (Claude Sonnet 4.5) |
| Styling | Tailwind CSS 4 |
| Markdown | react-markdown + remark-gfm |
| Charts | Recharts |
| Validation | Zod |
| HTTP Client | Fetch API (native) |

## Related

This web application is part of the **Altius Platform**:

- **[MCP Server](../README.md)** — 44 OTCS tools for Claude Desktop, Cursor, and MCP clients
- **[Core Package](../packages/core/README.md)** — Shared OTCS client and tool layer
- **[Migration Toolkit](../MIGRATION-TOOLKIT.md)** — Content transfer between systems

---

**Altius** — Intelligence at scale for OpenText Content Server.
