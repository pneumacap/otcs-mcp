# OTCS MCP Server

An MCP (Model Context Protocol) server for OpenText Content Server that enables AI agents to intelligently manage documents, folders, workspaces, workflows, and records. The server integrates with OpenText REST APIs:

- **Content Server REST API** - Core document/folder operations, workflows, and assignments
- **Business Workspaces REST API** - Workspace and team management
- **Records Management REST API** - Compliance, retention, and holds (coming soon)

## Current Status

| Phase | Status | Tools |
|-------|--------|-------|
| 1. Foundation | ✅ Complete | 17 tools |
| 2. Business Workspaces | ✅ Complete | 14 tools |
| 3. Workflow & Assignments | ✅ Complete | 13 tools |
| 4. Metadata & Categories | Planned | - |
| 5-8. Advanced Features | Planned | - |

**Total: 44 MCP tools implemented**

## Features

### Phase 1: Foundation ✅

### Authentication
- `otcs_authenticate` - Login with username/password
- `otcs_session_status` - Check session validity
- `otcs_logout` - End session

### Navigation
- `otcs_get_node` - Get node details by ID
- `otcs_browse` - List folder contents with filtering
- `otcs_search` - Search for nodes by name

### Folder Operations
- `otcs_create_folder` - Create a single folder
- `otcs_create_folder_path` - Create nested folder structure (e.g., "2024/Q1/Reports")
- `otcs_rename_node` - Rename any node
- `otcs_move_node` - Move node to different location
- `otcs_copy_node` - Copy node to new location
- `otcs_delete_node` - Delete a node

### Document Operations
- `otcs_upload_file` - **Upload a file from disk** (preferred - auto-detects MIME type)
- `otcs_upload_document` - Upload document with base64 content
- `otcs_download_content` - Download document content

### Version Management
- `otcs_list_versions` - List all versions of a document
- `otcs_add_version` - Add a new version to a document

### Phase 2: Business Workspaces ✅

#### Workspace Discovery
- `otcs_get_workspace_types` - List available workspace types (44 types available)
- `otcs_get_workspace_form` - Get creation form schema for a workspace type

#### Workspace Operations
- `otcs_create_workspace` - Create a new business workspace
- `otcs_get_workspace` - Get workspace details
- `otcs_search_workspaces` - Search workspaces by name, type, or query
- `otcs_find_workspace_root` - Find which workspace contains a document

#### Workspace Relations
- `otcs_get_related_workspaces` - Get related workspaces (projects, contracts, etc.)
- `otcs_add_workspace_relation` - Link two workspaces
- `otcs_remove_workspace_relation` - Remove workspace link

#### Workspace Roles & Members
- `otcs_get_workspace_roles` - Get roles (Owner, Reviewer, etc.)
- `otcs_get_role_members` - Get members of a role
- `otcs_add_role_member` - Add user/group to a role
- `otcs_remove_role_member` - Remove from role

### Phase 3: Workflow & Assignments ✅

#### User Assignments
- `otcs_get_assignments` - Get current user's pending workflow tasks
- `otcs_get_workflow_status` - Get workflows by status (pending, late, completed)
- `otcs_get_active_workflows` - Get running workflows with filters

#### Workflow Operations
- `otcs_get_workflow_definition` - Get workflow map definition and tasks
- `otcs_get_workflow_tasks` - Get task list for a workflow instance
- `otcs_get_workflow_activities` - Get workflow activity/audit history
- `otcs_create_draft_workflow` - Create draft process before initiation
- `otcs_initiate_workflow` - Start a new workflow instance
- `otcs_start_workflow` - Start workflow with disabled start step

#### Task Actions
- `otcs_send_workflow_task` - Execute task action (SendOn, Delegate, SendForReview)
- `otcs_update_workflow_status` - Change process status (suspend, resume, stop, archive)
- `otcs_delete_workflow` - Delete a workflow instance
- `otcs_get_workflow_form` - Get workflow task form schema

### Coming Soon: Records Management (Phase 6-7)

#### RM Classifications
- Declare documents as official records
- Apply retention schedules
- Browse classification hierarchy

#### Legal Holds
- Create and manage litigation holds
- Place/release holds on documents
- Track all items under a hold

#### Dispositions
- Process retention schedules
- Review and approve destructions
- Track disposition history

#### Physical Objects
- Request/borrow physical items
- Track circulation history
- Manage storage locations

## Installation

```bash
npm install
npm run build
```

## Configuration

### Auto-Authentication

When credentials are provided via environment variables, the server **automatically authenticates** on startup. You don't need to call `otcs_authenticate` manually - just start using the tools directly.

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
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

**Important:** The `env` section is required! MCP servers don't inherit your shell's environment variables - you must explicitly pass them in the config.

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
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OTCS_BASE_URL` | Yes | Content Server API URL (e.g., `https://server/otcs/cs.exe/api`) |
| `OTCS_USERNAME` | Yes* | Login username |
| `OTCS_PASSWORD` | Yes* | Login password |
| `OTCS_DOMAIN` | No | Login domain (if using domain authentication) |
| `NODE_TLS_REJECT_UNAUTHORIZED` | No | Set to `"0"` for self-signed certificates |

*If not provided, you must call `otcs_authenticate` with credentials before using other tools.

### Manual Authentication

If you prefer not to store credentials in the config, you can authenticate manually:

```
Agent: Authenticate to Content Server
Tool: otcs_authenticate(username="Admin", password="xxx")
```

## Usage Examples

### Browse Content (with auto-authentication)

```
Agent: Show me what's in the Enterprise Workspace
Tool: otcs_browse(folder_id=2000)
→ Returns folder contents (auto-authenticated from env vars)
```

### Create Folder Structure

```
Agent: Create a folder structure for Q1 2024 reports
Tool: otcs_create_folder_path(parent_id=2000, path="2024/Q1/Reports")
```

### Upload a File from Disk

```
Agent: Upload the report from my desktop to the AI Demo folder
Tool: otcs_upload_file(
  parent_id=12345,
  file_path="/Users/john/Desktop/report.pdf"
)
→ File uploaded with ID 67890 (MIME type auto-detected)
```

### Upload Document with Base64 Content

```
Agent: Upload this generated content as a document
Tool: otcs_upload_document(
  parent_id=12345,
  name="Contract_2024.pdf",
  content_base64="...",
  mime_type="application/pdf"
)
```

### Create a Business Workspace

```
Agent: Create a new Customer workspace for Acme Corp

1. otcs_get_workspace_types()
   → Find "Customer" type with template_id=17284

2. otcs_create_workspace(
     template_id=17284,
     name="Acme Corp",
     description="Customer workspace for Acme Corporation"
   )
   → Returns workspace_id=12345
```

### Search and Manage Workspaces

```
Agent: Show me all Customer workspaces and their team roles
Tool: otcs_search_workspaces(
  workspace_type_name="Customer",
  limit=10
)
→ Returns list of Customer workspaces

Tool: otcs_get_workspace_roles(workspace_id=12345)
→ Returns: Sales Director, Sales Representative, Support Representative
```

### Link Related Workspaces

```
Agent: Link this project to the Acme customer workspace
Tool: otcs_add_workspace_relation(
  workspace_id=12345,      // Customer workspace
  related_workspace_id=67890  // Project workspace
)
```

### View Workflow Assignments

```
Agent: Show me my pending workflow tasks
Tool: otcs_get_assignments()
→ Returns list of pending tasks with:
  - Task name, instructions, priority
  - Due date, workflow ID
  - From user (who assigned it)
```

### Initiate a Workflow

```
Agent: Start the Document Approval workflow for this contract

1. otcs_get_workflow_definition(map_id=5000)
   → Get workflow map details and required roles

2. otcs_initiate_workflow(
     workflow_id=5000,
     doc_ids="12345",
     role_info={ "Approver": 1001, "Reviewer": 1002 }
   )
   → Returns new workflow instance ID
```

### Complete a Workflow Task

```
Agent: Approve and send on my current task
Tool: otcs_send_workflow_task(
  process_id=8001,
  subprocess_id=8001,
  task_id=1,
  action="SendOn",
  comment="Approved - looks good"
)
```

### Delegate a Task

```
Agent: Delegate this review task to John (user ID 1005)
Tool: otcs_send_workflow_task(
  process_id=8001,
  subprocess_id=8001,
  task_id=1,
  action="Delegate",
  comment="Delegating to John for review"
)
```

## Development

```bash
# Run tests against live server
npm test

# Development mode with auto-reload
npm run dev
```

## Testing

The test script validates connectivity and basic operations:

```bash
npm test
```

This will:
1. Authenticate with the server
2. Browse the Enterprise Workspace
3. Create and delete a test folder
4. Test folder path creation
5. Upload a test document

## Architecture

```
src/
├── index.ts              # MCP server entry point
├── types.ts              # TypeScript type definitions
├── client/
│   └── otcs-client.ts    # OTCS REST API client
└── test.ts               # API connectivity tests
```

## Node Type Reference

| Type | ID | Description |
|------|-----|-------------|
| Folder | 0 | Standard folder |
| Shortcut | 1 | Shortcut/alias |
| Document | 144 | Document with file |
| URL | 140 | URL bookmark |
| Business Workspace | 848 | Business workspace |
| Project | 202 | Project container |

## Roadmap

### Phase 3: Workflow & Assignments ✅
- User assignments and pending tasks
- Workflow initiation and management
- Task actions (SendOn, Delegate, Review)
- Workflow status and activity tracking

### Phase 4: Metadata & Categories (Next)
- Category operations (add, update, remove)
- Form schema retrieval
- Bulk metadata updates

### Phase 5: Permissions & Advanced
- Permission management
- Document reservations
- Large file uploads

### Phase 6-7: Records Management
- RM Classifications & record declaration
- Legal/administrative holds
- Disposition processing
- Physical object circulation
- Security clearance levels

### Phase 8: Intelligence Layer
- Smart filing recommendations
- Compliance reporting
- Activity summarization

See [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) for detailed tool specifications.

## License

MIT
