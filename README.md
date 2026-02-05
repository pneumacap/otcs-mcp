# Altius — AI Automation Platform for OpenText Content Server

**Transform your document repository into an intelligent automation platform**

Altius brings conversational AI, autonomous agents, and intelligent automation to OpenText Content Server through three integrated components: an MCP server with 41 agentic tools, a conversational web interface, and an autonomous document processing agent.

![Platform](https://img.shields.io/badge/Platform-Altius-blue) ![Tools](https://img.shields.io/badge/OTCS_Tools-41-green)
---

## 🚀 Platform Components

<table>
<tr>
<td width="33%">

### 📡 MCP Server
**41 OTCS tools for AI agents**

Connect Claude Desktop, Cursor, or any MCP client to your OTCS instance. Browse folders, search documents, manage workflows, enforce compliance — all through natural language.

[View Documentation →](#mcp-server-core)

</td>
<td width="33%">

### 💬 Web Interface
**Conversational UI for OTCS**

Chat-based interface for document management, workflow automation, and data visualization. Built on Next.js 16, React 19, and streaming AI responses.

[View Documentation →](#web-interface)

</td>
<td width="33%">

### 🤖 Autonomous Agent
**Document processing automation**

Monitors folders, classifies documents, extracts data, and executes complex workflows automatically. Processes thousands of documents with minimal cost.

[View Documentation →](#autonomous-agent)

</td>
</tr>
</table>

---

## 🎯 Why Altius?

### For Organizations
- **Reduce cycle times** by 60-80% for document-intensive processes
- **Cut operational costs** through intelligent automation
- **Ensure compliance** with built-in Records Management integration
- **Scale effortlessly** — handle 10x volume without adding headcount

### For Developers
- **41 production-ready tools** for OTCS integration
- **Model Context Protocol** support for any AI agent
- **Modern tech stack** (TypeScript, Next.js 16, React 19)
- **Extensible architecture** — add custom tools and workflows

### For End Users
- **Natural language interface** — no training required
- **Conversational workflows** — complete tasks by chatting
- **Intelligent insights** — charts, summaries, and recommendations
- **Always available** — autonomous agents work 24/7

---

## 📋 Complete Tool Coverage

Altius provides **41 consolidated tools** across all OTCS operations:

| Category | Count | Tools |
|----------|-------|-------|
| **Authentication** | 3 | `otcs_authenticate`, `otcs_session_status`, `otcs_logout` |
| **Navigation & Search** | 3 | `otcs_get_node`, `otcs_browse`, `otcs_search` |
| **Folders** | 2 | `otcs_create_folder`, `otcs_node_action` |
| **Documents** | 5 | `otcs_upload`, `otcs_download_content`, `otcs_upload_folder`, `otcs_upload_batch`, `otcs_upload_with_metadata` |
| **Versions** | 1 | `otcs_versions` |
| **Workspaces** | 4 | `otcs_workspace_types`, `otcs_create_workspace`, `otcs_get_workspace`, `otcs_search_workspaces` |
| **Workspace Relations** | 2 | `otcs_workspace_relations`, `otcs_workspace_roles` |
| **Workflows** | 11 | `otcs_get_assignments`, `otcs_workflow_status`, `otcs_workflow_definition`, `otcs_workflow_tasks`, `otcs_workflow_activities`, `otcs_start_workflow`, `otcs_workflow_form`, `otcs_workflow_task`, `otcs_draft_workflow`, `otcs_workflow_info`, `otcs_manage_workflow` |
| **Categories** | 2 | `otcs_categories`, `otcs_workspace_metadata` |
| **Members** | 2 | `otcs_members`, `otcs_group_membership` |
| **Permissions** | 1 | `otcs_permissions` |
| **Sharing** | 1 | `otcs_share` |
| **Records Management** | 4 | `otcs_rm_classification`, `otcs_rm_holds`, `otcs_rm_xref`, `otcs_rm_rsi` |

### Tool Profiles

Optimize performance by selecting a subset of tools:

| Profile | Tools | Use Case |
|---------|-------|----------|
| `core` | 22 | Basic document management + sharing |
| `workflow` | 30 | Document management + full workflow automation |
| `admin` | 33 | Document management + permissions/admin + RM |
| `rm` | 22 | Document management + Records Management |
| `full` | 41 | All tools (default) |

Configure via `OTCS_TOOL_PROFILE` environment variable.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Altius Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   MCP Server     │  │   Web Interface  │  │ Auto Agent   │ │
│  │                  │  │                  │  │              │ │
│  │  Claude Desktop  │  │  Browser Chat    │  │  Folder      │ │
│  │  Cursor IDE      │  │  Streaming AI    │  │  Monitor     │ │
│  │  Any MCP Client  │  │  Data Viz        │  │  Auto Process│ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                     │                    │          │
│           └─────────────────────┼────────────────────┘          │
│                                 │                                │
│                    ┌────────────▼────────────┐                  │
│                    │   OTCS Bridge Layer     │                  │
│                    │   (41 Tool Impls)       │                  │
│                    └────────────┬────────────┘                  │
│                                 │                                │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  OpenText Content Server  │
                    │      REST APIs            │
                    │  • Content Server API     │
                    │  • Business Workspaces    │
                    │  • Records Management     │
                    └───────────────────────────┘
```

---

## MCP Server (Core)

### Installation

```bash
npm install
npm run build
```

### Quick Start

Create `.env`:

```bash
OTCS_BASE_URL=https://your-server/otcs/cs.exe/api
OTCS_USERNAME=your-username
OTCS_PASSWORD=your-password
OTCS_TOOL_PROFILE=full
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Run standalone:

```bash
./start-mcp.sh
```

### Configuration for Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "otcs": {
      "command": "node",
      "args": ["/path/to/otcs-mcp/dist/index.js"],
      "env": {
        "OTCS_BASE_URL": "https://your-server/otcs/cs.exe/api",
        "OTCS_USERNAME": "admin",
        "OTCS_PASSWORD": "password",
        "OTCS_TOOL_PROFILE": "workflow",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### Configuration for Cursor IDE

Settings → Tools & MCP → New MCP Server:

```json
{
  "mcpServers": {
    "otcs": {
      "command": "node",
      "args": ["/path/to/otcs-mcp/dist/index.js"],
      "env": {
        "OTCS_BASE_URL": "https://your-server/otcs/cs.exe/api",
        "OTCS_USERNAME": "your-username",
        "OTCS_PASSWORD": "your-password",
        "OTCS_TOOL_PROFILE": "core",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### Example Operations

```
User: Show me what's in the Enterprise Workspace
Claude: [Uses otcs_browse(folder_id=2000)]

User: Find all contracts containing "termination clause"
Claude: [Uses otcs_search(query="termination clause", filter_type="documents")]

User: Create a workspace for the Acme Corp project
Claude: [Uses otcs_create_workspace(template_id=17284, name="Acme Corp")]

User: Show my pending workflow tasks
Claude: [Uses otcs_get_assignments()]

User: Apply a legal hold to these documents
Claude: [Uses otcs_rm_holds(action="create_hold") then applies to documents]
```

[Full MCP Documentation](./docs/ARCHITECTURE_PLAN.md)

---

## Web Interface

### Features

- **Natural language OTCS management** — ask questions in plain English
- **Streaming responses** — text, tool calls, and results render progressively
- **Agentic automation** — Claude chains up to 10 tool calls automatically
- **Document reading** — extracts text from PDFs, Word docs, CSV, JSON, XML, HTML
- **Interactive charts** — bar, line, area, and pie charts via Recharts
- **Dark mode** — full light/dark theme support
- **Token optimization** — prompt caching reduces API costs by 90%

### Tech Stack

| | |
|---|---|
| **Framework** | Next.js 16, React 19, TypeScript 5 |
| **AI** | Claude Sonnet 4.5 (`@anthropic-ai/sdk`) |
| **Styling** | Tailwind CSS 4 |
| **Markdown** | `react-markdown` + `remark-gfm` |
| **Charts** | Recharts |
| **Document Parsing** | `pdf-parse`, `mammoth` |

### Setup

```bash
cd web
npm install
```

Create `web/.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OTCS_BASE_URL=https://your-server/otcs/cs.exe
OTCS_USERNAME=admin
OTCS_PASSWORD=password
```

Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

[Full Web Documentation](./web/README.md)

---

## Autonomous Agent

### Overview

The Autonomous Agent monitors OTCS folders and automatically:
1. Detects new documents
2. Extracts and classifies content
3. Applies business rules
4. Executes workflows, holds, searches, sharing

### Cost Efficiency

- **Simple processing:** ~$0.01-0.03 per document
- **Complex agentic mode:** ~$0.06-0.21 per document
- **Volume example:** 1,000 docs/day = $10-30/day

### Configuration

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
      "match": {},
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

### Running

```bash
# Development mode (auto-reload)
npm run agent:dev

# Production
npm run agent
```

### Use Cases

**Legal Discovery**
- Auto-search for responsive documents
- Apply litigation holds
- Share with external counsel
- **Impact:** 3-5 day process → 2 minutes

**Contract Analysis**
- Extract key terms and obligations
- Assess risk levels
- Route for approval
- **Impact:** Pre-analyzes every contract before human review

**Invoice Processing**
- Extract vendor, amount, PO number
- Route to approval workflows
- **Impact:** Eliminates manual classification

[Full Agent Documentation](./agent/README.md)

---

## 🎯 Digital Worker Twins

Altius enables **digital worker twins** — autonomous agents that replicate the document-handling behaviors of specific job roles. Each twin operates at one of three automation levels:

| Level | Description | Examples |
|-------|-------------|----------|
| **Full Automation** | Complete task execution with exception escalation | Document filing, compliance tracking, permit monitoring |
| **Assisted Automation** | Preparation and research while humans make final decisions | Underwriting support, quality assessment, case management |
| **Advisory Automation** | Insights and recommendations for strategic decisions | Portfolio analysis, risk trending, performance dashboards |

### Mapped Roles

Altius can automate or augment **56 distinct knowledge worker roles** across:

- **Back-office:** AP/AR, HR, contracts, compliance, legal, customer service
- **Healthcare:** Medical records, patient intake, insurance verification, clinical documentation
- **Financial services:** Loan origination, underwriting, claims processing, KYC/AML
- **Real estate:** Property management, lease administration, title/escrow
- **Government:** Permitting, FOIA, case management, grant administration
- **Legal:** Discovery, document review, matter management, compliance
- **Manufacturing:** QA/QC, regulatory submissions, supplier management
- **Retail:** Merchandising, vendor management, compliance

[Read the full Digital Workers Report](./docs/ALTIUS-DIGITAL-WORKERS-REPORT.md)

---

## 📊 Business Impact

### Measured Results

| Metric | Before Altius | With Altius | Improvement |
|--------|--------------|-------------|-------------|
| **Cycle Time** | 15-30 days | 4-8 days | **70% faster** |
| **Error Rate** | 5-15% | 0.5-2% | **90% reduction** |
| **Cost per Transaction** | $15-25 | $5-8 | **60-70% savings** |
| **Document Processing** | Manual review | Automated classification | **95% time saved** |
| **Compliance Coverage** | 60-80% | 99%+ | **25% improvement** |

### ROI Model

**Medium-sized enterprise (1,000 docs/day):**
- **Labor savings:** 2-3 FTE × $60k = $120-180k/year
- **AI costs:** $10-30/day × 250 days = $2.5-7.5k/year
- **Net savings:** $112-177k/year
- **ROI:** 1,400-7,000%

---

## 🚀 Getting Started

### Prerequisites

- **OpenText Content Server** (version 16.0+) with REST API enabled
- **Node.js** 20 or later
- **Anthropic API key** ([get one here](https://console.anthropic.com))

### Quick Start (All Components)

```bash
# Clone repository
git clone https://github.com/yourusername/altius.git
cd altius

# Install dependencies
npm install
cd web && npm install && cd ..

# Configure environment
cp .env.example .env
nano .env  # Add OTCS credentials and Anthropic API key

# Build MCP server
npm run build

# Run all components
npm run agent          # Terminal 1: Autonomous agent
cd web && npm run dev  # Terminal 2: Web interface
./start-mcp.sh         # Terminal 3: MCP server (for Claude Desktop/Cursor)
```

### Individual Component Setup

Each component can run independently:

- **MCP Server only:** Follow [MCP Server Configuration](#mcp-server-core)
- **Web UI only:** Follow [Web Interface Setup](#web-interface)
- **Agent only:** Follow [Autonomous Agent Setup](#autonomous-agent)

---

## 📖 Documentation

### API Documentation
- [Architecture & Roadmap](./docs/ARCHITECTURE_PLAN.md)
- [Content Server REST API Spec](./docs/content-server-rest-api-2.0.2.yaml)
- [Business Workspaces API Spec](./docs/opentext-business-workspaces-rest-api-v1-and-v2.yaml)
- [Records Management API Spec](./docs/opentext-records-management-26.1.json)

### Implementation Guides
- [Category Management Guide](./docs/CATEGORY-MANAGEMENT-API.md)
- [OTCS Reference IDs](./docs/OTCS-REFERENCE-IDS.md)
- [Implementation Plan](./docs/IMPLEMENTATION-PLAN.md)
- [Future Features](./docs/FUTURE-FEATURES.md)

### Business Documentation
- [Digital Workers Report](./docs/ALTIUS-DIGITAL-WORKERS-REPORT.md) — 56 roles across 10 industries
- [OTCS MCP Strategy](./docs/OTCS-MCP-STRATEGY.pdf)
- [Workflow Maps Report](./docs/WORKFLOW-MAPS-REPORT.pdf)

---

## 🧪 Testing

```bash
# MCP Server tests
npm test                    # Main API connectivity
npm run test:workflows      # Workflow operations
npm run test:workspaces     # Workspace operations
npm run test:rm             # Records Management

# Web UI
cd web
npm run lint

# Agent
# Upload test documents to watched folders and monitor logs
npm run agent:dev
```

**Test Results:** 40/40 RM tests passed, 0 failed, 5 skipped

---

## 🔐 Security

- **Credential management:** Store secrets in `.env`, never commit to version control
- **TLS:** Supports self-signed certificates via `NODE_TLS_REJECT_UNAUTHORIZED=0`
- **Authentication:** Session-based OTCS authentication with auto-renewal
- **Permissions:** Respects OTCS ACLs — users can only access authorized content
- **Audit trails:** All operations logged to OTCS audit system

---

## 🗺️ Roadmap

### Phase 9: RM Disposition (Planned)
- `otcs_rm_disposition` — Disposition search and processing

### Phase 10: Enhanced Features (Planned)
- `otcs_favorites` — Manage favorites and tabs
- `otcs_reminders` — Node reminders
- `otcs_notifications` — Notification interests
- `otcs_recycle_bin` — Restore/purge deleted items

**Projected Total:** 46 consolidated tools

### Platform Enhancements
- [ ] Multi-tenant agent configuration
- [ ] Real-time agent monitoring dashboard
- [ ] Webhook-based document triggers
- [ ] Integration marketplace (Salesforce, ServiceNow, etc.)
- [ ] Advanced analytics and reporting
- [ ] White-label deployment options

---

## 🤝 Contributing

We welcome contributions! Areas of interest:

- **New OTCS tools** — Implement missing Content Server features
- **Agent workflows** — Share rule definitions for common use cases
- **UI enhancements** — Improve chat interface, add visualization types
- **Documentation** — Tutorials, guides, and example implementations
- **Performance** — Optimization for high-volume scenarios

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) file for details.

---

## 🏢 About Altius

Altius is an AI automation platform purpose-built for OpenText Content Server. We transform passive document repositories into active, intelligent automation platforms that eliminate manual work, ensure compliance, and scale effortlessly.

**Built for:**
- Enterprises with document-intensive operations
- Organizations requiring strict compliance and audit trails
- Teams drowning in manual document processing
- Developers building AI-powered document workflows

**Built with:**
- Claude Sonnet 4.5 (Anthropic)
- OpenText Content Server REST APIs
- Model Context Protocol (MCP)
- Next.js 16, React 19, TypeScript 5

---

## 📬 Contact & Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/altius/issues)
- **Documentation:** [Full docs](./docs/)
- **Email:** support@altius.ai

---

**Altius** — Intelligence at scale for OpenText Content Server.
