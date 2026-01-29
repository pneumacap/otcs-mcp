/**
 * Tool definitions for the 38 non-auth OTCS tools in Anthropic format.
 * Copied from src/index.ts (lines 124-805), minus otcs_authenticate, otcs_session_status, otcs_logout.
 */

import Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Tool;

export const OTCS_TOOLS: Tool[] = [
  // ==================== Navigation (3 tools) ====================
  {
    name: "otcs_get_node",
    description:
      "Get detailed information about a node (folder, document, workspace) by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "number", description: "The node ID" },
        include_path: {
          type: "boolean",
          description: "Include full path/breadcrumb",
        },
      },
      required: ["node_id"],
    },
  },
  {
    name: "otcs_browse",
    description:
      "List contents of a folder. Use folder_id=2000 for Enterprise Workspace root.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder_id: { type: "number", description: "Folder ID to browse" },
        page: { type: "number", description: "Page number (default: 1)" },
        page_size: {
          type: "number",
          description: "Items per page (default: 100, max: 500)",
        },
        filter_type: {
          type: "string",
          enum: ["folders", "documents", "all"],
          description: "Filter by type",
        },
        sort: {
          type: "string",
          description: 'Sort order (e.g., "name", "-modify_date")',
        },
      },
      required: ["folder_id"],
    },
  },
  {
    name: "otcs_search",
    description: `Enterprise search across the repository. Searches document content, names, descriptions, and metadata. Supports full-text search, exact phrases, and advanced query syntax.

**LQL Query Examples (use mode: "complexquery"):**
- Wildcards: "OTName:contract*" (names starting with contract), "OTName:*report*" (names containing report)
- Field queries: "OTName:invoice AND OTMIMEType:pdf" (PDF files named invoice)
- Date ranges: "OTObjectDate:[2024-01-01 TO 2024-12-31]" (items from 2024)
- Combined: "budget OTName:*.xlsx" (Excel files with "budget" in content)

**Filter Types:** Use filter_type to restrict results to specific object types (documents, folders, workspaces, workflows).`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Supports: keywords, exact phrases, wildcards, and field queries.",
        },
        filter_type: {
          type: "string",
          enum: ["all", "documents", "folders", "workspaces", "workflows"],
          description: "Filter results by object type",
        },
        mode: {
          type: "string",
          enum: ["allwords", "anywords", "exactphrase", "complexquery"],
          description: "Search mode",
        },
        search_in: {
          type: "string",
          enum: ["all", "content", "metadata"],
          description: "Where to search",
        },
        modifier: {
          type: "string",
          enum: [
            "synonymsof",
            "relatedto",
            "soundslike",
            "wordbeginswith",
            "wordendswith",
          ],
          description: "Expand search with related terms",
        },
        sort: {
          type: "string",
          enum: [
            "relevance",
            "desc_OTObjectDate",
            "asc_OTObjectDate",
            "desc_OTObjectSize",
            "asc_OTObjectSize",
            "asc_OTName",
            "desc_OTName",
          ],
          description: "Sort order",
        },
        include_facets: {
          type: "boolean",
          description: "Include facets for filtering",
        },
        include_highlights: {
          type: "boolean",
          description: "Include highlighted snippets",
        },
        limit: { type: "number", description: "Max results per page" },
        page: { type: "number", description: "Page number" },
      },
      required: ["query"],
    },
  },

  // ==================== Folders (1 tool) ====================
  {
    name: "otcs_create_folder",
    description:
      'Create a folder. Use "path" for nested folders (e.g., "2024/Q1/Reports").',
    input_schema: {
      type: "object" as const,
      properties: {
        parent_id: { type: "number", description: "Parent folder ID" },
        name: { type: "string", description: "Folder name" },
        path: {
          type: "string",
          description:
            'Optional: Create nested path (e.g., "2024/Q1/Reports")',
        },
        description: { type: "string", description: "Optional description" },
      },
      required: ["parent_id"],
    },
  },

  // ==================== Node Operations (1 tool) ====================
  {
    name: "otcs_node_action",
    description: "Perform action on a node: copy, move, rename, delete, or update_description.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["copy", "move", "rename", "delete", "update_description"],
          description: "Action to perform",
        },
        node_id: { type: "number", description: "Node ID" },
        destination_id: {
          type: "number",
          description: "Destination folder ID (for copy/move)",
        },
        new_name: {
          type: "string",
          description: "New name (for rename, or optional for copy)",
        },
        description: {
          type: "string",
          description: "New description text (for update_description)",
        },
      },
      required: ["action", "node_id"],
    },
  },

  // ==================== Documents (5 tools) ====================
  {
    name: "otcs_upload",
    description:
      "Upload a document. Provide either file_path (local file) OR content_base64 (base64 data).",
    input_schema: {
      type: "object" as const,
      properties: {
        parent_id: { type: "number", description: "Destination folder ID" },
        file_path: {
          type: "string",
          description: "Local file path to upload",
        },
        content_base64: {
          type: "string",
          description: "File content as base64",
        },
        name: { type: "string", description: "Document name" },
        mime_type: { type: "string", description: "MIME type" },
        description: { type: "string", description: "Optional description" },
      },
      required: ["parent_id"],
    },
  },
  {
    name: "otcs_download_content",
    description:
      "Download and read a document's content. For text-based documents (TXT, CSV, JSON, XML, HTML, Markdown), PDFs, and Word documents (.docx), returns the extracted text content that you can read and analyze. Use this tool to answer questions about document contents. For binary formats (images, spreadsheets, etc.), returns base64-encoded data.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "number", description: "Document node ID to read" },
      },
      required: ["node_id"],
    },
  },
  {
    name: "otcs_upload_folder",
    description:
      "Upload all files from a local folder to OpenText with parallel processing.",
    input_schema: {
      type: "object" as const,
      properties: {
        parent_id: {
          type: "number",
          description: "Destination folder ID in OpenText",
        },
        folder_path: {
          type: "string",
          description: "Local folder path to upload",
        },
        extensions: {
          type: "array",
          items: { type: "string" },
          description: "Filter by file extensions",
        },
        recursive: {
          type: "boolean",
          description: "Include subfolders",
        },
        concurrency: {
          type: "number",
          description: "Number of parallel uploads (default: 5)",
        },
        category_id: {
          type: "number",
          description: "Category ID to apply to all uploaded documents",
        },
        category_values: {
          type: "object",
          description: "Category attribute values",
        },
      },
      required: ["parent_id", "folder_path"],
    },
  },
  {
    name: "otcs_upload_batch",
    description: "Upload multiple specific files to OpenText.",
    input_schema: {
      type: "object" as const,
      properties: {
        parent_id: {
          type: "number",
          description: "Destination folder ID in OpenText",
        },
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Array of local file paths to upload",
        },
        concurrency: { type: "number", description: "Parallel uploads" },
        category_id: { type: "number", description: "Category ID to apply" },
        category_values: {
          type: "object",
          description: "Category attribute values",
        },
      },
      required: ["parent_id", "file_paths"],
    },
  },
  {
    name: "otcs_upload_with_metadata",
    description:
      "Upload a document and apply category/metadata in a single operation.",
    input_schema: {
      type: "object" as const,
      properties: {
        parent_id: { type: "number", description: "Destination folder ID" },
        file_path: { type: "string", description: "Local file path" },
        content_base64: { type: "string", description: "File content base64" },
        name: { type: "string", description: "Document name" },
        mime_type: { type: "string", description: "MIME type" },
        description: { type: "string", description: "Description" },
        category_id: { type: "number", description: "Category ID to apply" },
        category_values: {
          type: "object",
          description: "Category attribute values",
        },
        classification_id: {
          type: "number",
          description: "RM Classification ID",
        },
        workflow_id: {
          type: "number",
          description: "Workflow map ID to start after upload",
        },
      },
      required: ["parent_id"],
    },
  },

  // ==================== Versions (1 tool) ====================
  {
    name: "otcs_versions",
    description: "Manage document versions. Actions: list, add.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "add"],
          description: "Action to perform",
        },
        node_id: { type: "number", description: "Document ID" },
        file_path: {
          type: "string",
          description: "Local file path (for add)",
        },
        content_base64: { type: "string", description: "File content base64" },
        mime_type: { type: "string", description: "MIME type" },
        file_name: { type: "string", description: "File name" },
        description: { type: "string", description: "Version description" },
      },
      required: ["action", "node_id"],
    },
  },

  // ==================== Workspaces (4 tools) ====================
  {
    name: "otcs_workspace_types",
    description:
      "Get workspace types or form schema. Actions: list (types), get_form (creation form).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "get_form"],
          description: "Action",
        },
        template_id: {
          type: "number",
          description: "Template ID (for get_form)",
        },
      },
    },
  },
  {
    name: "otcs_create_workspace",
    description: "Create a business workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        template_id: {
          type: "number",
          description: "Workspace type/template ID",
        },
        name: { type: "string", description: "Workspace name" },
        parent_id: { type: "number", description: "Parent folder ID" },
        description: { type: "string", description: "Description" },
        business_properties: {
          type: "object",
          description: "Business properties",
        },
      },
      required: ["template_id", "name"],
    },
  },
  {
    name: "otcs_get_workspace",
    description: "Get workspace details or find workspace containing a node.",
    input_schema: {
      type: "object" as const,
      properties: {
        workspace_id: { type: "number", description: "Workspace ID" },
        find_for_node: {
          type: "number",
          description: "Find workspace containing this node ID",
        },
      },
    },
  },
  {
    name: "otcs_search_workspaces",
    description: "Search for business workspaces.",
    input_schema: {
      type: "object" as const,
      properties: {
        workspace_type_name: {
          type: "string",
          description: "Filter by type name",
        },
        workspace_type_id: {
          type: "number",
          description: "Filter by type ID",
        },
        where_name: { type: "string", description: "Search by name" },
        where_column_query: { type: "string", description: "Advanced query" },
        sort: { type: "string", description: "Sort order" },
        page: { type: "number", description: "Page number" },
        limit: { type: "number", description: "Results per page" },
      },
    },
  },

  // ==================== Workspace Relations (1 tool) ====================
  {
    name: "otcs_workspace_relations",
    description:
      "Manage workspace relations. Actions: list, add, remove.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "add", "remove"],
          description: "Action",
        },
        workspace_id: { type: "number", description: "Workspace ID" },
        related_workspace_id: {
          type: "number",
          description: "Related workspace ID (for add)",
        },
        relation_id: {
          type: "number",
          description: "Relation ID (for remove)",
        },
        relation_type: {
          type: "string",
          description: "Relation type (for add)",
        },
      },
      required: ["action", "workspace_id"],
    },
  },

  // ==================== Workspace Roles (1 tool) ====================
  {
    name: "otcs_workspace_roles",
    description:
      "Manage workspace roles and members. Actions: get_roles, get_members, get_role_members, add_member, remove_member.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "get_roles",
            "get_members",
            "get_role_members",
            "add_member",
            "remove_member",
          ],
          description: "Action",
        },
        workspace_id: { type: "number", description: "Workspace ID" },
        role_id: { type: "number", description: "Role ID" },
        member_id: { type: "number", description: "Member ID" },
      },
      required: ["action", "workspace_id"],
    },
  },

  // ==================== Workflows (10 tools) ====================
  {
    name: "otcs_get_assignments",
    description: "Get current user's pending workflow tasks.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "otcs_workflow_status",
    description: "Get workflows by status or search active workflows.",
    input_schema: {
      type: "object" as const,
      properties: {
        mode: {
          type: "string",
          enum: ["by_status", "active"],
          description: "Query mode",
        },
        status: {
          type: "string",
          enum: ["ontime", "workflowlate"],
          description: "Status filter",
        },
        kind: {
          type: "string",
          enum: ["initiated", "managed"],
          description: "Kind filter",
        },
        map_id: { type: "number", description: "Workflow map ID" },
        search_name: { type: "string", description: "Search by name" },
        business_workspace_id: {
          type: "number",
          description: "Filter by workspace",
        },
        start_date: { type: "string", description: "Start date yyyy-mm-dd" },
        end_date: { type: "string", description: "End date yyyy-mm-dd" },
      },
    },
  },
  {
    name: "otcs_workflow_definition",
    description: "Get workflow map definition.",
    input_schema: {
      type: "object" as const,
      properties: {
        map_id: { type: "number", description: "Workflow map ID" },
      },
      required: ["map_id"],
    },
  },
  {
    name: "otcs_workflow_tasks",
    description: "Get task list for a workflow instance.",
    input_schema: {
      type: "object" as const,
      properties: {
        process_id: {
          type: "number",
          description: "Workflow instance/process ID",
        },
      },
      required: ["process_id"],
    },
  },
  {
    name: "otcs_workflow_activities",
    description: "Get activity/audit history for a workflow.",
    input_schema: {
      type: "object" as const,
      properties: {
        process_id: {
          type: "number",
          description: "Workflow instance ID",
        },
        subprocess_id: { type: "number", description: "Subprocess ID" },
        limit: { type: "number", description: "Max activities to return" },
      },
      required: ["process_id", "subprocess_id"],
    },
  },
  {
    name: "otcs_start_workflow",
    description: "Start a workflow. Modes: direct, draft, initiate.",
    input_schema: {
      type: "object" as const,
      properties: {
        mode: {
          type: "string",
          enum: ["direct", "draft", "initiate"],
          description: "Start mode",
        },
        workflow_id: { type: "number", description: "Workflow map ID" },
        doc_ids: {
          type: "string",
          description: "Comma-separated document IDs to attach",
        },
        role_info: {
          type: "object",
          description: 'Role assignments: {"RoleName": userId}',
        },
        attach_documents: {
          type: "boolean",
          description: "Attach documents (for draft mode)",
        },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "otcs_workflow_form",
    description: "Get workflow task form schema with available actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        process_id: {
          type: "number",
          description: "Workflow instance ID",
        },
        subprocess_id: { type: "number", description: "Subprocess ID" },
        task_id: { type: "number", description: "Task ID" },
        detailed: {
          type: "boolean",
          description: "Include full Alpaca form schema",
        },
      },
      required: ["process_id", "subprocess_id", "task_id"],
    },
  },
  {
    name: "otcs_workflow_task",
    description:
      "Execute action on a workflow task. Actions: send, accept, check_group.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["send", "accept", "check_group"],
          description: "Action",
        },
        process_id: {
          type: "number",
          description: "Workflow instance ID",
        },
        subprocess_id: { type: "number", description: "Subprocess ID" },
        task_id: { type: "number", description: "Task ID" },
        disposition: {
          type: "string",
          enum: ["SendOn", "Delegate", "SendForReview"],
          description: "Standard disposition",
        },
        custom_action: {
          type: "string",
          description: "Custom disposition key",
        },
        comment: { type: "string", description: "Comment" },
        form_data: {
          type: "object",
          description: "Form field values",
        },
      },
      required: ["process_id", "subprocess_id", "task_id"],
    },
  },
  {
    name: "otcs_draft_workflow",
    description:
      "Manage draft workflow forms. Actions: get_form, update_form, initiate.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["get_form", "update_form", "initiate"],
          description: "Action",
        },
        draftprocess_id: {
          type: "number",
          description: "Draft process ID",
        },
        values: {
          type: "object",
          description: "Form values (for update_form)",
        },
        comment: { type: "string", description: "Comment (for initiate)" },
      },
      required: ["action", "draftprocess_id"],
    },
  },
  {
    name: "otcs_workflow_info",
    description:
      "Get comprehensive workflow information including attributes, comments, and step history.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_id: {
          type: "number",
          description: "Workflow instance ID (work_id)",
        },
      },
      required: ["work_id"],
    },
  },
  {
    name: "otcs_manage_workflow",
    description:
      "Manage workflow lifecycle. Actions: suspend, resume, stop, archive, delete.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["suspend", "resume", "stop", "archive", "delete"],
          description: "Action",
        },
        process_id: {
          type: "number",
          description: "Workflow instance ID",
        },
      },
      required: ["action", "process_id"],
    },
  },

  // ==================== Categories (2 tools) ====================
  {
    name: "otcs_categories",
    description:
      "Manage node categories/metadata. Actions: list, get, add, update, remove, get_form.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "get", "add", "update", "remove", "get_form"],
          description: "Action",
        },
        node_id: { type: "number", description: "Node ID" },
        category_id: { type: "number", description: "Category ID" },
        values: {
          type: "object",
          description: "Attribute values",
        },
        include_metadata: {
          type: "boolean",
          description: "Include attribute type info",
        },
        form_mode: {
          type: "string",
          enum: ["create", "update"],
          description: "Form mode (for get_form)",
        },
      },
      required: ["action", "node_id"],
    },
  },
  {
    name: "otcs_workspace_metadata",
    description:
      "Manage workspace business properties. Actions: get_form, update.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["get_form", "update"],
          description: "Action",
        },
        workspace_id: { type: "number", description: "Workspace ID" },
        values: { type: "object", description: "Values to update" },
      },
      required: ["action", "workspace_id"],
    },
  },

  // ==================== Members (2 tools) ====================
  {
    name: "otcs_members",
    description:
      "Search and get members (users/groups). Actions: search, get, get_user_groups, get_group_members.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["search", "get", "get_user_groups", "get_group_members"],
          description: "Action",
        },
        member_id: { type: "number", description: "Member ID (for get)" },
        user_id: {
          type: "number",
          description: "User ID (for get_user_groups)",
        },
        group_id: {
          type: "number",
          description: "Group ID (for get_group_members)",
        },
        type: {
          type: "number",
          enum: [0, 1],
          description: "0=users, 1=groups",
        },
        query: { type: "string", description: "Search query" },
        where_name: { type: "string", description: "Filter by login name" },
        where_first_name: {
          type: "string",
          description: "Filter by first name",
        },
        where_last_name: {
          type: "string",
          description: "Filter by last name",
        },
        where_business_email: {
          type: "string",
          description: "Filter by email",
        },
        sort: { type: "string", description: "Sort order" },
        limit: { type: "number", description: "Max results" },
        page: { type: "number", description: "Page number" },
      },
      required: ["action"],
    },
  },
  {
    name: "otcs_group_membership",
    description: "Add or remove members from groups.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "remove"],
          description: "Action",
        },
        group_id: { type: "number", description: "Group ID" },
        member_id: { type: "number", description: "User/group ID" },
      },
      required: ["action", "group_id", "member_id"],
    },
  },

  // ==================== Permissions (1 tool) ====================
  {
    name: "otcs_permissions",
    description:
      "Manage node permissions. Actions: get, add, update, remove, effective, set_owner, set_public.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "get",
            "add",
            "update",
            "remove",
            "effective",
            "set_owner",
            "set_public",
          ],
          description: "Action",
        },
        node_id: { type: "number", description: "Node ID" },
        right_id: { type: "number", description: "User/group ID" },
        member_id: { type: "number", description: "Alias for right_id" },
        permissions: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "see",
              "see_contents",
              "modify",
              "edit_attributes",
              "add_items",
              "reserve",
              "add_major_version",
              "delete_versions",
              "delete",
              "edit_permissions",
            ],
          },
          description: "Permission strings to grant",
        },
        apply_to: {
          type: "number",
          enum: [0, 1, 2, 3],
          description:
            "0=This Item, 1=Sub-Items, 2=This & Sub, 3=Immediate Children",
        },
      },
      required: ["action", "node_id"],
    },
  },

  // ==================== Records Management (4 tools) ====================
  {
    name: "otcs_rm_classification",
    description:
      "Manage Records Management classifications. Actions: browse_tree, get_node_classifications, declare, undeclare, update_details, make_confidential, remove_confidential, finalize.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "browse_tree",
            "get_node_classifications",
            "declare",
            "undeclare",
            "update_details",
            "make_confidential",
            "remove_confidential",
            "finalize",
          ],
          description: "Action to perform",
        },
        node_id: { type: "number", description: "Node ID" },
        node_ids: {
          type: "array",
          items: { type: "number" },
          description: "Array of node IDs (for finalize batch)",
        },
        classification_id: {
          type: "number",
          description: "Classification ID (for declare)",
        },
        name: { type: "string", description: "Updated record name" },
        official: { type: "boolean", description: "Mark as official record" },
        storage: { type: "string", description: "Storage location" },
        accession: { type: "string", description: "Accession number" },
        subject: { type: "string", description: "Subject keywords" },
        rsi_data: {
          type: "object",
          description: "RSI-specific data",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "otcs_rm_holds",
    description:
      "Manage Legal and Administrative Holds. Actions: list_holds, get_hold, create_hold, update_hold, delete_hold, get_node_holds, apply_hold, remove_hold, apply_batch, remove_batch, get_hold_items, get_hold_users, add_hold_users, remove_hold_users.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "list_holds",
            "get_hold",
            "create_hold",
            "update_hold",
            "delete_hold",
            "get_node_holds",
            "apply_hold",
            "remove_hold",
            "apply_batch",
            "remove_batch",
            "get_hold_items",
            "get_hold_users",
            "add_hold_users",
            "remove_hold_users",
          ],
          description: "Action to perform",
        },
        hold_id: { type: "number", description: "Hold ID" },
        node_id: { type: "number", description: "Node ID" },
        node_ids: {
          type: "array",
          items: { type: "number" },
          description: "Array of node IDs",
        },
        user_ids: {
          type: "array",
          items: { type: "number" },
          description: "Array of user IDs",
        },
        name: { type: "string", description: "Hold name" },
        hold_type: {
          type: "string",
          enum: ["Legal", "Administrative"],
          description: "Hold type",
        },
        comment: { type: "string", description: "Comment" },
        alternate_id: { type: "string", description: "Alternate ID" },
        date_to_release: {
          type: "string",
          description: "Planned release date yyyy-mm-dd",
        },
        include_child: {
          type: "boolean",
          description: "Include children when applying hold",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "otcs_rm_xref",
    description:
      "Manage RM Cross-References. Actions: list_types, get_type, create_type, delete_type, get_node_xrefs, apply, remove, apply_batch, remove_batch.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "list_types",
            "get_type",
            "create_type",
            "delete_type",
            "get_node_xrefs",
            "apply",
            "remove",
            "apply_batch",
            "remove_batch",
          ],
          description: "Action to perform",
        },
        type_name: { type: "string", description: "Cross-reference type name" },
        node_id: { type: "number", description: "Source node ID" },
        target_node_id: { type: "number", description: "Target node ID" },
        node_ids: {
          type: "array",
          items: { type: "number" },
          description: "Source node IDs (batch)",
        },
        target_node_ids: {
          type: "array",
          items: { type: "number" },
          description: "Target node IDs (batch)",
        },
        name: { type: "string", description: "Type name (for create)" },
        reciprocal_name: {
          type: "string",
          description: "Reciprocal type name",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "otcs_rm_rsi",
    description:
      "Manage RSI retention schedules. Actions: list, get, create, update, delete, get_node_rsis, assign, remove, get_items, get_schedules, create_schedule, approve_schedule, get_approval_history.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "list",
            "get",
            "create",
            "update",
            "delete",
            "get_node_rsis",
            "assign",
            "remove",
            "get_items",
            "get_schedules",
            "create_schedule",
            "approve_schedule",
            "get_approval_history",
          ],
          description: "Action to perform",
        },
        rsi_id: { type: "number", description: "RSI ID" },
        node_id: { type: "number", description: "Node ID" },
        class_id: { type: "number", description: "Classification ID" },
        stage_id: { type: "number", description: "Schedule stage ID" },
        name: { type: "string", description: "RSI name" },
        new_name: { type: "string", description: "New RSI name" },
        status: { type: "string", description: "RSI status" },
        status_date: { type: "string", description: "Status date yyyy-mm-dd" },
        description: { type: "string", description: "RSI description" },
        subject: { type: "string", description: "RSI subject" },
        title: { type: "string", description: "RSI title" },
        disp_control: {
          type: "boolean",
          description: "Under disposition control",
        },
        discontinue: { type: "boolean", description: "Discontinue RSI" },
        discontinue_date: { type: "string", description: "Discontinue date" },
        discontinue_comment: {
          type: "string",
          description: "Discontinue comment",
        },
        stage: { type: "string", description: "Retention stage name" },
        object_type: {
          type: "string",
          enum: ["LIV", "LRM"],
          description: "Object type",
        },
        event_type: { type: "number", description: "Event type" },
        date_to_use: { type: "number", description: "Date to use" },
        retention_years: { type: "number", description: "Years to retain" },
        retention_months: { type: "number", description: "Months to retain" },
        retention_days: { type: "number", description: "Days to retain" },
        action_code: { type: "number", description: "Action code" },
        disposition: { type: "string", description: "Disposition action" },
        comment: { type: "string", description: "Approval comment" },
        page: { type: "number", description: "Page number" },
        limit: { type: "number", description: "Results per page" },
      },
      required: ["action"],
    },
  },

  // ==================== Sharing (1 tool) ====================
  {
    name: "otcs_share",
    description:
      "Manage document sharing. Actions: list, create, stop, stop_batch.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "create", "stop", "stop_batch"],
          description: "Action to perform",
        },
        node_ids: {
          type: "array",
          items: { type: "number" },
          description: "Node IDs to share (for create/stop_batch)",
        },
        invitees: {
          type: "array",
          description:
            "Array of invitees with email and permissions (for create)",
          items: {
            type: "object",
            properties: {
              business_email: {
                type: "string",
                description: "Email address",
              },
              perm: {
                type: "number",
                enum: [1, 2, 3, 4],
                description:
                  "1=Viewer, 2=Collaborator, 3=Manager, 4=Owner",
              },
              name: { type: "string", description: "Display name" },
            },
            required: ["business_email", "perm"],
          },
        },
        expire_date: {
          type: "string",
          description: "Expiration date yyyy-mm-dd",
        },
        share_initiator_role: {
          type: "number",
          enum: [1, 2, 3, 4],
          description: "Initiator permission level",
        },
        sharing_message: {
          type: "string",
          description: "Message with share notification",
        },
        coordinators: {
          type: "array",
          items: { type: "number" },
          description: "CS user IDs who can modify share config",
        },
        node_id: {
          type: "number",
          description: "Node ID to stop sharing (for stop)",
        },
      },
      required: ["action"],
    },
  },
];
