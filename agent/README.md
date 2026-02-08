# Altius Autonomous Agent

**Background service for intelligent document processing in OpenText Content Server**

The Altius Autonomous Agent continuously monitors OTCS folders, classifies documents using Claude AI, and executes rule-based workflows without human intervention. It processes documents at approximately $0.01-0.03 per document, transforming manual processes that take days into automated workflows that complete in minutes.

## What Is This?

The Altius Agent is a background service that:

1. Monitors designated OTCS folders at configurable intervals
2. Detects new documents by tracking processed IDs
3. Classifies documents and extracts structured metadata using Claude Sonnet 4.5
4. Matches classification results against declarative rules
5. Executes programmatic actions (search, legal hold, sharing, workflows) without additional LLM calls
6. Falls back to full agentic mode (Claude with 15+ OTCS tools) for complex operations
7. Logs all activity with detailed token usage and cost tracking

Entry point: `poller.ts`

## How It Works

```
Poll OTCS Folders (configurable interval)
    |
    v
Detect New Documents (track processed IDs)
    |
    v
Download & Extract Text (free)
    |
    v
AI Classification (Claude Sonnet 4.5, single call)
    Extract: document type, parties, dates, key terms, risk indicators
    |
    v
Match Rules (declarative JSON in agent-config.json)
    Compare extracted fields to rule conditions
    |
    v
Execute Actions (programmatic, no LLM calls)
    - smart_search: Find related documents
    - ensure_hold: Create legal hold if not exists
    - apply_hold: Place documents on hold
    - share: Share with specified users
    - start_workflow: Initiate workflow from map
    |
    v
Agentic Fallback (if needed)
    Full Claude tool-use loop with 15+ OTCS tools
    |
    v
Log Results (structured JSON)
    Per-document logs: classification, actions, token usage, cost
    Session logs: cumulative stats, cost per document
```

## Key Features

**Autonomous Operation**
- Continuous polling with configurable intervals (default: 30 seconds)
- Stateful tracking prevents duplicate processing within sessions
- Persistent `.last-poll` file enables recovery after restarts
- Graceful error handling and recovery

**AI-Powered Classification**
- Uses Claude Sonnet 4.5 for document understanding
- Single classification call extracts all required fields at once
- Dynamic field extraction based on rule definitions
- Structured JSON output for reliable parsing

**Rule-Based Workflows**
- Declarative JSON configuration in `agent-config.json`
- Rules define: match conditions, fields to extract, actions to execute
- Template variable substitution in actions (`{{caseName}}`, `{{amount}}`)
- First matching rule wins

**Cost Optimization**
- Text extraction is free (no LLM calls)
- Single classification call per document (~$0.01-0.03)
- Prompt caching reduces system prompt costs by 90%
- Programmatic actions execute without additional LLM calls
- Agentic mode only invoked when explicitly configured

**Programmatic Actions**
- `smart_search`: Multi-query search with keyword filtering
- `ensure_hold`: Create or find existing RM hold by name and type
- `apply_hold`: Apply hold to search results or current document
- `share`: External sharing via Core Share with permissions
- `start_workflow`: Initiate workflow map and optionally attach document

**Agentic Fallback**
- Full Claude tool-use loop with access to 15+ OTCS tools
- Max rounds configurable (default: 15)
- Tools include: search, download, browse, categories, workflows, RM holds, sharing
- Used for complex operations requiring multi-step reasoning

**Structured Logging**
- Per-document JSON logs in `agent/logs/`
- Session summary logs with cumulative token usage and costs
- Tracks: classification results, matched rules, actions executed, errors
- Cost tracking: input/output tokens, cache reads/writes, total cost per document

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
      "name": "Legal discovery automation",
      "match": { "documentType": "subpoena" },
      "extractFields": {
        "employeeName": "full name of person whose records are requested",
        "caseName": "case name or matter description",
        "caseNumber": "court case number",
        "searchQueries": "JSON array of LQL queries to find related documents",
        "filterKeywords": "JSON array of keywords to filter search results"
      },
      "actions": [
        {
          "type": "smart_search",
          "queriesField": "searchQueries",
          "filterField": "filterKeywords",
          "filter": "documents",
          "exclude": ["draft", "template"]
        },
        {
          "type": "ensure_hold",
          "name": "{{caseName}} - {{caseNumber}}",
          "holdType": "Legal",
          "comment": "Legal hold for case {{caseNumber}}"
        },
        {
          "type": "apply_hold"
        },
        {
          "type": "share",
          "email": "legal@firm.com",
          "perm": 1,
          "message": "Documents for {{caseName}}"
        }
      ]
    }
  ]
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Master on/off switch for the agent |
| `pollIntervalMs` | number | Milliseconds between folder checks (default: 30000) |
| `maxAgentRounds` | number | Max LLM iterations for agentic mode (default: 15) |
| `model` | string | Claude model ID (default: claude-sonnet-4-5-20250929) |
| `watchFolders` | number[] | OTCS folder node IDs to monitor for new documents |
| `tools` | string[] | Available OTCS tools for agentic mode |
| `systemPrompt` | string | Base system instructions for the agent |
| `rules` | Rule[] | Processing rules (see Rule System section) |

## Running the Agent

### Prerequisites
- Node.js 20+
- OpenText Content Server with REST API access
- Anthropic API key

### Environment Variables

Create `.env` in project root:

```bash
OTCS_BASE_URL=https://your-server.com/otcs/cs.exe/api
OTCS_USERNAME=admin
OTCS_PASSWORD=your-password
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Start the Agent

```bash
# Development mode (auto-reload on changes)
npm run agent:dev

# Production mode
npm run agent
```

The agent will:
1. Load configuration from `agent/agent-config.json`
2. Authenticate with OTCS using credentials from `.env`
3. Begin polling configured folders
4. Process new documents as they appear
5. Write logs to `agent/logs/`

## Rule System

Rules are declarative JSON objects that define how to process documents. Each rule consists of:

1. **match**: Conditions that must be met for the rule to apply
2. **extractFields**: Fields to extract from the document using Claude
3. **instructions**: Optional detailed instructions for agentic processing
4. **actions**: Sequence of actions to execute if rule matches

### Rule Structure

```json
{
  "name": "Human-readable rule name",
  "match": {
    "fieldName": "required value",
    "anotherField": "another required value"
  },
  "extractFields": {
    "fieldToExtract": "description of what to extract",
    "anotherField": "another extraction instruction"
  },
  "instructions": "Optional: detailed instructions for agentic mode processing",
  "actions": [
    {
      "type": "action_name",
      "param1": "value",
      "param2": "{{templateVariable}}"
    }
  ]
}
```

### Match Conditions

Rules are evaluated in order. The first rule whose `match` object is satisfied is selected.

- Empty `match` object: Always matches (catch-all rule)
- Non-empty `match`: All specified fields must equal extracted values

### Field Extraction

The `extractFields` object defines what data to extract from the document:

```json
"extractFields": {
  "documentType": "type or category of document (invoice, contract, subpoena, etc.)",
  "vendorName": "name of vendor or supplier",
  "amount": "total amount as currency string",
  "riskLevel": "risk assessment: Low, Medium, High, or Critical"
}
```

Claude extracts these fields in a single call. Extraction cost: ~$0.01-0.03 per document.

### Template Variables

Actions support `{{variable}}` substitution from extracted fields:

```json
{
  "type": "ensure_hold",
  "name": "{{caseName}} - {{caseNumber}}",
  "comment": "Legal hold created for {{employeeName}}"
}
```

At runtime, `{{caseName}}` is replaced with the extracted case name value.

### Example Rules

**Contract Risk Assessment**
```json
{
  "name": "Contract approval workflow",
  "match": {},
  "extractFields": {
    "contractType": "type or category of contract",
    "counterparty": "primary external party name",
    "contractValue": "total contract value as currency string",
    "riskLevel": "risk assessment: Low, Medium, High, or Critical",
    "keyTerms": "critical terms, indemnification, liability limits"
  },
  "instructions": "Download contract, analyze key terms, assess risk level, complete first workflow task with detailed analysis",
  "actions": [
    {
      "type": "start_workflow",
      "workflowId": 181308,
      "attachDocument": true
    }
  ]
}
```

**Invoice Processing**
```json
{
  "name": "AP invoice automation",
  "match": { "documentType": "invoice" },
  "extractFields": {
    "vendorName": "vendor or supplier name",
    "invoiceNumber": "invoice number",
    "amount": "total amount",
    "poNumber": "purchase order number if present",
    "dueDate": "payment due date"
  },
  "actions": [
    {
      "type": "start_workflow",
      "workflowId": 12345,
      "attachDocument": true
    }
  ]
}
```

## Actions Reference

| Action | Description | Parameters | Cost |
|--------|-------------|------------|------|
| `smart_search` | Multi-query search with keyword filtering | `queriesField`, `filterField`, `filter`, `exclude` | Free |
| `ensure_hold` | Create RM hold if it doesn't exist, or find existing | `name`, `holdType`, `comment` | Free |
| `apply_hold` | Apply hold to search results or current document | None (uses hold from ensure_hold) | Free |
| `share` | External sharing via Core Share | `email`, `perm`, `message` | Free |
| `start_workflow` | Initiate workflow map | `workflowId`, `attachDocument` | Free |
| `agentic` | Full Claude tool-use loop | None (uses rule instructions) | ~$0.05-0.20 |

### smart_search

Executes multiple LQL search queries and filters results by keywords.

**Parameters:**
- `queriesField` (string): Name of extracted field containing JSON array of LQL queries
- `filterField` (string): Name of extracted field containing JSON array of filter keywords
- `filter` (string): Result type filter ("documents", "folders", etc.)
- `exclude` (array): Keywords to exclude from results

**Example:**
```json
{
  "type": "smart_search",
  "queriesField": "searchQueries",
  "filterField": "filterKeywords",
  "filter": "documents",
  "exclude": ["draft", "template"]
}
```

### ensure_hold

Creates a new RM hold or finds an existing hold by name and type.

**Parameters:**
- `name` (string): Hold name (supports template variables)
- `holdType` (string): "Legal" or "Administrative"
- `comment` (string): Hold description (supports template variables)

**Example:**
```json
{
  "type": "ensure_hold",
  "name": "{{caseName}} - {{caseNumber}}",
  "holdType": "Legal",
  "comment": "Legal hold for case {{caseNumber}} involving {{employeeName}}"
}
```

### apply_hold

Applies the hold created/found by `ensure_hold` to search results or current document.

**Parameters:** None (uses hold ID from preceding `ensure_hold` action)

**Example:**
```json
{
  "type": "apply_hold"
}
```

### share

Shares search results or current document externally via Core Share.

**Parameters:**
- `email` (string): External recipient email
- `perm` (number): Permission level (0=None, 1=Read, 2=Write, 3=Full)
- `message` (string): Share message (supports template variables)

**Example:**
```json
{
  "type": "share",
  "email": "external@partner.com",
  "perm": 1,
  "message": "Shared documents for {{caseName}}"
}
```

### start_workflow

Initiates a workflow map, optionally attaching search results or current document.

**Parameters:**
- `workflowId` (number): Workflow map node ID
- `attachDocument` (boolean): Whether to attach document to workflow

**Example:**
```json
{
  "type": "start_workflow",
  "workflowId": 181308,
  "attachDocument": true
}
```

### agentic

Invokes full Claude agentic loop with access to all configured OTCS tools. Uses rule `instructions` as task description.

**Parameters:** None (uses rule's `instructions` field)

**Example:**
```json
{
  "type": "agentic"
}
```

Rule must include detailed instructions:
```json
{
  "instructions": "Download the contract, extract all key terms and parties, assess risk level based on indemnification clauses and liability limits, then complete the first workflow task with a detailed analysis",
  "actions": [
    { "type": "agentic" }
  ]
}
```

## Use Cases

### Legal Discovery and Subpoena Response

**Problem:** Legal team receives subpoena requesting employee communications. Manual process involves:
1. Reading subpoena to identify employee and date range
2. Crafting search queries to find relevant documents
3. Creating legal hold in RM module
4. Running searches and reviewing results
5. Applying hold to relevant documents
6. Sharing results with outside counsel

**Time:** 3-5 days of manual work

**Solution:** Agent automates entire workflow in ~2 minutes:

```json
{
  "name": "Subpoena response workflow",
  "match": { "documentType": "subpoena" },
  "extractFields": {
    "employeeName": "full name of person whose records are requested",
    "caseName": "case name or matter description",
    "caseNumber": "court case number",
    "dateRangeStart": "start date for document search",
    "dateRangeEnd": "end date for document search",
    "searchQueries": "JSON array of LQL queries to find documents (search by employee name, date range, keywords)",
    "filterKeywords": "JSON array of keywords to filter and rank search results by relevance"
  },
  "actions": [
    {
      "type": "smart_search",
      "queriesField": "searchQueries",
      "filterField": "filterKeywords",
      "filter": "documents",
      "exclude": ["draft", "template", "personal"]
    },
    {
      "type": "ensure_hold",
      "name": "{{caseName}} - {{caseNumber}}",
      "holdType": "Legal",
      "comment": "Legal hold for case {{caseNumber}} involving {{employeeName}}"
    },
    {
      "type": "apply_hold"
    },
    {
      "type": "share",
      "email": "legal@outsidecounsel.com",
      "perm": 1,
      "message": "Documents responsive to subpoena in {{caseName}} (case {{caseNumber}})"
    }
  ]
}
```

**ROI:** 3-5 days reduced to 2 minutes. Cost: ~$0.02 per subpoena.

### Contract Risk Assessment

**Problem:** Every contract requires legal review before approval. Contracts vary in complexity and risk. Manual process:
1. Contract uploaded to repository
2. Legal team manually reviews each contract
3. Identifies high-risk terms (indemnification, liability caps, termination)
4. Routes to appropriate approver based on risk and value

**Time:** 2-3 hours per contract

**Solution:** Agent pre-analyzes contracts and routes automatically:

```json
{
  "name": "Contract approval workflow",
  "match": {},
  "extractFields": {
    "contractType": "type or category of contract",
    "counterparty": "primary external party name",
    "contractValue": "total contract value as currency string",
    "riskLevel": "risk assessment based on terms: Low, Medium, High, or Critical",
    "keyTerms": "critical terms: indemnification, liability limits, IP ownership, termination conditions"
  },
  "instructions": "Download the contract PDF, thoroughly analyze all key terms and clauses, assess risk level based on indemnification provisions and liability limits, extract counterparty information and contract value, then complete the first workflow approval task with a detailed risk analysis summary",
  "actions": [
    {
      "type": "start_workflow",
      "workflowId": 181308,
      "attachDocument": true
    }
  ]
}
```

**ROI:** Flags high-risk contracts immediately for prioritized review. Legal team reviews agent's analysis instead of reading from scratch. Cost: ~$0.15-0.20 per contract (agentic mode).

### Invoice Processing

**Problem:** AP team manually reviews and routes hundreds of invoices daily:
1. Invoice arrives via email or upload
2. AP staff opens invoice, identifies vendor
3. Extracts invoice number, amount, PO number
4. Manually routes to approval workflow

**Time:** 5-10 minutes per invoice

**Solution:** Agent extracts data and routes automatically:

```json
{
  "name": "AP invoice automation",
  "match": { "documentType": "invoice" },
  "extractFields": {
    "vendorName": "vendor or supplier name",
    "invoiceNumber": "invoice number",
    "amount": "total amount as currency string",
    "poNumber": "purchase order number if present",
    "dueDate": "payment due date"
  },
  "actions": [
    {
      "type": "start_workflow",
      "workflowId": 12345,
      "attachDocument": true
    }
  ]
}
```

**ROI:** 100 invoices/day at 5 minutes each = 8.3 hours saved daily. Cost: ~$0.02 per invoice.

## Cost Analysis

### Per-Document Economics

**Simple processing (programmatic actions only):**
- Text extraction: $0.00 (free, no LLM)
- Classification and extraction: $0.01-0.03 (single Claude call)
- Programmatic actions (search, hold, share, workflow): $0.00 (free, no LLM)
- **Total: $0.01-0.03 per document**

**Complex processing (agentic mode):**
- Text extraction: $0.00 (free)
- Classification and extraction: $0.01-0.03
- Agentic loop (5-10 tool-use rounds): $0.05-0.20
- **Total: $0.06-0.21 per document**

### Token Usage Breakdown

**Typical simple document:**
- Input tokens: 3,000-5,000 (document text + system prompt)
- Output tokens: 500-1,000 (extracted JSON)
- Cache read tokens: 8,000-12,000 (cached system prompt, 90% cost reduction)
- Cache write tokens: 10,000 (first request only)
- **Cost: ~$0.015**

**Typical complex document (agentic):**
- Input tokens: 25,000-40,000 (multiple tool-use rounds)
- Output tokens: 3,000-6,000 (tool calls + reasoning)
- Cache read tokens: 80,000-120,000 (cached across rounds)
- **Cost: ~$0.15**

### Optimization Features

1. **Prompt caching:** System prompt cached across all documents in session (90% cost reduction)
2. **Single classification call:** All fields extracted in one Claude call
3. **Lazy agentic mode:** Only invoked when rule explicitly specifies `"type": "agentic"`
4. **Free actions:** Search, hold, share, workflow operations execute without LLM calls

### Volume Projections

| Daily Volume | Simple Docs | Complex Docs | Monthly Cost (Simple) | Monthly Cost (Complex) |
|--------------|-------------|--------------|----------------------|------------------------|
| 100 docs/day | $1-3/day | $6-21/day | $30-90/month | $180-630/month |
| 1,000 docs/day | $10-30/day | $60-210/day | $300-900/month | $1,800-6,300/month |
| 10,000 docs/day | $100-300/day | $600-2,100/day | $3,000-9,000/month | $18,000-63,000/month |

Most deployments use 80-90% simple processing, 10-20% complex processing.

## Logging

The agent writes structured JSON logs to `agent/logs/`:

```
agent/logs/
├── .last-poll                    # Last poll timestamp (for recovery)
├── 2026-02-07-session.json       # Session summary
├── 2026-02-07-123456.json        # Per-document log (node ID)
└── 2026-02-07-123457.json        # Another document
```

### Session Log Structure

```json
{
  "sessionStart": "2026-02-07T20:00:00.000Z",
  "sessionEnd": "2026-02-07T20:30:00.000Z",
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
  "timestamp": "2026-02-07T20:05:32.123Z",
  "nodeId": 181234,
  "nodeName": "Subpoena_Smith_vs_Jones.pdf",
  "ruleName": "Subpoena response workflow",
  "extracted": {
    "employeeName": "John Smith",
    "caseName": "Smith vs. Jones",
    "caseNumber": "CV-2026-00123",
    "searchQueries": ["OTEmailRecipients:\"john.smith@company.com\""],
    "filterKeywords": ["project", "alpha", "beta"]
  },
  "actions": ["smart_search", "ensure_hold", "apply_hold", "share"],
  "searchResults": 47,
  "holdId": 181500,
  "status": "success",
  "usage": {
    "inputTokens": 4200,
    "outputTokens": 680,
    "cacheReadTokens": 8500,
    "cacheWriteTokens": 0,
    "cost": 0.062
  }
}
```

Logs track:
- Classification results (extracted fields)
- Matched rule name
- Actions executed
- Action results (search result counts, hold IDs, share URLs)
- Token usage breakdown
- Cost per document
- Success/failure status
- Error details if failed

## Architecture

### Project Structure

```
agent/
├── agent-config.json     # Rule definitions and agent configuration
├── agent-loop.ts         # Agentic mode implementation (Claude tool-use loop)
├── bridge.ts             # OTCS tool implementations for agentic mode
├── config.ts             # Configuration loading and validation
├── logger.ts             # Structured logging and cost tracking
├── logs/                 # JSON logs (per-document and per-session)
│   └── .last-poll        # Last poll timestamp for recovery
├── poller.ts             # Main entry point: polling loop and state management
├── workflows.ts          # Document processing pipeline and action execution
├── README.md             # This file
└── tsconfig.json         # TypeScript configuration
```

### Core Modules

**poller.ts**
- Entry point for the agent
- Implements polling loop with configurable interval
- Maintains in-memory `processedIds` Set to prevent duplicate processing
- Writes `.last-poll` timestamp file for crash recovery
- Authenticates with OTCS on startup
- Invokes `workflows.ts` for each new document

**workflows.ts**
- Document processing pipeline
- Downloads document content and extracts text
- Calls Claude for classification and field extraction
- Matches extracted data against rules
- Executes programmatic actions (search, hold, share, workflow)
- Invokes `agent-loop.ts` for agentic actions
- Returns processing results for logging

**agent-loop.ts**
- Implements full Claude agentic mode
- Converts OTCS tools to Anthropic SDK format
- Manages multi-turn tool-use loop (max rounds configurable)
- Executes tool calls via `bridge.ts`
- Returns when task completes or max rounds reached

**bridge.ts**
- OTCS tool implementations for agentic mode
- Wraps `@otcs/core` OTCSClient methods
- Provides 15+ tools: search, download, browse, categories, workflows, RM, sharing
- Returns tool results in format expected by Claude

**config.ts**
- Loads and validates `agent-config.json`
- Provides typed configuration object
- Validates required fields and types

**logger.ts**
- Structured JSON logging
- Per-document logs with classification, actions, token usage
- Session summary logs with cumulative stats
- Cost tracking using Anthropic pricing

### Dependencies

The agent imports from `@otcs/core` package:
- `OTCSClient`: OTCS REST API client with authentication and session management
- `handleToolCall`: Shared tool execution layer
- Type definitions: `OTCSConfig`, `ToolCallRequest`, etc.

This eliminates code duplication between agent, MCP server, and web UI.

### State Management

**In-memory state (lost on restart):**
- `processedIds` Set tracks documents processed in current session
- Prevents duplicate processing within a session
- Cleared on intentional restart

**Persistent state (survives restart):**
- `.last-poll` file stores last successful poll timestamp
- Enables crash recovery without reprocessing old documents
- Deleted on intentional restart to reprocess all documents

This design ensures:
- No duplicate processing within sessions
- Graceful recovery from crashes
- Ability to force reprocessing by deleting `.last-poll`

## Production Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/altius-agent.service`:

```ini
[Unit]
Description=Altius Autonomous Agent
After=network.target postgresql.service

[Service]
Type=simple
User=otcs
Group=otcs
WorkingDirectory=/opt/altius/otcs-mcp
Environment="NODE_ENV=production"
EnvironmentFile=/opt/altius/.env
ExecStart=/usr/bin/npm run agent
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable altius-agent
sudo systemctl start altius-agent
sudo systemctl status altius-agent
```

View logs:
```bash
journalctl -u altius-agent -f
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Run agent
CMD ["npm", "run", "agent"]
```

Docker Compose:
```yaml
services:
  agent:
    build: .
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./agent/logs:/app/agent/logs
      - ./agent/agent-config.json:/app/agent/agent-config.json
    restart: unless-stopped
```

### Monitoring

**Health checks:**
- Monitor `.last-poll` timestamp (should update every poll interval)
- Alert if timestamp is stale (indicates crashed agent)

**Cost tracking:**
- Review session logs for cost trends
- Alert if cost per document exceeds threshold
- Track monthly spend projections

**Processing metrics:**
- Documents processed per session
- Success vs. failure rate
- Average processing time per document

**Log management:**
- Rotate logs daily or weekly
- Archive old logs to cold storage
- Monitor log directory disk usage

### Security Considerations

**Credentials:**
- Store all credentials in `.env`, never in `agent-config.json`
- Use environment variables for sensitive data
- Rotate Anthropic API keys regularly
- Use least-privilege OTCS accounts (minimum permissions needed)

**Access control:**
- Limit watched folders to authorized locations only
- Review extracted data for PII/PHI before logging
- Encrypt logs if they contain sensitive information

**Network security:**
- Use HTTPS for OTCS connections
- Enable TLS certificate validation (set `tlsSkipVerify: false`)
- Firewall agent server to limit outbound connections

## Development

### Testing Rules

```bash
# Edit agent configuration
nano agent/agent-config.json

# Add or modify a rule
# Run in dev mode
npm run agent:dev

# Upload test document to watched folder via OTCS web UI
# Watch console output for classification and extraction results
```

### Debugging

Enable verbose logging:
```bash
DEBUG=1 npm run agent
```

### Adding Custom Actions

Extend `workflows.ts` to add new programmatic actions:

```typescript
async function executeMyCustomAction(
  client: OTCSClient,
  action: MyCustomAction,
  extracted: Record<string, any>,
  searchResults: number[]
): Promise<void> {
  // Your custom OTCS operation using client methods
  // Example: await client.nodeAction(nodeId, 'copy', { parent_id: targetId })
}
```

Add action type to config schema in `config.ts` and update action executor in `workflows.ts`.

## Related Components

**MCP Server** (`/`)
- 41 OTCS tools for Claude Desktop, Cursor, and other MCP clients
- Enables conversational OTCS management in AI assistants
- Shares `@otcs/core` package with agent and web UI

**Web UI** (`/web`)
- Next.js conversational interface for OTCS
- Chat-based document management with AI orchestration
- Database-backed conversation history
- Shares `@otcs/core` package with agent and MCP server

**Core Package** (`/packages/core`)
- Shared OTCS client and tool layer (9,500 LOC)
- Used by all consumers: agent, MCP server, web UI
- Type-safe TypeScript ESM library
- Single source of truth for OTCS integration

---

Built with Claude Sonnet 4.5 and OpenText Content Server REST APIs.
