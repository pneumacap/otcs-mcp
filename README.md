# Altius

**AI-powered platform for OpenText Content Server**

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Tests](https://img.shields.io/badge/Tests-21%20passing-brightgreen) ![Build](https://img.shields.io/badge/Build-passing-brightgreen) ![Node](https://img.shields.io/badge/Node-22%2B-orange)

---

## What is Altius?

Altius is a production-grade AI automation platform that transforms OpenText Content Server into an intelligent document management system. It gives every knowledge worker a digital assistant capable of navigating folders, executing workflows, enforcing compliance, and processing thousands of documents autonomously. Deploy as an MCP server for Claude Desktop and Cursor, a SaaS web UI with authentication and billing, or an autonomous agent for unattended document processing.

---

## Architecture Overview

```
altius/
├── packages/core/     @otcs/core — 42 tools, shared OTCS client, 9,500 LOC
├── web/               Next.js 16 SaaS — auth, billing, chat, per-org connections
├── src/               MCP server — stdio transport for Claude Desktop & Cursor
├── agent/             Autonomous agent — polling, classification, rule-based workflows
└── migration/         Content migration toolkit — cross-system transfer & verification
```

**Core Package:** All four consumers import from `@otcs/core`, which provides a unified OTCS client, type definitions, tool schemas, and a protocol-neutral tool handler. This ensures consistency across MCP server, web UI, autonomous agent, and migration toolkit.

---

## Core Capabilities

The platform provides 42 production-ready tools across 8 operational domains:

| Domain | Count | Tools |
|--------|-------|-------|
| **Navigation & Search** | 3 | `otcs_get_node`, `otcs_browse`, `otcs_search` |
| **Documents** | 5 | `otcs_upload`, `otcs_download_content`, `otcs_upload_folder`, `otcs_upload_batch`, `otcs_upload_with_metadata` |
| **Folders** | 3 | `otcs_create_folder`, `otcs_node_action`, `otcs_delete_nodes` |
| **Workspaces** | 7 | `otcs_workspace_types`, `otcs_create_workspace`, `otcs_create_workspaces`, `otcs_get_workspace`, `otcs_search_workspaces`, `otcs_workspace_relations`, `otcs_workspace_roles` |
| **Workflows** | 10 | `otcs_get_assignments`, `otcs_workflow_status`, `otcs_workflow_definition`, `otcs_workflow_tasks`, `otcs_workflow_activities`, `otcs_start_workflow`, `otcs_workflow_form`, `otcs_workflow_task`, `otcs_draft_workflow`, `otcs_manage_workflow` |
| **Categories & Metadata** | 3 | `otcs_categories`, `otcs_workspace_metadata`, `otcs_versions` |
| **Members & Permissions** | 4 | `otcs_members`, `otcs_group_membership`, `otcs_permissions`, `otcs_share` |
| **Records Management** | 4 | `otcs_rm_classification`, `otcs_rm_holds`, `otcs_rm_xref`, `otcs_rm_rsi` |
| **Tree Operations** | 3 | `otcs_browse_tree`, `otcs_create_folder_structure`, `otcs_workflow_info` |

**Protocol-Neutral Design:** Tool schemas are stored as pure JSON Schema objects and converted to MCP or Anthropic format on demand. This allows the same tool definitions to serve Claude Desktop (MCP), the web UI (Anthropic SDK), and the autonomous agent.

---

## Quick Start

### MCP Server (Claude Desktop / Cursor)

**1. Install dependencies and build**

```bash
git clone https://github.com/yourusername/altius.git
cd altius
npm install
npm run build
```

**2. Configure Claude Desktop**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "otcs": {
      "command": "node",
      "args": ["/absolute/path/to/altius/dist/index.js"],
      "env": {
        "OTCS_BASE_URL": "https://your-server.com/otcs/cs.exe/api",
        "OTCS_USERNAME": "your-username",
        "OTCS_PASSWORD": "your-password",
        "OTCS_TOOL_PROFILE": "full"
      }
    }
  }
}
```

**3. Configure Cursor**

Settings → Tools & MCP → New MCP Server:

```json
{
  "mcpServers": {
    "otcs": {
      "command": "node",
      "args": ["/absolute/path/to/altius/dist/index.js"],
      "env": {
        "OTCS_BASE_URL": "https://your-server.com/otcs/cs.exe/api",
        "OTCS_USERNAME": "your-username",
        "OTCS_PASSWORD": "your-password"
      }
    }
  }
}
```

**Environment Variables:**

- `OTCS_BASE_URL` — Base URL for OTCS REST API (required)
- `OTCS_USERNAME` — OTCS username (required)
- `OTCS_PASSWORD` — OTCS password (required)
- `OTCS_DOMAIN` — Windows domain (optional)
- `OTCS_TOOL_PROFILE` — Tool subset: `core`, `workflow`, `admin`, `rm`, `full` (default: `full`)
- `OTCS_TLS_SKIP_VERIFY` — Set to `true` for self-signed certificates (default: `false`)

---

### Web UI (SaaS)

**Prerequisites:**

- Node.js 22+
- PostgreSQL 16+

**1. Install dependencies**

```bash
cd web
npm install
```

**2. Configure environment**

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# OTCS Connection
OTCS_BASE_URL=https://your-server.com/otcs/cs.exe/api
OTCS_USERNAME=admin
OTCS_PASSWORD=your-password

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Database (PostgreSQL)
DATABASE_URL=postgresql://altius:altius@localhost:5432/altius

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Stripe (optional for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# Security
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
OTCS_TLS_SKIP_VERIFY=false
```

**3. Start PostgreSQL (via Docker Compose)**

From the root directory:

```bash
docker compose up -d
```

**4. Initialize database**

```bash
cd web
npx drizzle-kit push
```

**5. Start development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### Autonomous Agent

**1. Configure agent**

Edit `agent/agent-config.json`:

```json
{
  "enabled": true,
  "pollIntervalMs": 30000,
  "watchFolders": [181144, 180922],
  "model": "claude-sonnet-4-5-20250929",
  "rules": [
    {
      "name": "Contract approval workflow",
      "match": {
        "namePattern": ".*\\.pdf$"
      },
      "extractFields": {
        "contractType": "type or category of contract",
        "counterparty": "vendor name",
        "contractValue": "total contract value"
      },
      "instructions": "Analyze contract and start approval workflow",
      "actions": [
        { "type": "start_workflow", "workflowId": 181308 }
      ]
    }
  ]
}
```

**2. Set environment variables**

Create `.env` in the root directory (copy from `.env.example`):

```bash
OTCS_BASE_URL=https://your-server.com/otcs/cs.exe/api
OTCS_USERNAME=agent-user
OTCS_PASSWORD=agent-password
ANTHROPIC_API_KEY=sk-ant-...
```

**3. Run agent**

```bash
npm run agent
```

For development with auto-reload:

```bash
npm run agent:dev
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript 5 ESM |
| **Web Framework** | Next.js 16, React 19 |
| **Database** | PostgreSQL 16, Drizzle ORM |
| **Authentication** | NextAuth v5 (Google, Microsoft, Credentials) |
| **Billing** | Stripe |
| **AI** | Anthropic Claude (Sonnet 4.5) |
| **MCP** | Model Context Protocol SDK 1.0 |
| **Testing** | Vitest 3.2, 21 tests passing |
| **Styling** | Tailwind CSS 4 |
| **Charts** | Recharts |
| **Document Parsing** | pdf-parse, mammoth, tesseract.js |
| **Deployment** | Docker, Caddy reverse proxy |

---

## Security

- **Encryption:** AES-256-GCM for stored OTCS passwords (per-organization keys)
- **TLS:** Per-client TLS configuration with opt-in `tlsSkipVerify` for self-signed certificates (no global bypass)
- **Rate Limiting:** Sliding window rate limiting on all API routes
- **CORS:** Same-origin policy enforced
- **Security Headers:** HSTS, X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy
- **Password Hashing:** bcrypt for user passwords
- **Sessions:** JWT-based sessions with secure httpOnly cookies
- **Validation:** Zod schemas for all user inputs and environment variables
- **Audit:** All OTCS operations logged to server audit system

---

## Deployment

**Docker Compose (Development + Production)**

The repository includes a production-ready `docker-compose.yml`:

```bash
docker compose up -d
```

Services:
- PostgreSQL 16 (persistent volume)
- Caddy reverse proxy (auto-HTTPS)
- Altius web UI (Next.js)

**Environment-Specific Configuration:**

- Development: `.env.local`
- Production: `.env.production`

**One-Command VPS Deploy:**

```bash
./scripts/deploy.sh
```

This script:
1. Builds Docker images
2. Pushes to registry
3. SSH to VPS
4. Pulls images and restarts services
5. Runs database migrations

**CI/CD (GitHub Actions):**

The `.github/workflows/` directory contains workflows for:
- Linting and type-checking (ESLint, TypeScript)
- Running tests (Vitest)
- Building all packages
- Building and pushing Docker images
- Deploying to staging and production

---

## Project Status

| Component | Status |
|-----------|--------|
| Monorepo refactor (`@otcs/core`) | ✅ Complete |
| Type system (9 domain files, 139 exports) | ✅ Complete |
| Authentication (3 providers) | ✅ Complete |
| Database (11 tables, Drizzle ORM) | ✅ Complete |
| Billing (Stripe integration) | ✅ Complete |
| Security hardening (AES-256-GCM, TLS, validation) | ✅ Complete |
| Infrastructure (Docker, Caddy, CI/CD) | ✅ Complete |
| Tests (21 passing: cost, utils, formats) | ✅ Complete |
| Tool definitions (42 tools) | ✅ Complete |
| MCP server (Claude Desktop, Cursor) | ✅ Complete |
| Web UI (Next.js 16, streaming chat) | ✅ Complete |
| Autonomous agent (polling, classification) | ✅ Complete |
| Migration toolkit | ✅ Complete |

---

## Development

**Install dependencies:**

```bash
npm install
cd web && npm install
```

**Build packages:**

```bash
npm run build          # Type-check all packages
npm run build:all      # Build MCP server + web UI
```

**Run tests:**

```bash
npm test               # Run unit tests (Vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

**Linting and formatting:**

```bash
npm run lint           # ESLint
npm run lint:fix       # Auto-fix
npm run format         # Prettier
npm run format:check   # Check formatting
```

**Run services:**

```bash
npm run dev            # MCP server (stdio mode)
npm run agent          # Autonomous agent
npm run agent:dev      # Agent with auto-reload
cd web && npm run dev  # Web UI (http://localhost:3000)
```

**Database operations:**

```bash
cd web
npm run db:generate    # Generate migrations
npm run db:migrate     # Run migrations
npm run db:studio      # Drizzle Studio (GUI)
```

**Clean build artifacts:**

```bash
npm run clean
```

---

## License

MIT License

Copyright (c) 2026 Altius

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Altius** — Intelligence at scale for OpenText Content Server.
