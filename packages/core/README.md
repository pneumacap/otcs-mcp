# @otcs/core

Shared foundation package for the Altius platform — a unified TypeScript library providing enterprise content management capabilities through the OpenText Content Server (OTCS) REST API.

This package serves as the single source of truth for OTCS integration, consumed by four products:
- **MCP Server**: Model Context Protocol server for AI agents
- **Web UI**: Next.js application with Anthropic Claude integration
- **Autonomous Agent**: Standalone AI agent for automated content operations
- **Migration Toolkit**: Content transfer and synchronization tools

## Architecture

The `@otcs/core` package implements a protocol-neutral design that separates concerns:

1. **Client Layer**: 155 methods across 17 domain modules for OTCS REST API operations
2. **Tool Layer**: 42 tool definitions in JSON Schema format, converted to MCP or Anthropic formats via adapters
3. **Type System**: 139 TypeScript exports across 9 domain files
4. **LLM Utilities**: Token cost computation for Claude models

This separation allows the same core logic to serve multiple consumers without protocol lock-in. Tool schemas are defined once and transformed at runtime for each target format.

## Installation

This is a workspace package, not published to npm. Add it to your `package.json`:

```json
{
  "dependencies": {
    "@otcs/core": "workspace:*"
  }
}
```

For Next.js consumers, enable source compilation in `next.config.ts`:

```typescript
const config = {
  transpilePackages: ['@otcs/core'],
};
```

For Node.js consumers (MCP server, agent), use `tsx` or another ESM-compatible runtime.

## Usage

### Creating an OTCS Client

```typescript
import { OTCSClient } from '@otcs/core';

const client = new OTCSClient({
  baseUrl: 'https://otcs.example.com/otcs/cs',
  username: 'admin',
  password: 'livelink',
  tlsSkipVerify: false, // Set true only for self-signed certs in dev
});

// Authenticate (returns ticket for subsequent requests)
const ticket = await client.authenticate();
```

### Using Tool Definitions

```typescript
import { TOOL_SCHEMAS, handleToolCall, toMCPTools, toAnthropicTools } from '@otcs/core';

// For MCP SDK
const mcpTools = toMCPTools();

// For Anthropic SDK
const anthropicTools = toAnthropicTools();

// Execute a tool
const result = await handleToolCall(client, 'otcs_search', {
  query: 'contract',
  filter_type: 'documents',
  limit: 10,
});
```

### Computing LLM Costs

```typescript
import { computeCost } from '@otcs/core';

const cost = computeCost(
  1000,  // input tokens
  500,   // output tokens
  200,   // cache read tokens
  100,   // cache write tokens
);

console.log(`Request cost: $${cost.toFixed(6)}`);
```

### Working with Types

```typescript
import type {
  OTCSNode,
  OTCSWorkspace,
  OTCSSearchResult,
  WorkflowInfo,
  CategorySet,
} from '@otcs/core';

function processNode(node: OTCSNode) {
  console.log(`${node.name} (ID: ${node.id}, Type: ${node.type_name})`);
}
```

## Directory Structure

```
packages/core/src/
├── index.ts                    Public API exports
├── client/                     OTCS REST API client (4,228 LOC)
│   ├── otcs-client.ts         Main facade (imports all augmentations)
│   ├── base.ts                Shared fetch, auth, error handling
│   ├── auth.ts                Authentication (3 methods)
│   ├── navigation.ts          Browse, get node (4 methods)
│   ├── nodes.ts               Node operations (5 methods)
│   ├── documents.ts           Upload, download, versions (5 methods)
│   ├── folders.ts             Create, list (3 methods)
│   ├── search.ts              Full-text, structured (2 methods)
│   ├── workflows.ts           Full lifecycle (16 methods)
│   ├── workspaces.ts          Business workspaces (15 methods)
│   ├── categories.ts          Metadata categories (5 methods)
│   ├── members.ts             Users and groups (6 methods)
│   ├── permissions.ts         ACLs and access control (8 methods)
│   ├── sharing.ts             Document sharing (4 methods)
│   ├── rm-classification.ts   Records classification (7 methods)
│   ├── rm-holds.ts            Legal/litigation holds (14 methods)
│   ├── rm-xref.ts             Cross-references (10 methods)
│   └── rm-rsi.ts              RSI operations (13 methods)
├── tools/                      Tool system (2,350 LOC)
│   ├── definitions.ts         42 protocol-neutral tool schemas
│   ├── handler.ts             Re-exports master dispatcher
│   ├── handlers/              11 domain-specific handlers
│   │   ├── index.ts           Master dispatcher
│   │   ├── navigation.ts
│   │   ├── documents.ts
│   │   ├── folders.ts
│   │   ├── node-ops.ts
│   │   ├── workflows.ts
│   │   ├── workspaces.ts
│   │   ├── categories.ts
│   │   ├── members.ts
│   │   ├── permissions.ts
│   │   ├── sharing.ts
│   │   └── rm.ts
│   ├── formats.ts             Adapters: toMCPTools, toAnthropicTools
│   ├── utils.ts               pickKeys, compactToolResult, getSuggestion
│   └── text-extract.ts        PDF, Word, CSV, XML, HTML extraction
├── llm/
│   └── cost.ts                Token cost computation (Claude pricing)
└── types/                      139 TypeScript exports
    ├── core.ts                Config, Node, Permissions, Pagination
    ├── categories.ts          CategorySet, CategoryAttribute
    ├── members.ts             User, Group
    ├── permissions.ts         ACL types
    ├── rm.ts                  Records management (RSI, holds, xref)
    ├── search.ts              SearchResult, SearchOptions
    ├── sharing.ts             ShareInfo
    ├── workflows.ts           WorkflowInfo, WorkflowMap, Assignment
    └── workspaces.ts          WorkspaceType, WorkspaceMetadata
```

## OTCSClient API

The client is organized into 17 domain modules, each augmenting the base `OTCSClient` class:

| Domain | Methods | Key Operations |
|--------|---------|----------------|
| **auth** | 3 | authenticate, logout, getSessionStatus |
| **navigation** | 4 | getNode, browse, getBrowseTreeNode, getNodeActions |
| **nodes** | 5 | createNode, deleteNode, updateNode, moveNode, copyNode |
| **documents** | 5 | uploadDocument, downloadDocument, getVersions, createVersion, deleteVersion |
| **folders** | 3 | createFolder, listFolderContents, getFolderMetadata |
| **search** | 2 | search, advancedSearch |
| **workflows** | 16 | listWorkflows, startWorkflow, getWorkflowInfo, listAssignments, completeTask, reassignTask |
| **workspaces** | 15 | createWorkspace, listWorkspaces, getWorkspaceMetadata, addWorkspaceMember, getWorkspaceRoles |
| **categories** | 5 | getCategoriesForNode, updateCategoryValues, listCategorySets, getCategoryDefinition |
| **members** | 6 | getUser, listUsers, listGroups, getGroupMembers, addGroupMember, removeGroupMember |
| **permissions** | 8 | getPermissions, setPermissions, addPermission, removePermission, getOwner, setOwner |
| **sharing** | 4 | shareNode, getShareInfo, updateShare, deleteShare |
| **rm-classification** | 7 | classifyNode, getClassificationSchedule, applyRetentionSchedule, declareRecord |
| **rm-holds** | 14 | createHold, listHolds, addToHold, removeFromHold, getHoldInfo, releaseHold |
| **rm-xref** | 10 | createXRef, listXRefs, deleteXRef, getXRefTypes, validateXRef |
| **rm-rsi** | 13 | createRSI, updateRSI, getRSI, listRSIs, validateRSI, submitRSI |

**Total**: 155 methods

All methods return typed responses based on the types defined in `packages/core/src/types/`.

## Tool System

### Protocol-Neutral Architecture

Tool schemas are defined once in JSON Schema format and transformed at runtime:

```typescript
// Definition (stored once)
{
  name: 'otcs_search',
  description: 'Search for documents...',
  schema: {
    type: 'object',
    properties: { query: { type: 'string' }, ... },
    required: ['query'],
  },
}

// MCP format (via toMCPTools)
{
  name: 'otcs_search',
  description: 'Search for documents...',
  inputSchema: { type: 'object', properties: {...}, required: [...] },
}

// Anthropic format (via toAnthropicTools)
{
  name: 'otcs_search',
  description: 'Search for documents...',
  input_schema: { type: 'object', properties: {...}, required: [...] },
  cache_control: { type: 'ephemeral' }, // Last tool only
}
```

### Tool Categories

The 42 tools are organized across 11 domains:

- **Navigation** (3): get_node, browse, browse_tree
- **Documents** (5): upload, download, get_versions, create_version, delete_version
- **Folders** (2): create_folder, list_folder_contents
- **Node Operations** (4): create_node, delete_nodes, move_page, update_node
- **Search** (1): search
- **Workflows** (6): list, start, get_info, get_assignments, manage, draft
- **Workspaces** (6): create, list, get_metadata, get_workspace, search, update_metadata
- **Categories** (3): get_categories, update_categories, list_category_sets
- **Members** (3): get_user, list_users, list_groups, get_group_membership
- **Permissions** (3): get_permissions, set_permissions, update_permissions
- **Sharing** (2): share, get_share_info
- **Records Management** (4): classify, get_classification, create_hold, list_holds

### Tool Execution

The `handleToolCall` function dispatches to domain-specific handlers:

```typescript
export async function handleToolCall(
  client: OTCSClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(client, args);
}
```

Each handler validates arguments, calls the appropriate client method, and formats the response.

## Type System

The type system is split into 9 domain files for maintainability:

### core.ts
- `OTCSConfig`: Client configuration
- `OTCSNode`: Universal node representation
- `OTCSPermissions`: Permission flags
- `PaginationOptions`, `PaginatedResponse`: Pagination helpers

### categories.ts
- `CategorySet`, `CategoryAttribute`: Metadata schemas
- `CategoryValue`: Attribute values

### members.ts
- `User`, `Group`: User and group entities
- `GroupMember`: Group membership

### permissions.ts
- `ACLEntry`, `PermissionSet`: Access control lists
- `OwnerInfo`: Ownership details

### rm.ts
- `RSISchedule`, `HoldInfo`, `XRefInfo`: Records management entities
- `ClassificationSchedule`: Retention schedules

### search.ts
- `SearchResult`, `SearchOptions`: Search request/response
- `SearchHighlight`: Match highlighting

### sharing.ts
- `ShareInfo`, `ShareOptions`: Document sharing

### workflows.ts
- `WorkflowInfo`, `WorkflowMap`, `Assignment`: Workflow state
- `WorkflowTask`, `WorkflowStatus`: Task management

### workspaces.ts
- `WorkspaceType`, `WorkspaceMetadata`: Workspace schemas
- `WorkspaceRole`, `WorkspaceMember`: Role-based access

**Total**: 139 exported types, interfaces, and constants

## Text Extraction

The `extractText` utility supports multiple document formats:

```typescript
import { extractText } from '@otcs/core';

const text = await extractText(buffer, 'application/pdf');
```

**Supported formats**:
- PDF (`.pdf`) — via pdf-parse
- Microsoft Word (`.docx`) — via mammoth
- CSV (`.csv`) — structured table extraction
- JSON (`.json`) — pretty-printed
- XML (`.xml`) — formatted with indentation
- HTML (`.html`, `.htm`) — text content extraction
- Markdown (`.md`) — preserved as-is
- Plain text (`.txt`, `.log`, etc.)

Unsupported formats return metadata instead of throwing errors.

## Testing

The package includes 21 unit tests covering critical utilities:

```bash
# Run from repository root
npm test

# Run with coverage
npm run test:coverage
```

**Test files**:
- `llm/cost.test.ts`: Cost computation accuracy
- `tools/utils.test.ts`: pickKeys, compactToolResult, getSuggestion
- `tools/formats.test.ts`: MCP and Anthropic format adapters

All tests use Vitest with full TypeScript support.

## Design Decisions

### Why a Separate Package?

1. **Single Source of Truth**: All consumers share the same client, types, and tool logic. No drift between MCP server and web UI.

2. **Protocol Independence**: Tool schemas are defined once in JSON Schema. Adapters transform them for MCP, Anthropic, or any future protocol.

3. **Consumed as Source**: No build step required. Next.js uses `transpilePackages`, MCP/agent use `tsx`. TypeScript types flow through naturally.

4. **Testability**: Core logic can be tested in isolation from protocol-specific code.

5. **Maintainability**: 9,500 lines of shared code in one place. Fixes propagate to all consumers automatically.

### Client Architecture

The client uses TypeScript declaration merging to split the 155 methods across 17 domain files while presenting a single `OTCSClient` class:

```typescript
// base.ts defines the core
export class OTCSClient {
  protected fetch(path: string, options: RequestInit) { ... }
}

// auth.ts augments it
declare module './base' {
  interface OTCSClient {
    authenticate(): Promise<string>;
    logout(): Promise<void>;
  }
}

OTCSClient.prototype.authenticate = async function() { ... };

// otcs-client.ts imports all augmentations and re-exports
import './auth';
import './navigation';
// ... 15 more
export { OTCSClient } from './base';
```

This keeps each domain module under 300 lines while avoiding a monolithic 4,000+ line file.

### Tool Handler Split

The original 2,350-line `handler.ts` is now split into 11 domain handlers with a master dispatcher. Each handler exports a `Record<string, HandlerFn>` that the dispatcher merges:

```typescript
// handlers/documents.ts
export const documentHandlers: Record<string, HandlerFn> = {
  otcs_upload: async (client, args) => { ... },
  otcs_download: async (client, args) => { ... },
};

// handlers/index.ts
const handlers = {
  ...navigationHandlers,
  ...documentHandlers,
  ...folderHandlers,
  // ... 8 more
};

export async function handleToolCall(client, name, args) {
  return handlers[name](client, args);
}
```

This maintains backward compatibility while improving maintainability.

## Contributing

This package is part of the Altius monorepo. Changes must maintain backward compatibility for all four consumers.

Before submitting changes:
1. Run `npm test` to verify all tests pass
2. Run `npm run lint` to check code style
3. Update this README if adding new exports or changing architecture

## License

Proprietary — Internal use only
