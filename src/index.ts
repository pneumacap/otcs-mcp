#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { OTCSClient } from './client/otcs-client.js';
import { NodeTypes, NodeInfo, FolderContents } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize OTCS client with environment configuration
const config = {
  baseUrl: process.env.OTCS_BASE_URL || 'https://vm-geliopou.eimdemo.com/otcs/cs.exe/api',
  username: process.env.OTCS_USERNAME,
  password: process.env.OTCS_PASSWORD,
  domain: process.env.OTCS_DOMAIN,
};

const client = new OTCSClient(config);

// ============ Tool Profile System ============

const TOOL_PROFILES: Record<string, string[]> = {
  core: [
    'otcs_authenticate', 'otcs_session_status',
    'otcs_get_node', 'otcs_browse', 'otcs_search',
    'otcs_create_folder', 'otcs_node_action',
    'otcs_upload', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace',
    'otcs_get_assignments', 'otcs_workflow_form', 'otcs_workflow_task',
    'otcs_members', 'otcs_permissions', 'otcs_categories',
  ],
  workflow: [
    // Core tools plus full workflow support
    'otcs_authenticate', 'otcs_session_status',
    'otcs_get_node', 'otcs_browse', 'otcs_search',
    'otcs_create_folder', 'otcs_node_action',
    'otcs_upload', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace', 'otcs_workspace_types',
    'otcs_get_assignments', 'otcs_workflow_status', 'otcs_workflow_definition',
    'otcs_workflow_tasks', 'otcs_workflow_activities', 'otcs_workflow_form',
    'otcs_workflow_task', 'otcs_start_workflow', 'otcs_draft_workflow',
    'otcs_workflow_info', 'otcs_manage_workflow',
    'otcs_members', 'otcs_permissions', 'otcs_categories',
  ],
  admin: [
    // Core tools plus admin/permission management
    'otcs_authenticate', 'otcs_session_status', 'otcs_logout',
    'otcs_get_node', 'otcs_browse', 'otcs_search',
    'otcs_create_folder', 'otcs_node_action',
    'otcs_upload', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace', 'otcs_create_workspace',
    'otcs_workspace_types', 'otcs_workspace_relations', 'otcs_workspace_roles',
    'otcs_get_assignments', 'otcs_workflow_form', 'otcs_workflow_task',
    'otcs_members', 'otcs_group_membership',
    'otcs_permissions', 'otcs_categories', 'otcs_workspace_metadata',
  ],
};

function getEnabledTools(allTools: Tool[]): Tool[] {
  const profile = process.env.OTCS_TOOL_PROFILE || 'full';

  if (profile === 'full') {
    return allTools;
  }

  const enabledNames = TOOL_PROFILES[profile];
  if (!enabledNames) {
    console.error(`Unknown profile "${profile}", using full`);
    return allTools;
  }

  return allTools.filter(t => enabledNames.includes(t.name));
}

// ============ Consolidated Tool Definitions ============

const allTools: Tool[] = [
  // ==================== Authentication (3 tools) ====================
  {
    name: 'otcs_authenticate',
    description: 'Authenticate with OpenText Content Server. Uses environment credentials (OTCS_USERNAME, OTCS_PASSWORD) if not provided.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Login username (optional if env var set)' },
        password: { type: 'string', description: 'Login password (optional if env var set)' },
        domain: { type: 'string', description: 'Optional login domain' },
      },
    },
  },
  {
    name: 'otcs_session_status',
    description: 'Check if the current session is valid and authenticated.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'otcs_logout',
    description: 'End the current authenticated session.',
    inputSchema: { type: 'object', properties: {} },
  },

  // ==================== Navigation (3 tools) ====================
  {
    name: 'otcs_get_node',
    description: 'Get detailed information about a node (folder, document, workspace) by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'number', description: 'The node ID' },
        include_path: { type: 'boolean', description: 'Include full path/breadcrumb', default: false },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'otcs_browse',
    description: 'List contents of a folder. Use folder_id=2000 for Enterprise Workspace root.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'number', description: 'Folder ID to browse' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        page_size: { type: 'number', description: 'Items per page (default: 100, max: 500)' },
        filter_type: { type: 'string', enum: ['folders', 'documents', 'all'], description: 'Filter by type' },
        sort: { type: 'string', description: 'Sort order (e.g., "name", "-modify_date")' },
      },
      required: ['folder_id'],
    },
  },
  {
    name: 'otcs_search',
    description: 'Search for nodes by name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        location_id: { type: 'number', description: 'Optional folder ID to search within' },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
      required: ['query'],
    },
  },

  // ==================== Folders (1 consolidated tool) ====================
  {
    name: 'otcs_create_folder',
    description: 'Create a folder. Use "path" for nested folders (e.g., "2024/Q1/Reports").',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'number', description: 'Parent folder ID' },
        name: { type: 'string', description: 'Folder name (or first folder if using path)' },
        path: { type: 'string', description: 'Optional: Create nested path (e.g., "2024/Q1/Reports"). If provided, "name" is ignored.' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['parent_id'],
    },
  },

  // ==================== Node Operations (1 consolidated tool) ====================
  {
    name: 'otcs_node_action',
    description: 'Perform action on a node: copy, move, rename, or delete.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['copy', 'move', 'rename', 'delete'], description: 'Action to perform' },
        node_id: { type: 'number', description: 'Node ID' },
        destination_id: { type: 'number', description: 'Destination folder ID (for copy/move)' },
        new_name: { type: 'string', description: 'New name (for rename, or optional for copy)' },
      },
      required: ['action', 'node_id'],
    },
  },

  // ==================== Documents (2 tools) ====================
  {
    name: 'otcs_upload',
    description: 'Upload a document. Provide either file_path (local file) OR content_base64 (base64 data).',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'number', description: 'Destination folder ID' },
        file_path: { type: 'string', description: 'Local file path to upload' },
        content_base64: { type: 'string', description: 'File content as base64 (alternative to file_path)' },
        name: { type: 'string', description: 'Document name (required if using content_base64)' },
        mime_type: { type: 'string', description: 'MIME type (auto-detected for file_path)' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['parent_id'],
    },
  },
  {
    name: 'otcs_download_content',
    description: 'Download document content as base64.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'number', description: 'Document ID' },
      },
      required: ['node_id'],
    },
  },

  // ==================== Versions (1 consolidated tool) ====================
  {
    name: 'otcs_versions',
    description: 'Manage document versions. Actions: list, add.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add'], description: 'Action to perform' },
        node_id: { type: 'number', description: 'Document ID' },
        content_base64: { type: 'string', description: 'New version content as base64 (for add)' },
        mime_type: { type: 'string', description: 'MIME type (for add)' },
        file_name: { type: 'string', description: 'File name (for add)' },
        description: { type: 'string', description: 'Version description (for add)' },
      },
      required: ['action', 'node_id'],
    },
  },

  // ==================== Workspaces (4 tools) ====================
  {
    name: 'otcs_workspace_types',
    description: 'Get workspace types or form schema. Actions: list (types), get_form (creation form).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get_form'], description: 'Action', default: 'list' },
        template_id: { type: 'number', description: 'Template ID (required for get_form)' },
      },
    },
  },
  {
    name: 'otcs_create_workspace',
    description: 'Create a business workspace. Business properties (category attributes) are automatically applied after creation. Property keys must be in format {category_id}_{attribute_id} (e.g., "11150_28" for Customer Number).',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'number', description: 'Workspace type/template ID' },
        name: { type: 'string', description: 'Workspace name' },
        parent_id: { type: 'number', description: 'Optional parent folder ID' },
        description: { type: 'string', description: 'Optional description' },
        business_properties: { type: 'object', description: 'Optional business properties keyed as {category_id}_{attribute_id}. These are applied after workspace creation via category update.' },
      },
      required: ['template_id', 'name'],
    },
  },
  {
    name: 'otcs_get_workspace',
    description: 'Get workspace details. Optionally find the workspace containing a node.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'number', description: 'Workspace ID' },
        find_for_node: { type: 'number', description: 'Alternative: Find workspace containing this node ID' },
      },
    },
  },
  {
    name: 'otcs_search_workspaces',
    description: 'Search for business workspaces.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_type_name: { type: 'string', description: 'Filter by type name (e.g., "Customer")' },
        workspace_type_id: { type: 'number', description: 'Filter by type ID' },
        where_name: { type: 'string', description: 'Search by name (use "contains_" prefix for partial)' },
        where_column_query: { type: 'string', description: 'Advanced query on business properties' },
        sort: { type: 'string', description: 'Sort order' },
        page: { type: 'number', description: 'Page number' },
        limit: { type: 'number', description: 'Results per page (default: 100)' },
      },
    },
  },

  // ==================== Workspace Relations (1 consolidated tool) ====================
  {
    name: 'otcs_workspace_relations',
    description: 'Manage workspace relations. Actions: list, add, remove.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'remove'], description: 'Action' },
        workspace_id: { type: 'number', description: 'Workspace ID' },
        related_workspace_id: { type: 'number', description: 'Related workspace ID (for add)' },
        relation_id: { type: 'number', description: 'Relation ID (for remove)' },
        relation_type: { type: 'string', description: 'Relation type (for add)' },
      },
      required: ['action', 'workspace_id'],
    },
  },

  // ==================== Workspace Roles (1 consolidated tool) ====================
  {
    name: 'otcs_workspace_roles',
    description: 'Manage workspace roles and members. Actions: get_roles, get_members, get_role_members, add_member, remove_member.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get_roles', 'get_members', 'get_role_members', 'add_member', 'remove_member'], description: 'Action' },
        workspace_id: { type: 'number', description: 'Workspace ID' },
        role_id: { type: 'number', description: 'Role ID (for role_members/add/remove)' },
        member_id: { type: 'number', description: 'Member ID (for add/remove)' },
      },
      required: ['action', 'workspace_id'],
    },
  },

  // ==================== Workflows (10 tools - kept more granular for clarity) ====================
  {
    name: 'otcs_get_assignments',
    description: 'Get current user\'s pending workflow tasks.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'otcs_workflow_status',
    description: 'Get workflows by status or search active workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['by_status', 'active'], description: 'Query mode', default: 'by_status' },
        status: { type: 'string', enum: ['ontime', 'workflowlate'], description: 'Status filter (for by_status)' },
        kind: { type: 'string', enum: ['initiated', 'managed'], description: 'Kind filter (for by_status)' },
        map_id: { type: 'number', description: 'Workflow map ID (for active)' },
        search_name: { type: 'string', description: 'Search by name (for active)' },
        business_workspace_id: { type: 'number', description: 'Filter by workspace (for active)' },
        start_date: { type: 'string', description: 'Start date yyyy-mm-dd (for active)' },
        end_date: { type: 'string', description: 'End date yyyy-mm-dd (for active)' },
      },
    },
  },
  {
    name: 'otcs_workflow_definition',
    description: 'Get workflow map definition.',
    inputSchema: {
      type: 'object',
      properties: {
        map_id: { type: 'number', description: 'Workflow map ID' },
      },
      required: ['map_id'],
    },
  },
  {
    name: 'otcs_workflow_tasks',
    description: 'Get task list for a workflow instance.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: { type: 'number', description: 'Workflow instance/process ID' },
      },
      required: ['process_id'],
    },
  },
  {
    name: 'otcs_workflow_activities',
    description: 'Get activity/audit history for a workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: { type: 'number', description: 'Workflow instance ID' },
        subprocess_id: { type: 'number', description: 'Subprocess ID (usually same as process_id)' },
        limit: { type: 'number', description: 'Max activities to return' },
      },
      required: ['process_id', 'subprocess_id'],
    },
  },
  {
    name: 'otcs_start_workflow',
    description: 'Start a workflow. Modes: direct (immediate start), draft (create draft first), initiate (with role assignments).',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['direct', 'draft', 'initiate'], description: 'Start mode', default: 'direct' },
        workflow_id: { type: 'number', description: 'Workflow map ID' },
        doc_ids: { type: 'string', description: 'Comma-separated document IDs to attach' },
        role_info: { type: 'object', description: 'Role assignments for initiate mode: {"RoleName": userId}' },
        attach_documents: { type: 'boolean', description: 'Attach documents (for draft mode)', default: true },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'otcs_workflow_form',
    description: 'Get workflow task form schema with available actions.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: { type: 'number', description: 'Workflow instance ID' },
        subprocess_id: { type: 'number', description: 'Subprocess ID' },
        task_id: { type: 'number', description: 'Task ID' },
        detailed: { type: 'boolean', description: 'Include full Alpaca form schema with field definitions', default: false },
      },
      required: ['process_id', 'subprocess_id', 'task_id'],
    },
  },
  {
    name: 'otcs_workflow_task',
    description: 'Execute action on a workflow task. Actions: send (complete/approve), accept (accept group task), check_group (check if group assigned).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['send', 'accept', 'check_group'], description: 'Action', default: 'send' },
        process_id: { type: 'number', description: 'Workflow instance ID' },
        subprocess_id: { type: 'number', description: 'Subprocess ID' },
        task_id: { type: 'number', description: 'Task ID' },
        disposition: { type: 'string', enum: ['SendOn', 'Delegate', 'SendForReview'], description: 'Standard disposition (for send)' },
        custom_action: { type: 'string', description: 'Custom disposition key (for send)' },
        comment: { type: 'string', description: 'Comment (for send)' },
        form_data: { type: 'object', description: 'Form field values (for send)' },
      },
      required: ['process_id', 'subprocess_id', 'task_id'],
    },
  },
  {
    name: 'otcs_draft_workflow',
    description: 'Manage draft workflow forms. Actions: get_form, update_form, initiate.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get_form', 'update_form', 'initiate'], description: 'Action' },
        draftprocess_id: { type: 'number', description: 'Draft process ID' },
        values: { type: 'object', description: 'Form values (for update_form)' },
        comment: { type: 'string', description: 'Comment (for initiate)' },
      },
      required: ['action', 'draftprocess_id'],
    },
  },
  {
    name: 'otcs_workflow_info',
    description: 'Get comprehensive workflow information including attributes, comments, and step history.',
    inputSchema: {
      type: 'object',
      properties: {
        work_id: { type: 'number', description: 'Workflow instance ID (work_id)' },
      },
      required: ['work_id'],
    },
  },
  {
    name: 'otcs_manage_workflow',
    description: 'Manage workflow lifecycle. Actions: suspend, resume, stop, archive, delete.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['suspend', 'resume', 'stop', 'archive', 'delete'], description: 'Action' },
        process_id: { type: 'number', description: 'Workflow instance ID' },
      },
      required: ['action', 'process_id'],
    },
  },

  // ==================== Categories (2 consolidated tools) ====================
  {
    name: 'otcs_categories',
    description: 'Manage node categories/metadata. Actions: list, get, add, update, remove, get_form.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'add', 'update', 'remove', 'get_form'], description: 'Action' },
        node_id: { type: 'number', description: 'Node ID' },
        category_id: { type: 'number', description: 'Category ID (for get/add/update/remove/get_form)' },
        values: { type: 'object', description: 'Attribute values keyed as {category_id}_{attribute_id} (for add/update)' },
        include_metadata: { type: 'boolean', description: 'Include attribute type info (for list/get)' },
        form_mode: { type: 'string', enum: ['create', 'update'], description: 'Form mode (for get_form)', default: 'create' },
      },
      required: ['action', 'node_id'],
    },
  },
  {
    name: 'otcs_workspace_metadata',
    description: 'Manage workspace business properties. Actions: get_form, update.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get_form', 'update'], description: 'Action' },
        workspace_id: { type: 'number', description: 'Workspace ID' },
        values: { type: 'object', description: 'Values keyed as {category_id}_{attribute_id} (for update)' },
      },
      required: ['action', 'workspace_id'],
    },
  },

  // ==================== Members (2 consolidated tools) ====================
  {
    name: 'otcs_members',
    description: 'Search and get members (users/groups). Actions: search, get, get_user_groups, get_group_members.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'get', 'get_user_groups', 'get_group_members'], description: 'Action' },
        member_id: { type: 'number', description: 'Member ID (for get)' },
        user_id: { type: 'number', description: 'User ID (for get_user_groups)' },
        group_id: { type: 'number', description: 'Group ID (for get_group_members)' },
        type: { type: 'number', enum: [0, 1], description: 'Member type: 0=users, 1=groups (for search)' },
        query: { type: 'string', description: 'Search query (for search)' },
        where_name: { type: 'string', description: 'Filter by login name (for search)' },
        where_first_name: { type: 'string', description: 'Filter by first name (for search)' },
        where_last_name: { type: 'string', description: 'Filter by last name (for search)' },
        where_business_email: { type: 'string', description: 'Filter by email (for search)' },
        sort: { type: 'string', description: 'Sort order' },
        limit: { type: 'number', description: 'Max results', default: 100 },
        page: { type: 'number', description: 'Page number', default: 1 },
      },
      required: ['action'],
    },
  },
  {
    name: 'otcs_group_membership',
    description: 'Add or remove members from groups. Actions: add, remove.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add', 'remove'], description: 'Action' },
        group_id: { type: 'number', description: 'Group ID' },
        member_id: { type: 'number', description: 'User/group ID to add or remove' },
      },
      required: ['action', 'group_id', 'member_id'],
    },
  },

  // ==================== Permissions (1 consolidated tool) ====================
  {
    name: 'otcs_permissions',
    description: 'Manage node permissions. Actions: get, add, update, remove, effective, set_owner, set_public.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'add', 'update', 'remove', 'effective', 'set_owner', 'set_public'], description: 'Action' },
        node_id: { type: 'number', description: 'Node ID' },
        right_id: { type: 'number', description: 'User/group ID (for add/update/remove/effective/set_owner)' },
        member_id: { type: 'number', description: 'Alias for right_id (for effective)' },
        permissions: {
          type: 'array',
          items: { type: 'string', enum: ['see', 'see_contents', 'modify', 'edit_attributes', 'add_items', 'reserve', 'add_major_version', 'delete_versions', 'delete', 'edit_permissions'] },
          description: 'Permission strings to grant',
        },
        apply_to: { type: 'number', enum: [0, 1, 2, 3], description: '0=This Item, 1=Sub-Items, 2=This & Sub, 3=Immediate Children' },
      },
      required: ['action', 'node_id'],
    },
  },
];

// ============ Tool Handler ============

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // ==================== Authentication ====================
    case 'otcs_authenticate': {
      const { username, password, domain } = args as { username?: string; password?: string; domain?: string };
      const ticket = await client.authenticate(username, password, domain);
      return { success: true, message: 'Authentication successful', ticket_preview: ticket.substring(0, 20) + '...' };
    }

    case 'otcs_session_status': {
      const isValid = await client.validateSession();
      return { authenticated: isValid, has_ticket: client.isAuthenticated() };
    }

    case 'otcs_logout': {
      await client.logout();
      return { success: true, message: 'Logged out successfully' };
    }

    // ==================== Navigation ====================
    case 'otcs_get_node': {
      const { node_id, include_path } = args as { node_id: number; include_path?: boolean };
      if (include_path) {
        const { node, ancestors } = await client.getNodeWithAncestors(node_id);
        return { ...node, path: ancestors.map(a => a.name), ancestors: ancestors.map(a => ({ id: a.id, name: a.name })) };
      }
      return await client.getNode(node_id);
    }

    case 'otcs_browse': {
      const { folder_id, page, page_size, filter_type, sort } = args as {
        folder_id: number; page?: number; page_size?: number; filter_type?: string; sort?: string;
      };
      let where_type: number[] | undefined;
      if (filter_type === 'folders') where_type = [NodeTypes.FOLDER];
      else if (filter_type === 'documents') where_type = [NodeTypes.DOCUMENT];
      return await client.getSubnodes(folder_id, { page: page || 1, limit: page_size || 100, sort, where_type });
    }

    case 'otcs_search': {
      const { query, location_id, limit } = args as { query: string; location_id?: number; limit?: number };
      return await client.searchNodes(query, { location: location_id, limit: limit || 50 });
    }

    // ==================== Folders ====================
    case 'otcs_create_folder': {
      const { parent_id, name, path: folderPath, description } = args as {
        parent_id: number; name?: string; path?: string; description?: string;
      };
      if (folderPath) {
        const result = await client.createFolderPath(parent_id, folderPath);
        return { success: true, folders_created: result.folders, leaf_folder_id: result.leafId, message: `Folder path "${folderPath}" created. Leaf ID: ${result.leafId}` };
      }
      if (!name) throw new Error('Either "name" or "path" is required');
      const result = await client.createFolder(parent_id, name, description);
      return { success: true, folder: result, message: `Folder "${name}" created with ID ${result.id}` };
    }

    // ==================== Node Operations ====================
    case 'otcs_node_action': {
      const { action, node_id, destination_id, new_name } = args as {
        action: string; node_id: number; destination_id?: number; new_name?: string;
      };
      switch (action) {
        case 'copy':
          if (!destination_id) throw new Error('destination_id required for copy');
          const copied = await client.copyNode(node_id, destination_id, new_name);
          return { success: true, new_node: copied, message: `Node copied. New ID: ${copied.id}` };
        case 'move':
          if (!destination_id) throw new Error('destination_id required for move');
          const moved = await client.moveNode(node_id, destination_id);
          return { success: true, node: moved, message: `Node ${node_id} moved to ${destination_id}` };
        case 'rename':
          if (!new_name) throw new Error('new_name required for rename');
          const renamed = await client.renameNode(node_id, new_name);
          return { success: true, node: renamed, message: `Node renamed to "${new_name}"` };
        case 'delete':
          await client.deleteNode(node_id);
          return { success: true, message: `Node ${node_id} deleted` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Documents ====================
    case 'otcs_upload': {
      const { parent_id, file_path: filePath, content_base64, name, mime_type, description } = args as {
        parent_id: number; file_path?: string; content_base64?: string; name?: string; mime_type?: string; description?: string;
      };

      let buffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (filePath) {
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        buffer = fs.readFileSync(filePath);
        fileName = name || path.basename(filePath);
        mimeType = mime_type || getMimeType(filePath);
      } else if (content_base64) {
        if (!name) throw new Error('name required when using content_base64');
        buffer = Buffer.from(content_base64, 'base64');
        fileName = name;
        mimeType = mime_type || 'application/octet-stream';
      } else {
        throw new Error('Either file_path or content_base64 is required');
      }

      const result = await client.uploadDocument(parent_id, fileName, buffer, mimeType, description);
      return { success: true, document: result, message: `"${fileName}" uploaded with ID ${result.id}`, size_bytes: buffer.length };
    }

    case 'otcs_download_content': {
      const { node_id } = args as { node_id: number };
      const { content, mimeType, fileName } = await client.getContent(node_id);
      return { file_name: fileName, mime_type: mimeType, size_bytes: content.byteLength, content_base64: Buffer.from(content).toString('base64') };
    }

    // ==================== Versions ====================
    case 'otcs_versions': {
      const { action, node_id, content_base64, mime_type, file_name, description } = args as {
        action: string; node_id: number; content_base64?: string; mime_type?: string; file_name?: string; description?: string;
      };
      if (action === 'list') {
        const versions = await client.getVersions(node_id);
        return { node_id, versions, version_count: versions.length };
      } else if (action === 'add') {
        if (!content_base64 || !mime_type || !file_name) throw new Error('content_base64, mime_type, and file_name required for add');
        const buffer = Buffer.from(content_base64, 'base64');
        const result = await client.addVersion(node_id, buffer, mime_type, file_name, description);
        return { success: true, version: result, message: `New version added to ${node_id}` };
      }
      throw new Error(`Unknown action: ${action}`);
    }

    // ==================== Workspaces ====================
    case 'otcs_workspace_types': {
      const { action, template_id } = args as { action?: string; template_id?: number };
      if (action === 'get_form') {
        if (!template_id) throw new Error('template_id required for get_form');
        const form = await client.getWorkspaceForm(template_id);
        return { template_id, schema: form };
      }
      const types = await client.getWorkspaceTypes();
      return { workspace_types: types, count: types.length };
    }

    case 'otcs_create_workspace': {
      const { template_id, name, parent_id, description, business_properties } = args as {
        template_id: number; name: string; parent_id?: number; description?: string; business_properties?: Record<string, unknown>;
      };
      const workspace = await client.createWorkspace({ template_id, name, parent_id, description, business_properties });
      return { success: true, workspace, message: `Workspace "${name}" created with ID ${workspace.id}` };
    }

    case 'otcs_get_workspace': {
      const { workspace_id, find_for_node } = args as { workspace_id?: number; find_for_node?: number };
      if (find_for_node) {
        const workspace = await client.findWorkspaceRoot(find_for_node);
        return workspace ? { found: true, workspace } : { found: false, message: `No workspace found for node ${find_for_node}` };
      }
      if (!workspace_id) throw new Error('Either workspace_id or find_for_node required');
      return await client.getWorkspace(workspace_id);
    }

    case 'otcs_search_workspaces': {
      const params = args as any;
      return await client.searchWorkspaces(params);
    }

    // ==================== Workspace Relations ====================
    case 'otcs_workspace_relations': {
      const { action, workspace_id, related_workspace_id, relation_id, relation_type } = args as {
        action: string; workspace_id: number; related_workspace_id?: number; relation_id?: number; relation_type?: string;
      };
      switch (action) {
        case 'list':
          const relations = await client.getWorkspaceRelations(workspace_id);
          return { workspace_id, relations, count: relations.length };
        case 'add':
          if (!related_workspace_id) throw new Error('related_workspace_id required for add');
          const newRelation = await client.addWorkspaceRelation(workspace_id, related_workspace_id, relation_type);
          return { success: true, relation: newRelation, message: `Workspace ${related_workspace_id} linked to ${workspace_id}` };
        case 'remove':
          if (!relation_id) throw new Error('relation_id required for remove');
          await client.removeWorkspaceRelation(workspace_id, relation_id);
          return { success: true, message: `Relation ${relation_id} removed` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Workspace Roles ====================
    case 'otcs_workspace_roles': {
      const { action, workspace_id, role_id, member_id } = args as {
        action: string; workspace_id: number; role_id?: number; member_id?: number;
      };
      switch (action) {
        case 'get_roles':
          const roles = await client.getWorkspaceRoles(workspace_id);
          return { workspace_id, roles, count: roles.length };
        case 'get_members':
          const members = await client.getWorkspaceMembers(workspace_id);
          return { workspace_id, members, count: members.length };
        case 'get_role_members':
          if (!role_id) throw new Error('role_id required');
          const roleMembers = await client.getRoleMembers(workspace_id, role_id);
          return { workspace_id, role_id, members: roleMembers, count: roleMembers.length };
        case 'add_member':
          if (!role_id || !member_id) throw new Error('role_id and member_id required');
          await client.addRoleMember(workspace_id, role_id, member_id);
          return { success: true, message: `Member ${member_id} added to role ${role_id}` };
        case 'remove_member':
          if (!role_id || !member_id) throw new Error('role_id and member_id required');
          await client.removeRoleMember(workspace_id, role_id, member_id);
          return { success: true, message: `Member ${member_id} removed from role ${role_id}` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Workflows ====================
    case 'otcs_get_assignments': {
      const assignments = await client.getAssignments();
      return { assignments, count: assignments.length, message: assignments.length > 0 ? `Found ${assignments.length} pending task(s)` : 'No pending tasks' };
    }

    case 'otcs_workflow_status': {
      const { mode, status, kind, map_id, search_name, business_workspace_id, start_date, end_date } = args as any;
      if (mode === 'active') {
        const workflows = await client.getActiveWorkflows({ map_id, search_name, business_workspace_id, start_date, end_date });
        return { workflows, count: workflows.length };
      }
      const workflows = await client.getWorkflowStatus({ status, kind });
      return { workflows, count: workflows.length, filters: { status, kind } };
    }

    case 'otcs_workflow_definition': {
      const { map_id } = args as { map_id: number };
      const definition = await client.getWorkflowDefinition(map_id);
      return { definition, task_count: definition.tasks?.length || 0, data_package_count: definition.data_packages?.length || 0 };
    }

    case 'otcs_workflow_tasks': {
      const { process_id } = args as { process_id: number };
      const taskList = await client.getWorkflowTasks(process_id);
      return { ...taskList, summary: { completed: taskList.tasks?.completed?.length || 0, current: taskList.tasks?.current?.length || 0, next: taskList.tasks?.next?.length || 0 } };
    }

    case 'otcs_workflow_activities': {
      const { process_id, subprocess_id, limit } = args as { process_id: number; subprocess_id: number; limit?: number };
      const activities = await client.getWorkflowActivities(process_id, subprocess_id, limit);
      return { activities, count: activities.length };
    }

    case 'otcs_start_workflow': {
      const { mode, workflow_id, doc_ids, role_info, attach_documents } = args as {
        mode?: string; workflow_id: number; doc_ids?: string; role_info?: Record<string, number>; attach_documents?: boolean;
      };
      const startMode = mode || 'direct';
      if (startMode === 'draft') {
        const result = await client.createDraftWorkflow(workflow_id, doc_ids, attach_documents ?? true);
        return { success: true, draftprocess_id: result.draftprocess_id, workflow_type: result.workflow_type, message: `Draft workflow created with ID ${result.draftprocess_id}` };
      } else if (startMode === 'initiate') {
        const result = await client.initiateWorkflow({ workflow_id, role_info });
        return { success: true, work_id: result.work_id, workflow_id: result.workflow_id, message: `Workflow initiated with instance ID ${result.work_id}` };
      } else {
        const result = await client.startWorkflow(workflow_id, doc_ids);
        return { success: true, work_id: result.work_id, message: `Workflow started with instance ID ${result.work_id}` };
      }
    }

    case 'otcs_workflow_form': {
      const { process_id, subprocess_id, task_id, detailed } = args as {
        process_id: number; subprocess_id: number; task_id: number; detailed?: boolean;
      };

      if (detailed) {
        const formInfo = await client.getWorkflowTaskFormFull(process_id, subprocess_id, task_id);
        const fields: Record<string, any> = {};
        for (const form of formInfo.forms) {
          if (form.schema?.properties) {
            for (const [key, prop] of Object.entries(form.schema.properties)) {
              fields[key] = { type: prop.type || 'string', label: form.options?.fields?.[key]?.label, required: form.schema.required?.includes(key), readonly: prop.readonly || form.options?.fields?.[key]?.readonly };
            }
          }
        }
        return {
          title: formInfo.data.title, instructions: formInfo.data.instructions, priority: formInfo.data.priority,
          comments_enabled: formInfo.data.comments_on, attachments_enabled: formInfo.data.attachments_on,
          requires_accept: formInfo.data.member_accept, requires_authentication: formInfo.data.authentication,
          actions: formInfo.data.actions?.map((a: any) => ({ key: a.key, label: a.label })) || [],
          custom_actions: formInfo.data.custom_actions?.map((a: any) => ({ key: a.key, label: a.label })) || [],
          fields, form_count: formInfo.forms.length, raw_forms: formInfo.forms,
        };
      }

      const form = await client.getWorkflowTaskForm(process_id, subprocess_id, task_id);
      return { form, available_actions: form.actions?.map((a: any) => a.key) || [], custom_actions: form.custom_actions?.map((a: any) => a.key) || [] };
    }

    case 'otcs_workflow_task': {
      const { action, process_id, subprocess_id, task_id, disposition, custom_action, comment, form_data } = args as {
        action?: string; process_id: number; subprocess_id: number; task_id: number;
        disposition?: string; custom_action?: string; comment?: string; form_data?: Record<string, string>;
      };
      const taskAction = action || 'send';

      if (taskAction === 'check_group') {
        const isGroup = await client.checkGroupAssignment(process_id, subprocess_id, task_id);
        return { is_group_assignment: isGroup, requires_accept: isGroup, message: isGroup ? 'Task is group-assigned. Accept it first.' : 'Task is individually assigned.' };
      }

      if (taskAction === 'accept') {
        const result = await client.acceptWorkflowTask(process_id, subprocess_id, task_id);
        return { success: result.success, message: result.message || 'Task accepted', task_id, process_id };
      }

      // send action
      await client.sendWorkflowTask({ process_id, subprocess_id, task_id, action: disposition, custom_action, comment, form_data });
      const actionDesc = disposition || custom_action || 'action';
      return { success: true, message: `Task ${task_id} completed with ${actionDesc}`, details: { process_id, subprocess_id, task_id, action: actionDesc, comment, form_data } };
    }

    case 'otcs_draft_workflow': {
      const { action, draftprocess_id, values, comment } = args as {
        action: string; draftprocess_id: number; values?: Record<string, unknown>; comment?: string;
      };

      if (action === 'get_form') {
        const formInfo = await client.getDraftWorkflowForm(draftprocess_id);
        const fields: Record<string, any> = {};
        for (const form of formInfo.forms) {
          if (form.schema?.properties) {
            for (const [key, prop] of Object.entries(form.schema.properties)) {
              fields[key] = { type: prop.type || 'string', label: form.options?.fields?.[key]?.label, required: form.schema.required?.includes(key), current_value: form.data?.[key] };
            }
          }
        }
        return { title: formInfo.data.title, instructions: formInfo.data.instructions, fields, form_count: formInfo.forms.length, raw_forms: formInfo.forms };
      }

      if (action === 'update_form' || action === 'initiate') {
        const updateAction = action === 'initiate' ? 'Initiate' : 'formUpdate';
        await client.updateDraftWorkflowForm({ draftprocess_id, action: updateAction, comment, values });
        return { success: true, message: action === 'initiate' ? `Workflow initiated from draft ${draftprocess_id}` : `Form updated for draft ${draftprocess_id}`, values_updated: values ? Object.keys(values) : [] };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    case 'otcs_workflow_info': {
      const { work_id } = args as { work_id: number };
      return await client.getWorkflowInfoFull(work_id);
    }

    case 'otcs_manage_workflow': {
      const { action, process_id } = args as { action: string; process_id: number };
      if (action === 'delete') {
        await client.deleteWorkflow(process_id);
        return { success: true, message: `Workflow ${process_id} deleted` };
      }
      await client.updateWorkflowStatus(process_id, action as any);
      return { success: true, message: `Workflow ${process_id} status changed to ${action}` };
    }

    // ==================== Categories ====================
    case 'otcs_categories': {
      const { action, node_id, category_id, values, include_metadata, form_mode } = args as {
        action: string; node_id: number; category_id?: number; values?: Record<string, unknown>;
        include_metadata?: boolean; form_mode?: string;
      };

      switch (action) {
        case 'list':
          const result = await client.getCategories(node_id, include_metadata);
          return { ...result, category_count: result.categories.length, message: result.categories.length > 0 ? `Found ${result.categories.length} category(ies)` : 'No categories applied' };
        case 'get':
          if (!category_id) throw new Error('category_id required');
          const cat = await client.getCategory(node_id, category_id, include_metadata);
          return cat ? { found: true, category: cat, attribute_count: cat.attributes.length } : { found: false, message: `Category ${category_id} not found` };
        case 'add':
          if (!category_id) throw new Error('category_id required');
          const added = await client.addCategory(node_id, category_id, values);
          return { ...added, message: `Category ${category_id} added`, values_set: values ? Object.keys(values) : [] };
        case 'update':
          if (!category_id || !values) throw new Error('category_id and values required');
          const updated = await client.updateCategory(node_id, category_id, values);
          return { ...updated, message: `Category ${category_id} updated`, values_updated: Object.keys(values) };
        case 'remove':
          if (!category_id) throw new Error('category_id required');
          const removed = await client.removeCategory(node_id, category_id);
          return { ...removed, message: `Category ${category_id} removed` };
        case 'get_form':
          if (!category_id) throw new Error('category_id required');
          const form = form_mode === 'update' ? await client.getCategoryUpdateForm(node_id, category_id) : await client.getCategoryCreateForm(node_id, category_id);
          return { form, attribute_count: form.attributes.length, required_attributes: form.attributes.filter((a: any) => a.required).map((a: any) => a.key) };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case 'otcs_workspace_metadata': {
      const { action, workspace_id, values } = args as { action: string; workspace_id: number; values?: Record<string, unknown> };

      if (action === 'get_form') {
        const form = await client.getWorkspaceMetadataForm(workspace_id);
        const totalAttributes = form.categories.reduce((sum: number, cat: any) => sum + cat.attributes.length, 0);
        return { form, category_count: form.categories.length, total_attributes: totalAttributes, categories_summary: form.categories.map((c: any) => ({ id: c.category_id, name: c.category_name, attribute_count: c.attributes.length })) };
      }

      if (action === 'update') {
        if (!values) throw new Error('values required for update');
        const result = await client.updateWorkspaceMetadata(workspace_id, values);
        return { ...result, message: `Workspace ${workspace_id} metadata updated`, values_updated: Object.keys(values) };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    // ==================== Members ====================
    case 'otcs_members': {
      const { action, member_id, user_id, group_id, type, query, where_name, where_first_name, where_last_name, where_business_email, sort, limit, page } = args as any;

      switch (action) {
        case 'search':
          const searchResult = await client.searchMembers({ type, query, where_name, where_first_name, where_last_name, where_business_email, sort, limit: limit || 100, page: page || 1 });
          return { ...searchResult, message: `Found ${searchResult.total_count} member(s)`, type_searched: type === 0 ? 'users' : type === 1 ? 'groups' : 'all' };
        case 'get':
          if (!member_id) throw new Error('member_id required');
          const member = await client.getMember(member_id);
          return { ...member, member_type: member.type === 0 ? 'user' : 'group' };
        case 'get_user_groups':
          if (!user_id) throw new Error('user_id required');
          const groupsResult = await client.getUserGroups(user_id, { limit: limit || 100, page: page || 1 });
          return { ...groupsResult, message: `User ${user_id} belongs to ${groupsResult.total_count} group(s)` };
        case 'get_group_members':
          if (!group_id) throw new Error('group_id required');
          const membersResult = await client.getGroupMembers(group_id, { limit: limit || 100, page: page || 1, sort });
          return { ...membersResult, message: `Group ${group_id} has ${membersResult.total_count} member(s)` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case 'otcs_group_membership': {
      const { action, group_id, member_id } = args as { action: string; group_id: number; member_id: number };
      if (action === 'add') {
        const result = await client.addMemberToGroup(group_id, member_id);
        return { ...result, message: `Member ${member_id} added to group ${group_id}` };
      } else if (action === 'remove') {
        const result = await client.removeMemberFromGroup(group_id, member_id);
        return { ...result, message: `Member ${member_id} removed from group ${group_id}` };
      }
      throw new Error(`Unknown action: ${action}`);
    }

    // ==================== Permissions ====================
    case 'otcs_permissions': {
      const { action, node_id, right_id, member_id, permissions, apply_to } = args as {
        action: string; node_id: number; right_id?: number; member_id?: number; permissions?: string[]; apply_to?: number;
      };
      const targetId = right_id || member_id;

      switch (action) {
        case 'get':
          const perms = await client.getNodePermissions(node_id);
          return { ...perms, summary: { has_owner: !!perms.owner, has_group: !!perms.group, has_public_access: !!perms.public_access, custom_permissions_count: perms.custom_permissions.length } };
        case 'add':
          if (!targetId || !permissions) throw new Error('right_id and permissions required');
          const addResult = await client.addCustomPermission(node_id, targetId, permissions as any, { apply_to: apply_to as any });
          return { ...addResult, message: `Permissions added for member ${targetId}`, permissions_granted: permissions };
        case 'update':
          if (!targetId || !permissions) throw new Error('right_id and permissions required');
          const updateResult = await client.updateCustomPermission(node_id, targetId, permissions as any, { apply_to: apply_to as any });
          return { ...updateResult, message: `Permissions updated for member ${targetId}`, new_permissions: permissions };
        case 'remove':
          if (!targetId) throw new Error('right_id required');
          const removeResult = await client.removeCustomPermission(node_id, targetId, { apply_to: apply_to as any });
          return { ...removeResult, message: `Permissions removed for member ${targetId}` };
        case 'effective':
          if (!targetId) throw new Error('right_id or member_id required');
          const effective = await client.getEffectivePermissions(node_id, targetId);
          return { ...effective, permission_count: effective.permissions.length, has_see: effective.permissions.includes('see'), has_modify: effective.permissions.includes('modify'), has_delete: effective.permissions.includes('delete'), has_edit_permissions: effective.permissions.includes('edit_permissions') };
        case 'set_owner':
          if (!permissions) throw new Error('permissions required');
          const ownerResult = await client.updateOwnerPermissions(node_id, permissions as any, { right_id: targetId, apply_to: apply_to as any });
          return { ...ownerResult, message: targetId ? `Ownership transferred to ${targetId}` : 'Owner permissions updated', owner_permissions: permissions };
        case 'set_public':
          if (!permissions) throw new Error('permissions required (use empty array to remove public access)');
          const publicResult = await client.updatePublicPermissions(node_id, permissions as any, { apply_to: apply_to as any });
          return { ...publicResult, message: permissions.length > 0 ? 'Public access updated' : 'Public access removed', public_permissions: permissions };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============ MCP Server Setup ============

const server = new Server(
  { name: 'otcs-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Get enabled tools based on profile
const enabledTools = getEnabledTools(allTools);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: enabledTools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: JSON.stringify({ error: true, message: errorMessage, suggestion: getSuggestion(errorMessage) }, null, 2) }], isError: true };
  }
});

// MIME type detection
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain', '.csv': 'text/csv', '.html': 'text/html', '.xml': 'application/xml', '.json': 'application/json', '.md': 'text/markdown',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.zip': 'application/zip', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Error suggestions
function getSuggestion(error: string): string {
  if (error.includes('401') || error.includes('Authentication')) return 'Session may have expired. Try otcs_authenticate.';
  if (error.includes('404') || error.includes('not found')) return 'Node may have been deleted or moved.';
  if (error.includes('403') || error.includes('permission')) return 'Insufficient permissions for this operation.';
  if (error.includes('already exists')) return 'An item with this name already exists.';
  return 'Check the error message for details.';
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const profile = process.env.OTCS_TOOL_PROFILE || 'full';
  console.error(`OTCS MCP Server running (profile: ${profile}, tools: ${enabledTools.length})`);

  if (config.username && config.password) {
    try {
      await client.authenticate();
      console.error('Auto-authenticated with environment credentials');
    } catch (error) {
      console.error('Auto-authentication failed:', error instanceof Error ? error.message : error);
    }
  }
}

main().catch(console.error);
