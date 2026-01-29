# OTCS MCP Server

An MCP (Model Context Protocol) server for OpenText Content Server that enables AI agents to intelligently manage documents, folders, workspaces, workflows, and records. The server integrates with OpenText REST APIs:

- **Content Server REST API** - Core document/folder operations, workflows, and assignments
- **Business Workspaces REST API** - Workspace and team management
- **Records Management REST API** - Compliance, holds, and cross-references

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Foundation | ✅ Complete | Browse, search, upload, download, folders |
| 2. Business Workspaces | ✅ Complete | Workspace types, creation, relations, roles |
| 3. Workflows | ✅ Complete | Assignments, forms, tasks, lifecycle |
| 4. Metadata | ✅ Complete | Categories, forms, workspace properties |
| 5. Permissions & Users | ✅ Complete | Members, groups, ACL management |
| 6. RM Core | ✅ Complete | Classifications, holds, cross-references |
| 7. RM RSI | ✅ Complete | RSI retention schedules |
| 8. Content Sharing | ✅ Complete | External sharing via Core Share |
| 9. RM Advanced | Planned | Disposition processing |
| 10. Enhanced Features | Planned | Favorites, reminders, notifications, recycle bin |

**Current: 41 tools** | **Projected: 46 tools** (consolidated for AI agent performance)

## Tool Profiles

To optimize for different AI clients, you can select a tool profile:

| Profile | Tools | Use Case |
|---------|-------|----------|
| `core` | 22 | Basic document management + sharing |
| `workflow` | 30 | Document management + full workflow |
| `admin` | 33 | Document management + permissions/admin + RM |
| `rm` | 22 | Document management + Records Management |
| `full` | 41 | All tools (default) |

Configure via environment variable:
```bash
OTCS_TOOL_PROFILE=core  # or workflow, admin, rm, full
```

## Tools Reference

### Authentication (3 tools)

| Tool | Description |
|------|-------------|
| `otcs_authenticate` | Login with username/password (auto-runs on startup if env vars set) |
| `otcs_session_status` | Check if session is valid |
| `otcs_logout` | End authenticated session |

### Navigation & Search (3 tools)

| Tool | Description |
|------|-------------|
| `otcs_get_node` | Get node details by ID (with optional path/breadcrumb) |
| `otcs_browse` | List folder contents with filtering and sorting |
| `otcs_search` | Enterprise search across full-text content and metadata with type filtering, facets, and highlights |

**Search capabilities:**
- **Search scopes** (`search_in`): `all` (content + metadata), `content` (document body text only), `metadata` (name, description, attributes only)
- **Search modes** (`mode`): `allwords`, `anywords`, `exactphrase`, `complexquery` (LQL field queries)
- **Type filtering** (`filter_type`): `documents`, `folders`, `workspaces`, `workflows` — filters results to a single object type
- **Facets** (`include_facets`): Returns categorized result counts (creation date, content type, size, file type, classification)
- **Highlights** (`include_highlights`): Returns content excerpts with matched terms in **bold** markdown
- **Modifiers**: `synonymsof`, `relatedto`, `soundslike`, `wordbeginswith`, `wordendswith`
- **Sorting**: By relevance, date, size, or name (ascending/descending)
- **Pagination**: `limit` and `page` parameters

### Folders & Node Operations (2 tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_create_folder` | - | Create folder or nested path (e.g., "2024/Q1/Reports") |
| `otcs_node_action` | `copy`, `move`, `rename`, `delete` | Node operations |

### Documents (5 tools)

| Tool | Description |
|------|-------------|
| `otcs_upload` | Upload from file path OR base64 content (MIME auto-detected) |
| `otcs_download_content` | Download document as base64 |
| `otcs_upload_folder` | Upload entire folder with parallel processing (recursive option preserves structure) |
| `otcs_upload_batch` | Upload multiple specific files with parallel processing |
| `otcs_upload_with_metadata` | Upload with category/metadata and optional RM classification in one operation |

### Versions (1 tool)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_versions` | `list`, `add` | List versions or add new version |

### Workspaces (4 tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_workspace_types` | `list`, `get_form` | Get workspace types or creation form |
| `otcs_create_workspace` | - | Create business workspace |
| `otcs_get_workspace` | - | Get workspace details or find workspace for node |
| `otcs_search_workspaces` | - | Search workspaces by type, name, or query |

### Workspace Relations & Roles (2 tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_workspace_relations` | `list`, `add`, `remove` | Manage workspace relationships |
| `otcs_workspace_roles` | `get_roles`, `get_members`, `get_role_members`, `add_member`, `remove_member` | Manage workspace roles |

### Workflows (11 tools)

| Tool | Description |
|------|-------------|
| `otcs_get_assignments` | Get pending workflow tasks for current user |
| `otcs_workflow_status` | Get workflows by status or search active workflows |
| `otcs_workflow_definition` | Get workflow map definition |
| `otcs_workflow_tasks` | Get task list for workflow instance |
| `otcs_workflow_activities` | Get workflow activity/audit history |
| `otcs_start_workflow` | Start workflow (direct, draft, or initiate modes) |
| `otcs_workflow_form` | Get task form schema (basic or detailed Alpaca schema) |
| `otcs_workflow_task` | Execute task action: `send`, `accept`, `check_group` |
| `otcs_draft_workflow` | Manage drafts: `get_form`, `update_form`, `initiate` |
| `otcs_workflow_info` | Get comprehensive workflow info |
| `otcs_manage_workflow` | Lifecycle: `suspend`, `resume`, `stop`, `archive`, `delete` |

### Categories (2 tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_categories` | `list`, `get`, `add`, `update`, `remove`, `get_form` | Manage node categories with nested set support |
| `otcs_workspace_metadata` | `get_form`, `update` | Manage workspace business properties |

**Nested Set Attributes:** Categories can contain sets (groups of attributes organized in rows). The key format is:
- Simple: `{category_id}_{attribute_id}` → `"9830_2"`
- Set row: `{category_id}_{set_id}_{row}_{attribute_id}` → `"11081_2_1_26"`
- Multi-value: Use arrays → `["value1", "value2"]`

### Members (2 tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_members` | `search`, `get`, `get_user_groups`, `get_group_members` | Search and retrieve users/groups |
| `otcs_group_membership` | `add`, `remove` | Manage group membership |

### Permissions (1 tool)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_permissions` | `get`, `add`, `update`, `remove`, `effective`, `set_owner`, `set_public` | Full ACL management |

**Permission strings:** `see`, `see_contents`, `modify`, `edit_attributes`, `add_items`, `reserve`, `add_major_version`, `delete_versions`, `delete`, `edit_permissions`

**Apply-to scope:** `0`=This Item, `1`=Sub-Items, `2`=Both, `3`=Immediate Children

### Content Sharing (1 tool)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_share` | `list`, `create`, `stop`, `stop_batch` | Share content externally via Core Share |

**Permission levels:** `1`=Viewer, `2`=Collaborator, `3`=Manager, `4`=Owner

### Records Management (4 tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `otcs_rm_classification` | `browse_tree`, `get_node_classifications`, `declare`, `undeclare`, `update_details`, `make_confidential`, `remove_confidential`, `finalize` | Manage record classifications |
| `otcs_rm_holds` | `list_holds`, `get_hold`, `create_hold`, `update_hold`, `delete_hold`, `get_node_holds`, `apply_hold`, `remove_hold`, `apply_batch`, `remove_batch`, `get_hold_items`, `get_hold_users`, `add_hold_users`, `remove_hold_users` | Legal/administrative holds |
| `otcs_rm_xref` | `list_types`, `get_type`, `create_type`, `delete_type`, `get_node_xrefs`, `apply`, `remove`, `apply_batch`, `remove_batch` | Cross-references between records |
| `otcs_rm_rsi` | `list`, `get`, `create`, `update`, `delete`, `get_node_rsis`, `assign`, `remove`, `get_items`, `get_schedules`, `create_schedule`, `approve_schedule`, `get_approval_history` | RSI retention schedules |

## Installation

```bash
npm install
npm run build
```

### Quick Start with .env

Create a `.env` file in the project root:

```bash
OTCS_BASE_URL=https://your-server/otcs/cs.exe/api
OTCS_USERNAME=your-username
OTCS_PASSWORD=your-password
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Then run using the convenience script:

```bash
./start-mcp.sh
```

## Configuration

### Auto-Authentication

When credentials are provided via environment variables, the server **automatically authenticates** on startup.

### For Cursor IDE

Add to your Cursor MCP settings (Settings → Tools & MCP → New MCP Server):

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

### For Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "otcs": {
      "command": "node",
      "args": ["/path/to/otcs-mcp/dist/index.js"],
      "env": {
        "OTCS_BASE_URL": "https://your-server/otcs/cs.exe/api",
        "OTCS_USERNAME": "Admin",
        "OTCS_PASSWORD": "your-password",
        "OTCS_TOOL_PROFILE": "workflow",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OTCS_BASE_URL` | Yes | Content Server API URL |
| `OTCS_USERNAME` | Yes* | Login username |
| `OTCS_PASSWORD` | Yes* | Login password |
| `OTCS_DOMAIN` | No | Login domain |
| `OTCS_TOOL_PROFILE` | No | Tool profile: `core`, `workflow`, `admin`, `rm`, `full` (default) |
| `NODE_TLS_REJECT_UNAUTHORIZED` | No | Set to `"0"` for self-signed certificates |

## Usage Examples

### Browse and Navigate

```
Agent: Show me what's in the Enterprise Workspace
Tool: otcs_browse(folder_id=2000)
```

### Enterprise Search

```
Agent: Find all documents containing "contract"
Tool: otcs_search(query="contract", filter_type="documents", mode="allwords")

Agent: Search only document content for "invoice" (not metadata)
Tool: otcs_search(query="invoice", search_in="content", include_highlights=true)

Agent: Find items with "contract" in their name
Tool: otcs_search(query="OTName:*contract*", mode="complexquery")

Agent: Find all business workspaces matching "customer"
Tool: otcs_search(query="customer", filter_type="workspaces")

Agent: Search with facets to see result distribution
Tool: otcs_search(query="contract", include_facets=true)

Agent: Find words starting with "contr" using modifier
Tool: otcs_search(query="contr", modifier="wordbeginswith")
```

### Create Folder Structure

```
Agent: Create a folder structure for Q1 2024 reports
Tool: otcs_create_folder(parent_id=2000, path="2024/Q1/Reports")
```

### Upload a File

```
Agent: Upload the report from my desktop
Tool: otcs_upload(parent_id=12345, file_path="/Users/john/Desktop/report.pdf")
```

### Node Operations

```
Agent: Copy this document to another folder
Tool: otcs_node_action(action="copy", node_id=12345, destination_id=67890)

Agent: Rename this folder
Tool: otcs_node_action(action="rename", node_id=12345, new_name="New Folder Name")

Agent: Delete this document
Tool: otcs_node_action(action="delete", node_id=12345)
```

### Manage Workspaces

```
Agent: Show me all Customer workspace types
Tool: otcs_workspace_types(action="list")

Agent: Create a new customer workspace
Tool: otcs_create_workspace(template_id=17284, name="Acme Corp")

Agent: Add a member to the Owner role
Tool: otcs_workspace_roles(action="add_member", workspace_id=12345, role_id=100, member_id=1001)
```

### Workflow Tasks

```
Agent: Show my pending tasks
Tool: otcs_get_assignments()

Agent: Get the form for this task
Tool: otcs_workflow_form(process_id=8001, subprocess_id=8001, task_id=1, detailed=true)

Agent: Complete the task
Tool: otcs_workflow_task(
  action="send",
  process_id=8001, subprocess_id=8001, task_id=1,
  disposition="SendOn",
  comment="Approved"
)
```

### Categories and Metadata

```
Agent: Show categories on this document
Tool: otcs_categories(action="list", node_id=12345)

Agent: Get category form to see attribute structure (including nested sets)
Tool: otcs_categories(action="get_form", node_id=12345, category_id=11081)

Agent: Update simple category values
Tool: otcs_categories(
  action="update",
  node_id=12345,
  category_id=9830,
  values={"9830_2": "Approved"}
)

Agent: Update nested set attributes (format: {cat_id}_{set_id}_{row}_{attr_id})
Tool: otcs_categories(
  action="update",
  node_id=12345,
  category_id=11081,
  values={
    "11081_2_1_26": "INV-2024-001",
    "11081_2_1_10": "15000.00",
    "11081_20_1_22": ["PO-001", "PO-002"]
  }
)
```

### Members and Permissions

```
Agent: Find users named "Smith"
Tool: otcs_members(action="search", type=0, query="Smith")

Agent: Get permissions on this folder
Tool: otcs_permissions(action="get", node_id=2000)

Agent: Grant permissions to a user
Tool: otcs_permissions(
  action="add",
  node_id=12345,
  right_id=1001,
  permissions=["see", "see_contents", "modify"]
)

Agent: Check what permissions a user has
Tool: otcs_permissions(action="effective", node_id=12345, member_id=1001)
```

### Content Sharing

```
Agent: List all active shares
Tool: otcs_share(action="list")

Agent: Share a folder with an external user
Tool: otcs_share(
  action="create",
  node_ids=[12345],
  invitees=[{
    "business_email": "partner@example.com",
    "perm": 2
  }],
  sharing_message="Please review these documents"
)

Agent: Stop sharing a document
Tool: otcs_share(action="stop", node_id=12345)

Agent: Stop sharing multiple items at once
Tool: otcs_share(action="stop_batch", node_ids=[12345, 67890])
```

### Records Management

```
Agent: Browse the RM classification tree
Tool: otcs_rm_classification(action="browse_tree")

Agent: Get classifications applied to a document
Tool: otcs_rm_classification(action="get_node_classifications", node_id=12345)

Agent: Declare a document as a record
Tool: otcs_rm_classification(action="declare", node_id=12345, classification_id=5001)

Agent: List all legal holds
Tool: otcs_rm_holds(action="list_holds")

Agent: Create a new legal hold
Tool: otcs_rm_holds(action="create_hold", name="Litigation Hold 2024", hold_type="Legal")

Agent: Apply a hold to a document
Tool: otcs_rm_holds(action="apply_hold", hold_id=100, node_id=12345)

Agent: Create a cross-reference between records
Tool: otcs_rm_xref(action="apply", node_id=12345, target_node_id=67890, type_name="Related To")

Agent: List all RSI retention schedules
Tool: otcs_rm_rsi(action="list")

Agent: Get RSI details with schedules
Tool: otcs_rm_rsi(action="get", rsi_id=100)

Agent: Assign an RSI to a classified record
Tool: otcs_rm_rsi(action="assign", node_id=12345, class_id=5001, rsi_id=100)
```

## Development

```bash
npm test              # Run main API connectivity tests
npm run test:workflows   # Run workflow-specific tests
npm run test:workspaces  # Run workspace-specific tests
npm run test:rm          # Run Records Management tests
npm run dev           # Development mode with auto-reload
```

### RM Testing

The RM tests require a valid classification ID from your Records Management system:

```bash
# Find classification IDs by browsing the Classifications volume
# Then run tests with:
export RM_CLASSIFICATION_ID=14978  # Your classification ID
npm run test:rm
```

**RM Test Results:** 40 passed, 0 failed, 5 skipped

**RM Test Coverage:**
- Classifications: declare, update_details, undeclare
- Holds: create, apply, get, remove, delete
- Cross-references: list_types, apply, get, remove
- RSI: list, create, get, update, get_schedules, create_schedule, get_items, delete

## Architecture

```
otcs-mcp/
├── src/
│   ├── index.ts              # MCP server entry point (41 consolidated tools)
│   ├── types.ts              # TypeScript type definitions
│   └── client/
│       └── otcs-client.ts    # OTCS REST API client
├── tests/
│   ├── test.ts               # Main API connectivity tests
│   ├── test-workflows.ts     # Workflow-specific tests
│   ├── test-workspaces.ts    # Workspace-specific tests
│   └── test-rm.ts            # Records Management tests
├── docs/
│   ├── ARCHITECTURE_PLAN.md      # Detailed architecture and roadmap
│   ├── FUTURE-FEATURES.md        # Feature planning and backlog
│   ├── IMPLEMENTATION-PLAN.md    # Phased development roadmap
│   ├── CATEGORY-MANAGEMENT-API.md    # Category API usage guide
│   ├── OTCS-REFERENCE-IDS.md         # Common system IDs reference
│   ├── content-server-rest-api-2.0.2.yaml                    # Content Server REST API spec
│   ├── opentext-business-workspaces-rest-api-v1-and-v2.yaml  # Business Workspaces API spec
│   └── opentext-records-management-26.1.json                 # Records Management API spec
└── README.md
```

## Roadmap

### Phase 9: RM Disposition (1 tool)
- `otcs_rm_disposition` - Disposition search and processing

### Phase 10: Enhanced Features (4 tools)
- `otcs_favorites` - Manage favorites and tabs
- `otcs_reminders` - Node reminders
- `otcs_notifications` - Notification interests
- `otcs_recycle_bin` - Restore/purge deleted items

**Projected Total: 46 consolidated tools**

See [ARCHITECTURE_PLAN.md](./docs/ARCHITECTURE_PLAN.md) for detailed specifications.

## License

MIT
