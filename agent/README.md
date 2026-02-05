# Altius Autonomous Agent

**Intelligent document processing automation for OpenText Content Server**

The Altius Agent is an autonomous polling service that monitors OTCS folders, processes incoming documents with AI-powered classification and extraction, and executes complex workflows automatically. It transforms passive document repositories into active, intelligent automation platforms.

## Overview

The agent operates on a simple but powerful loop:

1. **Poll** — Monitor configured folders for new documents
2. **Download** — Extract document text (PDF, Word, etc.)
3. **Classify & Extract** — Use Claude AI to identify document type and extract structured data
4. **Match Rules** — Apply business logic to determine appropriate actions
5. **Execute** — Programmatically perform OTCS operations (workflows, holds, sharing, searches)
6. **Log** — Track all operations with token usage and cost tracking

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Polling Loop (configurable interval)          │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Document Detection (watch folders)             │
│  • Check for new items since last poll          │
│  • Skip already processed items                 │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Document Processing                            │
│  • Download content (via otcs_download_content) │
│  • Extract text (PDF, Word, HTML, etc.)         │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  AI Classification & Extraction                 │
│  • LLM analyzes document content                │
│  • Extracts fields per rule definitions         │
│  • Returns structured JSON                      │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Rule Matching Engine                           │
│  • Compare extracted data to rule match criteria│
│  • Select first matching rule                   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Action Execution                               │
│  • Programmatic: smart_search, ensure_hold,     │
│    apply_hold, share, start_workflow            │
│  • Agentic: Full Claude loop with OTCS tools    │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Logging & Telemetry                            │
│  • JSON logs per document                       │
│  • Token usage and cost tracking                │
│  • Session-level cumulative stats               │
└─────────────────────────────────────────────────┘
```

## Key Features

### 🤖 Autonomous Processing
- Continuous folder monitoring with configurable poll intervals
- Stateful tracking prevents duplicate processing
- Graceful error handling and recovery

### 🧠 AI-Powered Classification
- Uses Claude Sonnet 4.5 for document understanding
- Extracts structured data from unstructured documents
- Dynamic field extraction based on rule definitions

### ⚙️ Rule-Based Workflows
- Declarative JSON configuration
- Pattern matching on extracted fields
- Chained action execution (search → hold → share → workflow)

### 📊 Cost Optimization
- Efficient text extraction (free)
- Single classification call per document (~$0.01)
- Prompt caching for repeated system instructions
- Detailed token usage tracking

### 🔧 Programmatic Actions
Built-in actions execute without additional LLM calls:
- `smart_search` — Multi-query search with keyword filtering
- `ensure_hold` — Create or find legal/administrative holds
- `apply_hold` — Place documents on hold
- `share` — External sharing via Core Share
- `start_workflow` — Initiate workflow processes

### 🎯 Agentic Fallback
When simple actions aren't enough, the agent can invoke a full Claude agentic loop with access to 15+ OTCS tools for complex operations.

## Configuration

Edit `agent/agent-config.json`:

```json
{
  "enabled": true,
  "pollIntervalMs": 30000,
  "maxAgentRounds": 15,
  "model": "claude-sonnet-4-5-20250929",
  "watchFolders": [181144, 180922],
  "tools": [
    "otcs_search",
    "otcs_download_content",
    "otcs_get_node",
    "otcs_browse",
    "otcs_node_action",
    "otcs_rm_holds",
    "otcs_share",
    "otcs_categories",
    "otcs_start_workflow",
    "otcs_workflow_task",
    "otcs_workflow_form",
    "otcs_get_assignments",
    "otcs_workflow_tasks"
  ],
  "systemPrompt": "You are an autonomous document processing agent for OpenText Content Server.",
  "rules": [
    {
      "name": "Contract approval workflow",
      "match": {},
      "extractFields": {
        "contractType": "type or category of contract",
        "counterparty": "primary external party name",
        "contractValue": "total contract value",
        "riskLevel": "risk assessment (Low/Medium/High/Critical)"
      },
      "instructions": "Analyze contract, extract key terms, assess risk, start approval workflow",
      "actions": [
        {
          "type": "start_workflow",
          "workflowId": 181308,
          "attachDocument": true
        }
      ]
    }
  ]
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Master on/off switch |
| `pollIntervalMs` | number | Time between folder checks (ms) |
| `maxAgentRounds` | number | Max LLM iterations for agentic mode |
| `model` | string | Claude model identifier |
| `watchFolders` | number[] | OTCS folder IDs to monitor |
| `tools` | string[] | Available OTCS tools for agentic mode |
| `systemPrompt` | string | Base instructions for the agent |
| `rules` | Rule[] | Processing rules (see below) |

## Rule Definition

Each rule defines how to process a specific document type:

```typescript
{
  "name": "Human-readable rule name",
  "match": {
    "extractedField": "required value"
  },
  "extractFields": {
    "fieldName": "description of what to extract",
    "anotherField": "another extraction instruction"
  },
  "instructions": "Optional: detailed instructions for agentic processing",
  "actions": [
    {
      "type": "smart_search",
      "queriesField": "searchQueries",
      "filterField": "filterKeywords",
      "filter": "documents",
      "exclude": ["unwanted", "terms"]
    },
    {
      "type": "ensure_hold",
      "name": "{{caseName}} - {{caseNumber}}",
      "holdType": "Legal",
      "comment": "Hold for case {{caseNumber}}"
    },
    {
      "type": "apply_hold"
    },
    {
      "type": "share",
      "email": "external@partner.com",
      "perm": 1,
      "message": "Documents for {{caseName}}"
    }
  ]
}
```

### Action Types

| Action | Description | Cost |
|--------|-------------|------|
| `smart_search` | Multi-query search with keyword filtering | Free |
| `ensure_hold` | Create or find RM hold | Free |
| `apply_hold` | Apply hold to search results | Free |
| `share` | Share via Core Share | Free |
| `start_workflow` | Initiate workflow map | Free |
| `agentic` | Full Claude loop with tools | ~$0.05-0.20 |

### Template Variables

Actions support `{{variable}}` substitution from extracted fields:
- `{{caseName}}` → Extracted case name
- `{{caseNumber}}` → Extracted case number
- `{{employeeName}}` → Extracted employee name

## Use Cases

### Legal Discovery & Subpoena Response
```json
{
  "name": "Subpoena response workflow",
  "match": { "documentType": "subpoena" },
  "extractFields": {
    "employeeName": "full name of person whose records are requested",
    "caseNumber": "court case number",
    "searchQueries": "JSON array of LQL queries to find documents",
    "filterKeywords": "JSON array of keywords to filter results"
  },
  "actions": [
    { "type": "smart_search", "queriesField": "searchQueries", "filterField": "filterKeywords" },
    { "type": "ensure_hold", "name": "{{caseName}}", "holdType": "Legal" },
    { "type": "apply_hold" },
    { "type": "share", "email": "legal@firm.com", "perm": 1 }
  ]
}
```

**Automation value:** Transforms a 3-5 day manual process into a 2-minute automated flow.

### Contract Risk Assessment
```json
{
  "name": "Contract approval workflow",
  "match": {},
  "extractFields": {
    "contractType": "type of contract",
    "counterparty": "vendor name",
    "contractValue": "total value",
    "riskLevel": "Low/Medium/High/Critical"
  },
  "instructions": "Download contract, extract terms, assess risk, complete first workflow task with analysis",
  "actions": [
    { "type": "agentic" }
  ]
}
```

**Automation value:** Pre-analyzes every contract before human review, flagging high-risk terms automatically.

### Invoice Processing
```json
{
  "name": "AP invoice automation",
  "match": { "documentType": "invoice" },
  "extractFields": {
    "vendorName": "vendor name",
    "invoiceNumber": "invoice number",
    "amount": "total amount",
    "poNumber": "PO number if present"
  },
  "actions": [
    { "type": "start_workflow", "workflowId": 12345 }
  ]
}
```

**Automation value:** Routes invoices automatically, eliminating manual classification work.

## Installation & Setup

### Prerequisites
- Node.js 20+
- OpenText Content Server with REST API
- Anthropic API key

### Environment Variables

Create `.env` in project root:

```bash
OTCS_BASE_URL=https://your-server/otcs/cs.exe/api
OTCS_USERNAME=admin
OTCS_PASSWORD=password
ANTHROPIC_API_KEY=sk-ant-...
```

### Running the Agent

```bash
# Development mode (auto-reload on changes)
npm run agent:dev

# Production mode
npm run agent
```

The agent will:
1. Load configuration from `agent/agent-config.json`
2. Authenticate with OTCS
3. Start polling configured folders
4. Log all activity to `agent/logs/`

## Logging

The agent writes JSON logs to `agent/logs/`:

```
agent/logs/
├── .last-poll               # Last poll timestamp (for recovery)
├── 2024-02-04-session.json  # Session summary
└── 2024-02-04-123456.json   # Per-document logs
```

### Session Log Structure
```json
{
  "sessionStart": "2024-02-04T20:00:00.000Z",
  "sessionEnd": "2024-02-04T20:30:00.000Z",
  "documentsProcessed": 12,
  "totalTokens": {
    "input": 50000,
    "output": 8000,
    "cacheRead": 120000,
    "cacheWrite": 10000
  },
  "totalCost": 0.85,
  "costPerDocument": 0.07
}
```

### Document Log Structure
```json
{
  "timestamp": "2024-02-04T20:05:00.000Z",
  "nodeId": 181234,
  "nodeName": "Contract_ABC_Corp_2024.pdf",
  "ruleName": "Contract approval workflow",
  "extracted": {
    "contractType": "Service Agreement",
    "counterparty": "ABC Corporation",
    "contractValue": "$250,000"
  },
  "actions": ["start_workflow"],
  "status": "success",
  "usage": {
    "inputTokens": 4200,
    "outputTokens": 680,
    "cacheReadTokens": 8500,
    "cost": 0.06
  }
}
```

## Cost Analysis

### Per-Document Economics

**Typical document processing:**
- Text extraction: $0.00 (free)
- Classification & extraction: ~$0.01-0.03
- Programmatic actions: $0.00 (free)
- **Total: ~$0.01-0.03 per document**

**Complex agentic processing:**
- Text extraction: $0.00
- Classification: ~$0.01
- Agentic loop (5-10 rounds): ~$0.05-0.20
- **Total: ~$0.06-0.21 per document**

### Optimization Features
- **Prompt caching:** 90% token cost reduction for repeated system instructions
- **Lazy agentic mode:** Only invokes full agent loop when programmatic actions aren't sufficient
- **Efficient extraction:** Single LLM call extracts all fields at once

### Volume Projections

| Volume | Simple Processing | Complex Processing |
|--------|------------------|-------------------|
| 100 docs/day | $1-3/day | $6-21/day |
| 1,000 docs/day | $10-30/day | $60-210/day |
| 10,000 docs/day | $100-300/day | $600-2,100/day |

## Architecture Components

### Core Modules

| File | Purpose |
|------|---------|
| `poller.ts` | Main entry point, polling loop, state management |
| `workflows.ts` | Document processing pipeline, rule matching, action execution |
| `agent-loop.ts` | Agentic mode implementation (Claude with tools) |
| `config.ts` | Configuration loading and validation |
| `logger.ts` | Structured logging and cost tracking |
| `bridge.ts` | OTCS tool implementations |
| `agent-config.json` | Rule definitions and agent configuration |

### State Management

The agent maintains state in two ways:

1. **In-memory:** `processedIds` Set tracks documents processed in current session
2. **Persistent:** `.last-poll` file stores last poll timestamp for recovery after restart

This ensures:
- No duplicate processing within a session
- Recovery from crashes without reprocessing
- Clean slate on intentional restart

## Development

### Testing Rules

```bash
# Edit agent-config.json to add/modify rules
nano agent/agent-config.json

# Run in dev mode to test
npm run agent:dev

# Upload test document to watched folder via OTCS web UI
# Watch console output for classification and extraction
```

### Debugging

Set `DEBUG=1` for verbose logging:

```bash
DEBUG=1 npm run agent
```

### Adding Custom Actions

Extend `workflows.ts` to add new programmatic actions:

```typescript
async function executeCustomAction(
  client: OTCSClient,
  action: CustomAction,
  extracted: Record<string, any>,
  searchResults: number[]
): Promise<void> {
  // Your custom OTCS operation
}
```

## Production Deployment

### Systemd Service (Linux)

```ini
[Unit]
Description=Altius Autonomous Agent
After=network.target

[Service]
Type=simple
User=otcs
WorkingDirectory=/opt/altius/otcs-mcp
Environment="NODE_ENV=production"
EnvironmentFile=/opt/altius/.env
ExecStart=/usr/bin/npm run agent
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "run", "agent"]
```

### Monitoring

Monitor agent health:
- Check `.last-poll` timestamp (should update every poll interval)
- Monitor log directory size
- Track session cost trends
- Alert on processing failures

## Security Considerations

- Store credentials in `.env`, never in `agent-config.json`
- Limit watched folders to specific locations
- Use least-privilege OTCS accounts
- Encrypt logs if they contain sensitive extracted data
- Rotate Anthropic API keys regularly

## Roadmap

- [ ] Multi-tenant support (separate configs per customer)
- [ ] Webhook triggers (process on demand vs polling)
- [ ] Enhanced retry logic with exponential backoff
- [ ] Approval workflows for high-risk actions
- [ ] Real-time dashboard for monitoring
- [ ] Integration with external systems (Salesforce, ServiceNow)

## Related Components

- **MCP Server** (`/`) — 41 OTCS tools for Claude Desktop, Cursor, and other MCP clients
- **Web UI** (`/web`) — Conversational AI interface for OTCS management

---

Built with Claude Sonnet 4.5 and OpenText Content Server REST APIs.
