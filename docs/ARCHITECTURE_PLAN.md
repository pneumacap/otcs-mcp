# OpenText Content Server MCP Tools Architecture Plan

## Executive Summary

This document outlines the architecture for MCP (Model Context Protocol) tools that enable AI agents to intelligently manage documents, workspaces, folders, and metadata in OpenText Content Server. The tools leverage two REST APIs:

1. **Content Server REST API** - Core node/document operations, versioning, search, permissions
2. **Business Workspaces REST API** - Workspace management, roles, relations, business object integration
3. **Records Management REST API** - Classifications, holds, dispositions, RSI schedules, physical objects, security clearance

---

## Tool Consolidation (v2.0)

As of version 2.0, tools have been consolidated from 71 individual tools down to **36 tools** for better AI agent performance. The consolidation follows the principle of **one tool per resource type** with an `action` parameter for CRUD operations.

### Consolidation Summary

| Category | Before | After | Pattern |
|----------|--------|-------|---------|
| Permissions | 7 tools | 1 tool | `otcs_permissions` with actions: get, add, update, remove, effective, set_owner, set_public |
| Members | 6 tools | 2 tools | `otcs_members` (search/get) + `otcs_group_membership` (add/remove) |
| Categories | 4 tools | 2 tools | `otcs_categories` with actions: list, get, add, update, remove, get_form |
| Node Operations | 4 tools | 1 tool | `otcs_node_action` with actions: copy, move, rename, delete |
| Folders | 2 tools | 1 tool | `otcs_create_folder` with optional `path` parameter |
| Versions | 2 tools | 1 tool | `otcs_versions` with actions: list, add |
| Upload | 2 tools | 1 tool | `otcs_upload` with file_path OR content_base64 |
| Workspace Relations | 3 tools | 1 tool | `otcs_workspace_relations` with actions: list, add, remove |
| Workspace Roles | 5 tools | 1 tool | `otcs_workspace_roles` with multiple actions |

### Tool Profiles

Users can select a tool profile via `OTCS_TOOL_PROFILE` environment variable:

| Profile | Tools | Use Case |
|---------|-------|----------|
| `core` | 18 | Basic document management |
| `workflow` | 27 | Document management + full workflow support |
| `admin` | 28 | Document management + permissions/admin + RM |
| `rm` | 18 | Document management + Records Management |
| `full` | 36 | All tools (default) |

---

## Core Design Principles

### 1. Agent-Friendly Abstractions
- Tools should map to **user intentions** not raw API endpoints
- Combine multiple API calls into single intelligent operations where sensible
- Return structured, actionable information the agent can reason about

### 2. Stateful Session Management
- Maintain authentication ticket across tool invocations
- Cache workspace type schemas and category definitions
- Track recently accessed nodes for context

### 3. Intelligent Error Handling
- Transform API errors into actionable guidance
- Suggest alternative approaches when operations fail
- Validate inputs before making API calls

---

## Tool Categories

### Category 1: Authentication & Session

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_authenticate` | Establish session with credentials | `POST /v1/auth` |
| `otcs_session_status` | Check authentication state | `HEAD /v2/auth` |
| `otcs_logout` | End session | `DELETE /v2/auth` |

**Design Notes:**
- Store ticket in MCP server state
- Auto-refresh on 401 responses
- Support domain-based authentication

---

### Category 2: Navigation & Discovery

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_browse` | List folder contents with metadata | `GET /v2/nodes/{id}/nodes` |
| `otcs_get_node` | Get detailed node information | `GET /v2/nodes/{id}` |
| `otcs_get_path` | Get node ancestry/breadcrumb | `GET /v2/nodes/{id}` with expand |
| `otcs_get_volumes` | List accessible volumes | `GET /v2/volumes` |
| `otcs_find_workspace_root` | Find business workspace for any node | `GET /v1/nodes/{id}/businessworkspace` |

**Agent Use Cases:**
- "Show me what's in the Project Alpha folder"
- "Navigate to the contracts workspace"
- "What's the path to document ID 12345?"

---

### Category 3: Search & Query

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_search` | Full-text and metadata search | `GET /v2/search` |
| `otcs_search_workspaces` | Search business workspaces | `GET /v2/businessworkspaces` |
| `otcs_search_advanced` | Complex query with filters | Business workspace column query |
| `otcs_get_recent` | Recently accessed items | `GET /v2/members/accessed` |
| `otcs_get_favorites` | User's favorite items | `GET /v2/members/favorites` |

**Query Language Support:**
```
where_column_query=name LIKE '*Test' AND (WNF_ATT_35S_2 > 2020-03-20 OR status = 'Active')
```

**Agent Use Cases:**
- "Find all contracts expiring this month"
- "Search for documents containing 'quarterly report'"
- "Show my recently accessed workspaces"

---

### Category 4: Folder Operations

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_create_folder` | Create folder with optional metadata | `POST /v2/nodes` (type=0) |
| `otcs_create_folder_path` | Create nested folder hierarchy | Multiple `POST /v2/nodes` |
| `otcs_list_folder` | List folder contents with filtering | `GET /v2/nodes/{id}/nodes` |
| `otcs_get_folder_tree` | Get recursive folder structure | Recursive `GET /v2/nodes/{id}/nodes` |
| `otcs_clone_folder_structure` | Replicate folder hierarchy to destination | Recursive copy operations |
| `otcs_get_folder_size` | Get total size and item count | `GET /v2/nodes/{id}` + aggregation |
| `otcs_empty_folder` | Delete all contents but keep folder | Batch `DELETE /v2/nodes/{id}` |
| `otcs_flatten_folder` | Move all nested items to single level | Recursive move operations |

**Parameters for `otcs_list_folder`:**
```typescript
{
  folder_id: number;
  filter?: {
    type?: 'folders' | 'documents' | 'all';  // Filter by node type
    name_pattern?: string;                    // e.g., "*.pdf", "report*"
    modified_after?: string;                  // ISO date
    modified_before?: string;
  };
  sort?: 'name' | 'date' | 'size' | 'type';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
  include_metadata?: boolean;                 // Include category values
}
```

**Parameters for `otcs_create_folder_path`:**
```typescript
{
  parent_id: number;
  path: string;           // e.g., "2024/Q1/Reports/Final"
  create_missing?: boolean; // Create intermediate folders (default: true)
  metadata?: {            // Apply to leaf folder only, or all
    apply_to: 'leaf' | 'all';
    categories: Record<string, any>;
  };
}
```

**Agent Use Cases:**
- "Create folder structure 2024/Q1/Reports in the Finance workspace"
- "List all PDF files in the contracts folder modified this month"
- "Show me the folder tree for the Project Alpha workspace"
- "Clone the template folder structure to the new project"
- "How many documents and what's the total size of the Archive folder?"

---

### Category 5: Document Operations

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_upload_document` | Upload file with metadata | `POST /v2/nodes` (type=144) |
| `otcs_upload_large_document` | Chunked upload for large files | Multipart upload API |
| `otcs_download_content` | Download document content | `GET /v2/nodes/{id}/content` |
| `otcs_get_content_preview` | Get text preview/summary | `GET /v2/nodes/{id}/content` (text) |
| `otcs_get_thumbnail` | Get document thumbnail | `GET /v2/nodes/{id}/thumbnails` |
| `otcs_copy_node` | Copy node to destination | `POST /v2/nodes` with original_id |
| `otcs_move_node` | Move node to destination | `PUT /v2/nodes/{id}` |
| `otcs_delete_node` | Delete node | `DELETE /v2/nodes/{id}` |
| `otcs_rename_node` | Rename node | `PUT /v2/nodes/{id}` |
| `otcs_reserve_document` | Lock document for editing | `PUT /v2/nodes/{id}/reserve` |
| `otcs_unreserve_document` | Release document lock | `DELETE /v2/nodes/{id}/reserve` |

**Agent Use Cases:**
- "Upload this contract to the legal folder"
- "Move all draft documents to the archive"
- "Reserve this document so I can edit it"
- "Download the latest version of the proposal"

---

### Category 6: Version Management

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_list_versions` | Get version history | `GET /v2/nodes/{id}/versions` |
| `otcs_add_version` | Upload new version | `POST /v2/nodes/{id}/versions` |
| `otcs_get_version` | Get specific version | `GET /v2/nodes/{id}/versions/{version}` |
| `otcs_download_version` | Download specific version | `GET /v2/nodes/{id}/versions/{v}/content` |
| `otcs_promote_version` | Make version current | `PUT /v2/nodes/{id}/versions/{v}/promote` |
| `otcs_compare_versions` | Compare two versions (metadata) | Multiple GET calls |

**Agent Use Cases:**
- "Show version history for this document"
- "Upload a new version of the contract"
- "Restore version 3 as the current version"

---

### Category 7: Business Workspace Management

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_create_workspace` | Create business workspace | `POST /v2/businessworkspaces` |
| `otcs_create_workspaces_bulk` | Create multiple workspaces | `PUT /v2/businessworkspaces` |
| `otcs_get_workspace` | Get workspace details | `GET /v2/businessworkspaces/{id}` |
| `otcs_get_workspace_types` | List available workspace types | `GET /v2/businessworkspacetypes` |
| `otcs_get_workspace_form` | Get creation form schema | `GET /v2/forms/businessworkspaces/create` |

**Agent Use Cases:**
- "Create a new Customer workspace for Acme Corp"
- "What workspace types are available?"
- "What fields are required for a Project workspace?"

---

### Category 8: Workspace Relations & Team

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_get_related_workspaces` | Get related workspaces | `GET /v2/businessworkspaces/{id}/relateditems` |
| `otcs_add_workspace_relation` | Link workspaces | `POST /v2/businessworkspaces/{id}/relateditems` |
| `otcs_remove_workspace_relation` | Unlink workspaces | `DELETE /v2/businessworkspaces/{id}/relateditems/{rel_id}` |
| `otcs_get_workspace_members` | Get team members | `GET /v2/businessworkspaces/{id}/members` |
| `otcs_get_workspace_roles` | Get roles | `GET /v2/businessworkspaces/{id}/roles` |
| `otcs_add_role_member` | Add user to role | `POST /v2/businessworkspaces/{id}/roles/{role_id}/members` |
| `otcs_remove_role_member` | Remove user from role | `DELETE .../members/{member_id}` |

**Agent Use Cases:**
- "Show all projects related to this customer"
- "Add John to the Reviewer role"
- "Who are the members of this workspace?"

---

### Category 9: Metadata & Categories

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_get_categories` | Get node categories | `GET /v2/nodes/{id}/categories` |
| `otcs_add_category` | Apply category to node | `POST /v2/nodes/{id}/categories` |
| `otcs_update_category` | Update category values | `PUT /v2/nodes/{id}/categories/{cat_id}` |
| `otcs_remove_category` | Remove category | `DELETE /v2/nodes/{id}/categories/{cat_id}` |
| `otcs_get_metadata_form` | Get update form schema | `GET /v2/forms/businessworkspaces/{id}/metadata/update` |
| `otcs_update_workspace_metadata` | Update business properties | Combined operation |

**Nested Set Attribute Support:**

Categories can contain sets (groups of related attributes organized in rows). The implementation supports:

| Value Format | Key Pattern | Example |
|--------------|-------------|---------|
| Simple attribute | `{cat_id}_{attr_id}` | `"9830_2": "value"` |
| Set row attribute | `{cat_id}_{set_id}_{row}_{attr_id}` | `"11081_2_1_26": "INV-001"` |
| Multi-value | Array of values | `"11081_20_1_22": ["PO-001", "PO-002"]` |
| Nested object | Auto-flattened | `{"4": {"1": {"5": "value"}}}` → `"9830_4_1_5"` |
| Row array | Auto-flattened | `{"4": [{"5": "v1"}, {"5": "v2"}]}` → rows 1, 2 |

The `get_form` action returns `CategoryAttribute` objects with:
- `is_set: true` for set/group attributes
- `children: CategoryAttribute[]` for nested attributes within sets
- `set_rows: number` indicating existing row count

**Agent Use Cases:**
- "Set the contract expiration date to December 31"
- "What metadata categories are on this document?"
- "Update the project status to 'In Review'"
- "Set the invoice data with vendor and payment information"

---

### Category 10: Members (Users & Groups) ✅ Phase 5

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_search_members` | Search for users and/or groups | `GET /v2/members` |
| `otcs_get_member` | Get user/group details by ID | `GET /v2/members/{id}` |
| `otcs_get_user_groups` | Get groups a user belongs to | `GET /v2/members/{id}/memberof` |
| `otcs_get_group_members` | Get members of a group | `GET /v2/members/{id}/members` |
| `otcs_add_member_to_group` | Add user/group to a group | `POST /v2/members/{id}/members` |
| `otcs_remove_member_from_group` | Remove member from group | `DELETE /v2/members/{id}/members/{member_id}` |

**Search Parameters:**
- `type`: 0=users, 1=groups
- `query`: Search login name, first/last name, email
- `where_name`, `where_first_name`, `where_last_name`, `where_business_email`
- `sort`: name, first_name, last_name, mailaddress (prefix with asc_/desc_)

**Agent Use Cases:**
- "Find user John Smith"
- "What groups does user 1000 belong to?"
- "Show me all members of the Reviewers group"
- "Add the Marketing team to this workspace role"

---

### Category 11: Permissions ✅ Phase 5

| Tool | Purpose | API Operations |
|------|---------|---------------|
| `otcs_get_permissions` | Get all permissions on a node | `GET /v2/nodes/{id}/permissions` |
| `otcs_add_permission` | Add custom permission for user/group | `POST /v2/nodes/{id}/permissions/custom` |
| `otcs_update_permission` | Update existing permission | `PUT /v2/nodes/{id}/permissions/custom/{right_id}` |
| `otcs_remove_permission` | Remove permission from user/group | `DELETE /v2/nodes/{id}/permissions/custom/{right_id}` |
| `otcs_get_effective_permissions` | Get computed permissions for user | `GET /v2/nodes/{id}/permissions/effective/{member_id}` |
| `otcs_update_owner_permissions` | Update owner permissions (or transfer ownership) | `PUT /v2/nodes/{id}/permissions/owner` |
| `otcs_update_public_permissions` | Update public access permissions | `PUT /v2/nodes/{id}/permissions/public` |

**Permission Strings:**
`see`, `see_contents`, `modify`, `edit_attributes`, `add_items`, `reserve`, `add_major_version`, `delete_versions`, `delete`, `edit_permissions`

**Apply-To Scope (for folders):**
- `0`: This Item Only
- `1`: Sub-Items Only
- `2`: This Item and Sub-Items
- `3`: This Item and Immediate Sub-Items

**Agent Use Cases:**
- "Who has access to this folder?"
- "Grant read access to the Marketing team"
- "What permissions does user 1000 have on this document?"
- "Remove access for user 5001 from this folder"
- "Transfer ownership to John Smith"

---

### Category 12: Intelligent Composite Operations

These tools combine multiple API calls for common agent workflows:

| Tool | Purpose | Operations Combined |
|------|---------|---------------------|
| `otcs_file_document` | Smart filing with auto-categorization | Search workspace + Create node + Add categories |
| `otcs_summarize_workspace` | Get workspace overview | Get workspace + Get members + Get related + Recent docs |
| `otcs_workspace_report` | Generate workspace report | Multiple queries aggregated |
| `otcs_bulk_update_metadata` | Update metadata on multiple nodes | Batch category updates |
| `otcs_clone_folder_structure` | Replicate folder hierarchy | Recursive copy operations |

---

### Category 13: Workflow & Assignments ✅ Phase 3

OpenText Content Server provides comprehensive workflow capabilities for routing documents through approval and review processes.

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_assignments` | Get current user's workflow assignments | `GET /v2/members/assignments` |
| `otcs_get_workflow_status` | Get workflows by status (pending, late, etc.) | `GET /v2/workflows/status` |
| `otcs_get_active_workflows` | Get running workflows with filters | `GET /v2/workflows/status/active` |
| `otcs_get_workflow_definition` | Get workflow map definition | `GET /v2/processes/{map_id}/definition` |
| `otcs_get_workflow_tasks` | Get task list for a workflow instance | `GET /v2/workflows/status/processes/{process_id}` |
| `otcs_get_workflow_activities` | Get workflow activity history | `GET /v2/processes/{id}/subprocesses/{sub_id}/activities` |
| `otcs_create_draft_workflow` | Create draft process before initiation | `POST /v2/draftprocesses` |
| `otcs_initiate_workflow` | Start a workflow instance | `POST /v2/processes` |
| `otcs_start_workflow` | Start workflow (disabled start step) | `POST /v2/draftprocesses/startwf` |
| `otcs_send_workflow_task` | Execute task action (SendOn, Delegate, Review) | `PUT /v2/processes/{id}/subprocesses/{sub}/tasks/{task}` |
| `otcs_update_workflow_status` | Change process status (suspend/resume/stop) | `PUT /v2/processes/{id}/status` |
| `otcs_delete_workflow` | Delete a workflow instance | `DELETE /v2/processes/{id}` |
| `otcs_get_workflow_form` | Get workflow task form schema | `GET /v1/forms/processes/tasks/update` |
| `otcs_get_workflow_info` | Get comprehensive workflow details | `GET /v2/workflows/status/info` |
| `otcs_update_draft_workflow_form` | Update form data on draft workflow | `PUT /v2/draftprocesses/{id}` |
| `otcs_accept_workflow_task` | Accept a group-assigned task | `POST /v2/mobilegroupassignment/accept/...` |

**Parameters for `otcs_get_assignments`:**
```typescript
{
  // Returns user's pending workflow tasks
  // Each assignment includes:
  //   - workflow_id, workflow_subworkflow_id, workflow_subworkflow_task_id
  //   - name, instructions, priority, status
  //   - date_due, from_user_id
}
```

**Parameters for `otcs_send_workflow_task`:**
```typescript
{
  process_id: number;           // Workflow instance ID
  subprocess_id: number;        // Sub-workflow ID
  task_id: number;              // Task ID
  action?: string;              // Standard action: 'SendOn' | 'SendForReview' | 'Delegate' | 'Reply'
  custom_action?: string;       // Custom disposition action
  comment?: string;             // Comment for the action
  form_data?: Record<string, string>;  // Workflow form field values
}
```

**Parameters for `otcs_initiate_workflow`:**
```typescript
{
  workflow_id: number;          // Workflow map ID
  role_info?: Record<string, number>;  // Role assignments: { "Role1": userId, "Role2": groupId }
  doc_ids?: string;             // Comma-separated node IDs to attach
  attach_documents?: boolean;   // Whether to attach documents
}
```

**Agent Use Cases:**
- "Show me my pending workflow tasks"
- "What workflows are overdue?"
- "Start the Document Approval workflow for this contract"
- "Approve and send on my current task with comment"
- "Delegate this review task to John"
- "Show the activity history for workflow 12345"
- "Stop the workflow for project ABC"

---

### Category 13a: Workflow Forms & Attributes ✅ Phase 3a

Workflow tasks often require the user to fill in form fields (attributes) before completing an action. The API provides comprehensive support for discovering form schemas and updating field values.

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_workflow_task_form` | Get Alpaca form schema for a task | `GET /v1/forms/processes/tasks/update` |
| `otcs_get_draft_workflow_form` | Get form schema for draft workflow | `GET /v1/forms/draftprocesses` |
| `otcs_update_draft_form` | Update form values before initiation | `PUT /v2/draftprocesses/{id}` with `action=formUpdate` |
| `otcs_get_workflow_info` | Get workflow details with forms/attributes | `GET /v2/workflows/status/info` |

**Workflow Form Schema Response:**
```typescript
interface WorkflowFormSchema {
  data: {
    title: string;                    // Workflow title
    instructions: string;             // Task instructions
    priority: number;                 // 0=Low, 50=Medium, 100=High
    comments_on: boolean;             // Comments enabled
    attachments_on: boolean;          // Attachments enabled
    actions: WorkflowAction[];        // Standard actions (SendOn, Delegate, etc.)
    custom_actions: WorkflowAction[]; // Custom disposition actions
    member_accept: boolean;           // Requires accept before working
    authentication: boolean;          // Requires re-authentication
    data_packages: DataPackage[];     // Comments (2), Attachments (1), Attributes (3)
  };
  forms: AlpacaForm[];                // Form definitions with data/options/schema
}

interface AlpacaForm {
  data: Record<string, any>;          // Current field values
  options: Record<string, any>;       // Field display options
  schema: Record<string, any>;        // Field type definitions
  columns: 1 | 2;                     // Form layout columns
}
```

**Workflow Form Field Naming Convention:**

The API uses a specific naming convention for form field keys:

| Field Type | Format | Example |
|------------|--------|---------|
| Workflow Title | `WorkflowForm_Title` | `"WorkflowForm_Title": "New Title"` |
| Workflow Due Date | `WorkflowForm_WorkflowDueDate` | `"WorkflowForm_WorkflowDueDate": "2024-12-31 23:59:59.000"` |
| Simple Attribute | `WorkflowForm_{fieldid}` | `"WorkflowForm_10": "value"` |
| Multi-value Attribute | `WorkflowForm_{fieldid}` | `"WorkflowForm_10": ["val1", "val2"]` |
| Form Attribute | `WorkflowForm_{type}x{subtype}x{formid}x{fieldid}` | `"WorkflowForm_1x4x1x3": "value"` |
| Set Attribute (single) | `WorkflowForm_{type}x{subtype}x{formid}x{setid}_x_{fieldid}` | `"WorkflowForm_1x4x1x4_x_6": "value"` |
| Set Attribute (row) | `WorkflowForm_{...x...x...x{setid}}` | `[{"..._x_5": "a", "..._x_6": "b"}]` |

**Parameters for `otcs_update_draft_form`:**
```typescript
{
  draftprocess_id: number;       // Draft workflow ID
  action: 'formUpdate';          // Must be 'formUpdate' to update fields
  values: {                      // Form field values to update
    WorkflowForm_Title?: string;
    WorkflowForm_WorkflowDueDate?: string;  // Format: "yyyy-MM-dd HH:mm:ss.SSS"
    [key: string]: string | string[] | object[];  // Dynamic field keys
  };
}
```

**Example: Update Workflow Form Before Initiation:**
```typescript
// Step 1: Create draft workflow
const draft = await otcs_create_draft_workflow({ workflow_id: 5000, doc_ids: "12345" });

// Step 2: Get form schema to discover field names
const form = await otcs_get_draft_workflow_form({ draftprocess_id: draft.draftprocess_id });
// form.forms[0].schema contains field definitions

// Step 3: Update form values
await otcs_update_draft_form({
  draftprocess_id: draft.draftprocess_id,
  action: 'formUpdate',
  values: {
    WorkflowForm_Title: "Contract Approval - Acme Corp",
    WorkflowForm_WorkflowDueDate: "2024-12-31 17:00:00.000",
    WorkflowForm_10: "High Priority",        // Custom attribute
    WorkflowForm_1x4x1x2: "Legal Review"     // Form field
  }
});

// Step 4: Initiate the workflow
await otcs_update_draft_form({
  draftprocess_id: draft.draftprocess_id,
  action: 'Initiate',
  comment: 'Starting approval process'
});
```

**Agent Use Cases:**
- "What form fields are required for this workflow task?"
- "Set the due date to end of month before approving"
- "Fill in the approval date field and send on the task"
- "Show me the workflow attributes I need to complete"
- "Update the priority to High and delegate to John"

**Data Package Types:**
| Type | SubType | Description |
|------|---------|-------------|
| 1 | 1 | Attachments |
| 1 | 2 | Comments |
| 1 | 3 | Attributes (workflow form fields) |

---

## Records Management API Tools

The Records Management API provides enterprise compliance, retention, and governance capabilities. These tools integrate with nodes managed through the Content Server API.

### Category 14: RM Classifications

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_rm_classifications` | Get RM classifications on a node | `GET /v1/nodes/{id}/rmclassifications` |
| `otcs_apply_rm_classification` | Classify a node as a record | `POST /v1/nodes/{id}/rmclassifications` |
| `otcs_update_rm_classification` | Update record details | `PUT /v1/nodes/{id}/rmclassifications` |
| `otcs_remove_rm_classification` | Remove RM classification | `DELETE /v1/nodes/{id}/rmclassifications/{class_id}` |
| `otcs_get_classification_tree` | Browse classification hierarchy | `GET /v2/classificationvolume` |
| `otcs_get_classified_items` | List items under a classification | `GET /v2/classifieditems/{id}` |
| `otcs_make_confidential` | Mark record as confidential | `POST /v1/nodes/{id}/rmclassifications/makeConfidential` |

**Agent Use Cases:**
- "Classify this contract as a legal record"
- "What retention schedule applies to this document?"
- "Show all records under the HR classification"

---

### Category 15: Legal & Administrative Holds

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_list_holds` | List all holds in the system | `GET /v2/holds` |
| `otcs_get_hold` | Get hold details | `GET /v2/holds/{id}` |
| `otcs_create_hold` | Create a new hold | `POST /v1/holds` |
| `otcs_update_hold` | Update hold properties | `PUT /v2/holds/{id}` |
| `otcs_delete_hold` | Delete a hold | `DELETE /v1/holds/{id}` |
| `otcs_get_node_holds` | Get holds on a document | `GET /v1/nodes/{id}/holds` |
| `otcs_apply_hold` | Place a hold on a document | `POST /v1/nodes/{id}/holds` |
| `otcs_release_hold` | Remove hold from document | `DELETE /v1/nodes/{id}/holds/{hold_id}` |
| `otcs_get_hold_items` | List all items under a hold | `GET /v2/holditems/{id}` |

**Parameters for `otcs_create_hold`:**
```typescript
{
  name: string;                    // Hold name
  hold_type: string;               // 'Legal' | 'Administrative' | 'Audit'
  description?: string;
  start_date?: string;             // ISO date
  end_date?: string;               // ISO date
  custodian_id?: number;           // User ID of custodian
  matter_number?: string;          // Legal matter reference
}
```

**Agent Use Cases:**
- "Place a litigation hold on all Project Alpha documents"
- "Show all documents under the SEC Investigation hold"
- "Release the audit hold from these contracts"

---

### Category 16: Dispositions & Retention

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_dispositions` | List disposition searches | `GET /v2/dispositionscontainer/{id}` |
| `otcs_start_disp_search` | Start disposition search on node | `POST /v1/nodes/{id}/startdispsearch` |
| `otcs_get_disp_queue` | Get disposition queue items | `GET /v1/disposition/{id}/qdate/{qdate}` |
| `otcs_perform_disp_actions` | Execute disposition actions | `POST /v1/members/{id}/disposition/performactions` |
| `otcs_change_disp_actions` | Modify pending actions | `POST /v1/members/{id}/disposition/changeactions` |
| `otcs_finish_disp_review` | Complete disposition review | `POST /v1/members/{id}/disposition/finishreview` |
| `otcs_get_disp_snapshots` | Get disposition snapshots | `GET /v2/nodes/{id}/disposition-snapshots/qdate/{qdate}` |

**Agent Use Cases:**
- "What documents are due for disposition this month?"
- "Process the approved destructions for Q4"
- "Show the retention schedule for this record"

---

### Category 17: RSI (Record Series Identifiers) & Schedules

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_list_rsis` | List all RSI schedules | `GET /v2/rsis` |
| `otcs_get_rsi` | Get RSI details | `GET /v2/rsis/{id}` |
| `otcs_get_rsi_schedules` | Get schedules for an RSI | `GET /v2/rsischedules` |
| `otcs_get_schedule_details` | Get schedule stage details | `GET /v2/rsischedules/{id}/stages` |
| `otcs_approve_schedule` | Approve schedule stage | `POST /v2/rsischedules/{id}/approve/{stageId}` |
| `otcs_get_node_rsis` | Get RSIs assigned to node | `GET /v1/nodes/{id}/rsis` |
| `otcs_assign_rsi` | Assign RSI to node | `POST /v1/nodes/{id}/rmclassifications/{class_id}/rsis` |

**Agent Use Cases:**
- "What is the retention period for HR records?"
- "Show all RSIs pending approval"
- "Assign the 7-year financial retention to this invoice"

---

### Category 18: Cross-References

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_xrefs` | Get cross-references for a node | `GET /v1/nodes/{id}/xrefs` |
| `otcs_add_xref` | Add cross-reference link | `POST /v1/nodes/{id}/xrefs` |
| `otcs_remove_xref` | Remove cross-reference | `PUT /v1/nodes/{id}/xrefs` (with uniqueIDList) |
| `otcs_list_xref_types` | List available xref types | `GET /v1/xrefs` |

**Parameters for `otcs_add_xref`:**
```typescript
{
  node_id: number;                 // Source node
  xref_type: string;               // 'See Also' | 'Supersedes' | 'Related To' | etc.
  xref_id: number;                 // Target node ID
  comment?: string;                // Description of relationship
}
```

**Agent Use Cases:**
- "Link this amendment to the original contract"
- "Show all documents related to this case file"
- "This policy supersedes the 2023 version"

---

### Category 19: Security Clearance

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_security_clearance` | Get node security level | `GET /v1/nodes/{id}/securityclearances` |
| `otcs_set_security_clearance` | Set security level | `PUT /v1/nodes/{id}/securityclearances` |
| `otcs_get_user_clearance` | Get user's clearance level | `GET /v2/members/usersecurity/{userID}/securityclearancelevel` |
| `otcs_update_user_clearance` | Update user clearance | `POST /v1/UpdateSecurityClearanceLevel` |
| `otcs_get_clearance_levels` | List available levels | `GET /v1/securityclearances/settings` |
| `otcs_update_supplemental_markings` | Update markings | `POST /v1/UpdateSupplementalMarkings` |

**Security Levels (typical):**
- Unclassified
- Confidential
- Secret
- Top Secret

**Agent Use Cases:**
- "Set this document to Confidential"
- "What clearance level does John have?"
- "Add NOFORN marking to these documents"

---

### Category 20: Physical Objects & Circulation

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_get_po_metadata` | Get physical object properties | `GET /v1/pocirculation/pometadata` |
| `otcs_request_physical_item` | Request a physical item | `POST /v1/nodes/{id}/po_request` |
| `otcs_borrow_physical_item` | Check out physical item | `POST /v1/nodes/{id}/po_borrow` |
| `otcs_return_physical_item` | Return physical item | `POST /v1/nodes/{id}/po_return` |
| `otcs_get_borrowed_items` | List user's borrowed items | `GET /v2/members/borrowed` |
| `otcs_get_circulation_history` | Get item circulation history | `GET /v2/circulationhistory` |
| `otcs_flag_for_pickup` | Mark item ready for pickup | `POST /v1/nodes/{id}/po_flagforpickup` |
| `otcs_pass_item` | Pass item to another user | `POST /v1/nodes/{id}/po_pass` |

**Agent Use Cases:**
- "Request the original signed contract from the vault"
- "Who currently has the personnel file checked out?"
- "Return all physical items I borrowed"

---

### Category 21: Storage Management

| Tool | Purpose | API Operations |
|------|---------|----------------|
| `otcs_assign_box` | Assign item to storage box | `POST /v1/assignbox` |
| `otcs_assign_locator` | Assign storage location | `POST /v1/nodes/{id}/assign_locator` |
| `otcs_remove_locator` | Remove from location | `DELETE /v1/nodes/{id}/remove_locator` |
| `otcs_box_transfer` | Transfer box to new location | `POST /v1/boxtransfer` |
| `otcs_get_box_locators` | List box locations | `GET /v1/boxlocators` |
| `otcs_generate_labels` | Generate barcode labels | `POST /v1/nodes/{id}/generatelabels` |
| `otcs_get_labels` | Get existing labels | `GET /v1/nodes/{id}/labels` |

**Agent Use Cases:**
- "Move Box A-1234 to the offsite storage facility"
- "Generate barcode labels for these new files"
- "What's the location of the 2020 tax records?"

---

## Data Models

### NodeInfo (returned by most tools)
```typescript
interface NodeInfo {
  id: number;
  name: string;
  type: number;          // 0=folder, 144=document, 848=workspace
  type_name: string;
  parent_id: number;
  path: string[];        // Breadcrumb path
  description?: string;
  create_date: string;
  modify_date: string;
  size?: number;         // For documents
  mime_type?: string;    // For documents
  version?: number;      // Current version
  permissions: {
    can_see: boolean;
    can_modify: boolean;
    can_delete: boolean;
    can_add_items: boolean;
  };
  metadata?: Record<string, any>;  // Category values
}
```

### WorkspaceInfo (extended for workspaces)
```typescript
interface WorkspaceInfo extends NodeInfo {
  workspace_type_id: number;
  workspace_type_name: string;
  business_object?: {
    ext_system_id: string;
    bo_type: string;
    bo_id: string;
  };
  roles: RoleInfo[];
  related_count: number;
}
```

### SearchResult
```typescript
interface SearchResult {
  total_count: number;
  page: number;
  page_size: number;
  results: NodeInfo[];
  facets?: Record<string, FacetValue[]>;
}
```

---

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Session   │  │   Schema    │  │      Tool Registry       │ │
│  │   Manager   │  │   Cache     │  │  (40+ tool definitions)  │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                       │               │
│  ┌──────▼────────────────▼───────────────────────▼─────────────┐│
│  │                    Tool Handlers                             ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐││
│  │  │  Navigation │ │  Document   │ │  Workspace Management   │││
│  │  │   Tools     │ │  Operations │ │                         │││
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐││
│  │  │   Search    │ │  Metadata   │ │  Composite Operations   │││
│  │  │   Tools     │ │  Tools      │ │                         │││
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │                   OTCS API Client                            ││
│  │  - Request/Response handling                                 ││
│  │  - Authentication header injection                           ││
│  │  - Error transformation                                      ││
│  │  - Rate limiting                                             ││
│  └──────────────────────────┬──────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                OpenText Content Server                          │
│         (REST API v1/v2 + Business Workspaces API)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

```typescript
interface OTCSConfig {
  baseUrl: string;              // e.g., "https://cs.example.com/api"

  // Authentication options
  auth: {
    method: 'basic' | 'ticket' | 'oauth';
    username?: string;
    password?: string;
    domain?: string;
    ticket?: string;
  };

  // Behavior options
  options: {
    defaultPageSize: number;    // Default: 100
    maxRetries: number;         // Default: 3
    cacheSchemas: boolean;      // Default: true
    includePermissions: boolean; // Include perms in responses
  };
}
```

---

## Example Agent Workflows

### Workflow 1: Create and Populate a Project Workspace

```
Agent: "Create a new project workspace for Project Phoenix and upload the project charter"

1. otcs_get_workspace_types()
   → Find "Project" workspace type ID

2. otcs_get_workspace_form(template_id=<project_type_id>)
   → Get required fields schema

3. otcs_create_workspace({
     template_id: <id>,
     name: "Project Phoenix",
     roles: { categories: { <project_cat>: { status: "Active" }}}
   })
   → Returns workspace_id

4. otcs_upload_document({
     parent_id: <workspace_id>,
     name: "Project Charter.docx",
     file: <file_data>,
     categories: { document_type: "Charter" }
   })
   → Document created
```

### Workflow 2: Find and Update Contract Metadata

```
Agent: "Find all contracts expiring in Q1 and extend their expiration dates by 6 months"

1. otcs_search_workspaces({
     where_workspace_type_name: "Contract",
     where_column_query: "expiration_date < 2024-04-01 AND expiration_date >= 2024-01-01"
   })
   → List of matching contracts

2. For each contract:
   otcs_update_category({
     node_id: <contract_id>,
     category_id: <contract_cat>,
     values: { expiration_date: <new_date> }
   })
```

### Workflow 3: Summarize Workspace for Reporting

```
Agent: "Give me a summary of the Acme Corp customer workspace"

1. otcs_search_workspaces({ where_name: "contains_Acme Corp" })
   → Find workspace ID

2. otcs_summarize_workspace(workspace_id)
   → Returns:
   {
     workspace: { name, type, created, modified },
     team: { roles: [...], member_count: 12 },
     related: { projects: 3, contracts: 5 },
     recent_activity: [...last 10 documents],
     statistics: { total_docs: 156, pending_tasks: 4 }
   }
```

---

## Implementation Phases

### Phase 1: Foundation ✅
- Authentication tools
- Basic navigation (browse, get_node)
- Simple search
- Create folder/upload document
- Version management

### Phase 2: Business Workspaces ✅
- Workspace CRUD
- Workspace search
- Related items
- Role management

### Phase 3: Workflow & Assignments ✅
- Get user assignments (pending tasks)
- Workflow status queries (pending, late, active)
- Workflow initiation and draft processes
- Task actions (SendOn, Delegate, SendForReview)
- Workflow status changes (suspend, resume, stop, archive)
- Workflow activity history

### Phase 3a: Workflow Forms & Attributes ✅ Complete
- Get workflow task form schema (Alpaca forms)
- Get draft workflow form schema
- Update draft workflow form values (formUpdate action)
- Get comprehensive workflow info (forms, attributes, comments)
- Accept group-assigned workflow tasks
- Workflow form field name convention support
- Multi-value and set attribute handling

### Phase 4: Metadata & Categories ✅ Complete
- Category operations (list, get, add, update, remove)
- Form schema retrieval (get_form action) with nested set structure detection
- Workspace metadata/business properties updates
- **Nested Set Attribute Support:**
  - `CategoryAttribute` type includes `is_set`, `set_rows`, and `children` for nested structures
  - Automatic flattening of nested objects to API key format
  - Multi-value arrays sent as repeated form fields
  - Key format: `{category_id}_{set_id}_{row}_{attribute_id}`
- Consolidated into `otcs_categories` and `otcs_workspace_metadata` tools

### Phase 5: Permissions & User Management ✅ Complete
- Members (Users & Groups) operations: search, get, group membership
- Permission management: get, add, update, remove permissions
- Effective permissions for users on nodes
- Owner and public access permission updates
- Consolidated into `otcs_members`, `otcs_group_membership`, and `otcs_permissions` tools

**Tools Implemented:** 3 consolidated tools (previously 13 individual tools)

### Phase 6: Records Management - Core ✅ Complete (3 consolidated tools)

**Tool: `otcs_rm_classification`**
| Action | Description |
|--------|-------------|
| `browse_tree` | Browse RM classification tree (default: Classification Volume node 2046) |
| `get_node_classifications` | Get RM classifications applied to a node |
| `declare` | Apply RM classification (declare as record) |
| `undeclare` | Remove RM classification |
| `update_details` | Update record details (official, accession, etc.) |
| `make_confidential` | Mark record as confidential |
| `remove_confidential` | Remove confidential marking |
| `finalize` | Finalize records (single or batch) |

**Tool: `otcs_rm_holds`**
| Action | Description |
|--------|-------------|
| `list_holds` | List all holds in system |
| `get_hold` | Get hold details |
| `create_hold` | Create a new hold (Legal/Administrative) |
| `update_hold` | Update hold properties |
| `delete_hold` | Delete a hold |
| `get_node_holds` | Get holds on a specific node |
| `apply_hold` | Apply hold to a node |
| `remove_hold` | Remove hold from a node |
| `apply_batch` | Apply hold to multiple nodes |
| `remove_batch` | Remove hold from multiple nodes |
| `get_hold_items` | Get items under a hold |
| `get_hold_users` | Get users authorized for a hold |
| `add_hold_users` | Add users to hold |
| `remove_hold_users` | Remove users from hold |

**Tool: `otcs_rm_xref`**
| Action | Description |
|--------|-------------|
| `list_types` | List all cross-reference types |
| `get_type` | Get cross-reference type details |
| `create_type` | Create new cross-reference type |
| `delete_type` | Delete cross-reference type |
| `get_node_xrefs` | Get cross-references on a node |
| `apply` | Create cross-reference between nodes |
| `remove` | Remove cross-reference |
| `apply_batch` | Create multiple cross-references |
| `remove_batch` | Remove multiple cross-references |

### Phase 7: RSI Retention Schedules ✅ Complete (1 consolidated tool)

**Tool: `otcs_rm_rsi`**
| Action | Description |
|--------|-------------|
| `list` | List all RSI schedules |
| `get` | Get RSI details with schedules |
| `create` | Create new RSI |
| `update` | Update RSI metadata |
| `delete` | Delete RSI |
| `get_node_rsis` | Get RSIs assigned to a node |
| `assign` | Assign RSI to classified node |
| `remove` | Remove RSI from node |
| `get_items` | Get items with specific RSI |
| `get_schedules` | Get schedule stages for an RSI |
| `create_schedule` | Create new retention stage |
| `approve_schedule` | Approve RSI schedule stage |
| `get_approval_history` | Get schedule approval history |

### Phase 8: Records Management - Disposition (1 tool)

**Tool: `otcs_rm_disposition`**
| Action | Description |
|--------|-------------|
| `start_search` | Start disposition search |
| `get_results` | Get disposition search results |
| `change_decision` | Change review decision for items |
| `change_action` | Change disposition action for items |
| `perform_action` | Execute disposition action |
| `finish_review` | Complete reviewer's review |
| `apply_hold` | Apply hold to disposition items |
| `apply_accession` | Apply accession code to items |

### Phase 9: Enhanced Features (4 consolidated tools)

**Tool: `otcs_favorites`**
| Action | Description |
|--------|-------------|
| `list` | List user's favorites |
| `add` | Add node to favorites |
| `remove` | Remove from favorites |
| `update` | Update favorite (rename, reorder) |
| `list_tabs` | List favorite tabs |
| `add_tab` | Create favorites tab |
| `remove_tab` | Delete favorites tab |

**Tool: `otcs_reminders`**
| Action | Description |
|--------|-------------|
| `list` | Get reminders on a node |
| `create` | Create reminder on node |
| `update` | Update reminder details |
| `delete` | Delete reminder |

**Tool: `otcs_notifications`**
| Action | Description |
|--------|-------------|
| `get` | Get notification interests on node |
| `set` | Set notification interests |

**Tool: `otcs_recycle_bin`**
| Action | Description |
|--------|-------------|
| `list` | List items in recycle bin |
| `restore` | Restore items to original location |
| `purge` | Permanently delete items |

---

### Tool Count Summary

| Phase | Tools | Status |
|-------|-------|--------|
| 1-5 (Foundation through Permissions) | 33 | ✅ Complete |
| 6 (RM Core) | 3 | ✅ Complete |
| 7 (RSI Schedules) | 1 | ✅ Complete |
| 8 (RM Disposition) | 1 | Planned |
| 9 (Enhanced Features) | 4 | Planned |
| **Current Total** | **37** | |
| **Projected Total** | **42** | |

### API References

Phase 6-8 tools use the Records Management REST API:
- `docs/opentext-records-management-26.1.json`

Phase 9 tools use the Content Server REST API:
- `docs/content-server-rest-api-2.0.2.yaml`

---

## Technical Considerations

### Error Handling Strategy
```typescript
// Transform OTCS errors into actionable guidance
class OTCSError extends Error {
  code: string;
  suggestion: string;

  static fromResponse(response: OTCSResponse): OTCSError {
    // Map common errors to helpful suggestions
    if (response.status === 404) {
      return new OTCSError(
        "Node not found",
        "NOT_FOUND",
        "The item may have been deleted or moved. Try searching by name."
      );
    }
    // ... more mappings
  }
}
```

### Caching Strategy
- Cache workspace type definitions (changes rarely)
- Cache category schemas (changes rarely)
- Cache user permissions per session
- Don't cache node content (changes frequently)

### Rate Limiting
- Implement request queuing
- Respect server throttling headers
- Batch requests where possible

---

## File Structure

### Current Structure

```
otcs-mcp/
├── src/
│   ├── index.ts              # MCP server entry point (37 consolidated tools)
│   ├── types.ts              # TypeScript type definitions
│   └── client/
│       └── otcs-client.ts    # OTCS REST API client (CS + BW + RM APIs)
├── tests/
│   ├── test.ts               # Main API connectivity tests
│   ├── test-workflows.ts     # Workflow-specific tests
│   ├── test-workspaces.ts    # Workspace-specific tests
│   └── test-rm.ts            # Records Management tests (holds, classifications, xrefs)
├── docs/
│   ├── ARCHITECTURE_PLAN.md                              # This document
│   ├── content-server-rest-api-2.0.2.yaml                # Content Server REST API spec
│   ├── opentext-business-workspaces-rest-api-v1-and-v2.yaml  # Business Workspaces API spec
│   └── opentext-records-management-26.1.json             # Records Management API spec
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

### Implementation Notes

Records Management API methods have been integrated directly into `otcs-client.ts` alongside the Content Server and Business Workspaces APIs, maintaining a single unified client for all OTCS operations.

---

## Next Steps

### Completed
- ✅ Phases 1-5: Foundation, Workspaces, Workflows, Metadata, Permissions (33 tools)
- ✅ Phase 6: Records Management Core - Classifications, Holds, Cross-References (3 tools)
- ✅ RM Holds API tested and verified against live RM environment (create, apply, remove, delete holds)
- ✅ RM Classifications API tested and verified (declare, update_details, undeclare with metadataToken handling)
- ✅ RM Cross-References API tested and verified (list_types, apply, get_node_xrefs, remove)
- ✅ Phase 7: RSI Retention Schedules - Full RSI lifecycle (1 tool, 13 actions)
- ✅ RSI API tested: list, create, get, update, get_schedules, create_schedule, get_items, delete
- ✅ RSI API parsing fixed for PascalCase field names (RSIID, RSI, RSIStatus)
- ✅ RM Test Suite: 40 passed, 0 failed, 5 skipped

### Up Next
1. **Phase 8: RM Disposition** - Disposition search and processing (1 tool)
2. **Phase 9: Enhanced Features** - Favorites, reminders, notifications, recycle bin (4 tools)
3. **Iterate** - Refine based on real agent workflows

This architecture provides a solid foundation for building an intelligent document management agent that can reason about and operate on OpenText Content Server effectively.
