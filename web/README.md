# OTCS AI Assistant — Web UI

A conversational AI interface for **OpenText Content Server**. Browse folders, search documents, complete workflows, manage permissions, and visualize data — all through natural language.

Built on Next.js 16, React 19, and Claude Opus 4.5 with a streaming agentic architecture that executes OTCS operations in real time.

![Chat UI](https://img.shields.io/badge/UI-Chat-blue) ![Tools](https://img.shields.io/badge/OTCS_Tools-38-green) ![Streaming](https://img.shields.io/badge/Response-Streaming_SSE-orange)

## Features

- **Natural language OTCS management** — ask plain-English questions, get structured results
- **38 OTCS tools** — documents, folders, workspaces, workflows, records management, permissions, sharing
- **Streaming responses** — text, tool calls, and results render progressively via SSE
- **Agentic loop** — Claude autonomously chains multiple tool calls (up to 10 rounds) to complete complex tasks
- **Document reading** — extracts text from PDFs, Word docs, CSV, JSON, XML, HTML, and Markdown
- **Markdown tables** — GFM table rendering for structured data
- **Interactive charts** — bar, line, area, and pie charts via Recharts, driven by AI-generated JSON
- **Dark mode** — full light/dark theme support via CSS custom properties
- **Token optimization** — prompt caching and compact tool results reduce API costs

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
| Page | `src/app/page.tsx` | Root page |
| Chat UI | `src/components/ChatContainer.tsx` | Message state, SSE parsing, auto-scroll |
| Messages | `src/components/MessageBubble.tsx` | Markdown rendering, chart blocks |
| Tool Cards | `src/components/ToolCallDisplay.tsx` | Expandable tool call/result display |
| Charts | `src/components/ChartBlock.tsx` | Recharts wrapper (bar/line/area/pie) |
| Input | `src/components/ChatInput.tsx` | Auto-expanding textarea |
| API Route | `src/app/api/chat/route.ts` | OTCS auth, SSE stream setup |
| Orchestrator | `src/lib/ai-orchestrator.ts` | Agentic loop, streaming, token optimization |
| Tool Bridge | `src/lib/otcs-bridge.ts` | 38 tool implementations, text extraction |
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

| Category | Tools |
|----------|-------|
| Navigation & Search | `otcs_browse`, `otcs_get_node`, `otcs_search` |
| Documents | `otcs_upload`, `otcs_download_content`, `otcs_upload_folder`, `otcs_upload_batch`, `otcs_upload_with_metadata`, `otcs_versions` |
| Folders | `otcs_create_folder` |
| Node Operations | `otcs_node_action` (copy, move, rename, delete, update description) |
| Workspaces | `otcs_workspace_types`, `otcs_create_workspace`, `otcs_get_workspace`, `otcs_search_workspaces` |
| Workspace Data | `otcs_workspace_relations`, `otcs_workspace_roles`, `otcs_workspace_metadata` |
| Workflows | `otcs_get_assignments`, `otcs_workflow_status`, `otcs_workflow_definition`, `otcs_workflow_tasks`, `otcs_workflow_activities`, `otcs_start_workflow`, `otcs_workflow_form`, `otcs_workflow_task`, `otcs_draft_workflow`, `otcs_workflow_info`, `otcs_manage_workflow` |
| Categories | `otcs_categories` |
| Members | `otcs_members`, `otcs_group_membership` |
| Permissions | `otcs_permissions` |
| Records Management | `otcs_rm_classification`, `otcs_rm_holds`, `otcs_rm_xref`, `otcs_rm_rsi` |
| Sharing | `otcs_share` |

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
| **AI** | Anthropic Claude Opus 4.5 (`@anthropic-ai/sdk`) |
| **Styling** | Tailwind CSS 4, CSS custom properties |
| **Markdown** | `react-markdown` + `remark-gfm` |
| **Charts** | Recharts |
| **Document Parsing** | `pdf-parse`, `mammoth` |

## Scripts

```bash
npm run dev      # Start dev server (webpack)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Related

This is the web frontend for the [OTCS MCP Server](../README.md) — the same 38 tools are also available as an MCP server for use with Claude Desktop, Claude Code, and other MCP clients.
