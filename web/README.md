# Altius Web Interface

**Conversational AI for OpenText Content Server**

Natural language interface for document management, workflow automation, and data visualization. Built on Next.js 16, React 19, and Claude Sonnet 4.5 with streaming agentic architecture that executes OTCS operations in real time.

![Platform](https://img.shields.io/badge/Platform-Altius-blue) ![Tools](https://img.shields.io/badge/OTCS_Tools-41-green) ![AI](https://img.shields.io/badge/AI-Claude_Sonnet_4.5-purple) ![Streaming](https://img.shields.io/badge/Response-Streaming_SSE-orange)

## Features

- **Natural language OTCS management** — ask plain-English questions, get structured results
- **41 OTCS tools** — comprehensive coverage of documents, folders, workspaces, workflows, records management, permissions, sharing
- **Streaming responses** — text, tool calls, and results render progressively via SSE
- **Agentic automation** — Claude autonomously chains multiple tool calls (up to 10 rounds) to complete complex tasks
- **Document intelligence** — extracts text from PDFs, Word docs, CSV, JSON, XML, HTML, and Markdown
- **Data visualization** — GFM table rendering and interactive charts (bar, line, area, pie) via Recharts
- **Dark mode** — full light/dark theme support via CSS custom properties
- **Cost optimization** — prompt caching and compact tool results reduce API costs by 90%
- **Production ready** — token usage tracking, error handling, and comprehensive logging

## Architecture

```
User Input
  ↓
ChatContainer (React 19)
  ↓
POST /api/chat → SSE stream
  ↓
AI Orchestrator (Claude Opus 4.5)
  ↓  ↕ iterative tool calls
OTCS Bridge → Content Server REST API
  ↓
Streaming SSE events → UI
```

| Layer | File | Role |
|-------|------|------|
| Page | `src/app/page.tsx` | Root page with Altius branding |
| Chat UI | `src/components/ChatContainer.tsx` | Message state, SSE parsing, auto-scroll |
| Messages | `src/components/MessageBubble.tsx` | Markdown rendering, chart blocks |
| Tool Cards | `src/components/ToolCallDisplay.tsx` | Expandable tool call/result display |
| Charts | `src/components/ChartBlock.tsx` | Recharts wrapper (bar/line/area/pie) |
| Input | `src/components/ChatInput.tsx` | Auto-expanding textarea |
| Usage Badge | `src/components/UsageBadge.tsx` | Real-time token and cost tracking |
| API Route | `src/app/api/chat/route.ts` | OTCS auth, SSE stream setup, Claude Sonnet 4.5 |
| Orchestrator | `src/lib/ai-orchestrator.ts` | Agentic loop, streaming, token optimization |
| Tool Bridge | `src/lib/otcs-bridge.ts` | 41 tool implementations, text extraction |
| Tool Schemas | `src/lib/tool-definitions.ts` | Anthropic tool format definitions |
| System Prompt | `src/lib/system-prompt.ts` | AI behavior, navigation strategy, chart format |

## Getting Started

### Prerequisites

- Node.js 20+
- An OpenText Content Server instance with REST API enabled
- An Anthropic API key (Claude)

### Setup

```bash
cd web
npm install
```

Create `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
OTCS_BASE_URL=https://your-server/otcs/cs.exe
OTCS_USERNAME=admin
OTCS_PASSWORD=password
OTCS_DOMAIN=               # optional
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## OTCS Tool Coverage

The web interface provides access to **41 OTCS tools** across all operations:

| Category | Count | Tools |
|----------|-------|-------|
| Authentication | 3 | `otcs_authenticate`, `otcs_session_status`, `otcs_logout` |
| Navigation & Search | 3 | `otcs_browse`, `otcs_get_node`, `otcs_search` |
| Documents | 5 | `otcs_upload`, `otcs_download_content`, `otcs_upload_folder`, `otcs_upload_batch`, `otcs_upload_with_metadata` |
| Versions | 1 | `otcs_versions` |
| Folders | 2 | `otcs_create_folder`, `otcs_node_action` (copy, move, rename, delete) |
| Workspaces | 4 | `otcs_workspace_types`, `otcs_create_workspace`, `otcs_get_workspace`, `otcs_search_workspaces` |
| Workspace Relations | 2 | `otcs_workspace_relations`, `otcs_workspace_roles` |
| Workspace Metadata | 1 | `otcs_workspace_metadata` |
| Workflows | 11 | `otcs_get_assignments`, `otcs_workflow_status`, `otcs_workflow_definition`, `otcs_workflow_tasks`, `otcs_workflow_activities`, `otcs_start_workflow`, `otcs_workflow_form`, `otcs_workflow_task`, `otcs_draft_workflow`, `otcs_workflow_info`, `otcs_manage_workflow` |
| Categories | 1 | `otcs_categories` |
| Members | 2 | `otcs_members`, `otcs_group_membership` |
| Permissions | 1 | `otcs_permissions` |
| Sharing | 1 | `otcs_share` |
| Records Management | 4 | `otcs_rm_classification`, `otcs_rm_holds`, `otcs_rm_xref`, `otcs_rm_rsi` |

## Charts

The AI can generate interactive charts by outputting a `chart` code block:

````markdown
```chart
{
  "type": "bar",
  "title": "Monthly Revenue",
  "xKey": "month",
  "series": [{ "dataKey": "revenue", "name": "Revenue ($)" }],
  "data": [
    { "month": "Jan", "revenue": 4000 },
    { "month": "Feb", "revenue": 3000 }
  ]
}
```
````

Supported types: `bar`, `line`, `area`, `pie`.

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 16, React 19, TypeScript 5 |
| **AI** | Claude Sonnet 4.5 (`@anthropic-ai/sdk`) |
| **Styling** | Tailwind CSS 4, CSS custom properties |
| **Markdown** | `react-markdown` + `remark-gfm` |
| **Charts** | Recharts |
| **Document Parsing** | `pdf-parse`, `mammoth`, `tesseract.js` |

## Scripts

```bash
npm run dev      # Start dev server (webpack)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Related Components

This web interface is part of the **Altius Platform**:

- **[MCP Server](../README.md)** — 41 OTCS tools for Claude Desktop, Cursor, and other MCP clients
- **[Autonomous Agent](../agent/README.md)** — Folder monitoring and automatic document processing
- **[Main Platform](../README.md)** — Complete Altius documentation and architecture

---

**Altius** — Intelligence at scale for OpenText Content Server.
