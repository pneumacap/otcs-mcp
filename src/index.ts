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

// ============ Tool Definitions ============

const tools: Tool[] = [
  // Authentication Tools
  {
    name: 'otcs_authenticate',
    description: 'Authenticate with OpenText Content Server and establish a session. Returns an authentication ticket for subsequent operations. If username/password are not provided, uses credentials from environment variables (OTCS_USERNAME, OTCS_PASSWORD).',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Login username (optional if OTCS_USERNAME env var is set)',
        },
        password: {
          type: 'string',
          description: 'Login password (optional if OTCS_PASSWORD env var is set)',
        },
        domain: {
          type: 'string',
          description: 'Optional login domain',
        },
      },
      required: [],
    },
  },
  {
    name: 'otcs_session_status',
    description: 'Check if the current session is valid and authenticated.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'otcs_logout',
    description: 'End the current authenticated session.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // Navigation Tools
  {
    name: 'otcs_get_node',
    description: 'Get detailed information about a specific node (folder, document, workspace, etc.) by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'The unique ID of the node to retrieve',
        },
        include_path: {
          type: 'boolean',
          description: 'Include the full path/breadcrumb to this node',
          default: false,
        },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'otcs_browse',
    description: 'List the contents of a folder. Returns all items (subfolders, documents, etc.) within the specified container.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: {
          type: 'number',
          description: 'The ID of the folder to browse. Use 2000 for Enterprise Workspace root.',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        page_size: {
          type: 'number',
          description: 'Number of items per page (default: 100, max: 500)',
          default: 100,
        },
        filter_type: {
          type: 'string',
          description: 'Filter by item type: "folders", "documents", or "all"',
          enum: ['folders', 'documents', 'all'],
          default: 'all',
        },
        sort: {
          type: 'string',
          description: 'Sort order (e.g., "name", "-name" for descending, "modify_date", "-modify_date")',
          default: 'name',
        },
      },
      required: ['folder_id'],
    },
  },
  {
    name: 'otcs_search',
    description: 'Search for nodes by name within a specific location or globally.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - searches node names',
        },
        location_id: {
          type: 'number',
          description: 'Optional folder ID to search within. If not provided, searches globally.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
          default: 50,
        },
      },
      required: ['query'],
    },
  },

  // Folder Operations
  {
    name: 'otcs_create_folder',
    description: 'Create a new folder in the specified parent location.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'number',
          description: 'ID of the parent folder where the new folder will be created',
        },
        name: {
          type: 'string',
          description: 'Name for the new folder',
        },
        description: {
          type: 'string',
          description: 'Optional description for the folder',
        },
      },
      required: ['parent_id', 'name'],
    },
  },
  {
    name: 'otcs_create_folder_path',
    description: 'Create a nested folder structure (e.g., "2024/Q1/Reports"). Creates any missing folders in the path.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'number',
          description: 'ID of the starting parent folder',
        },
        path: {
          type: 'string',
          description: 'Folder path to create, using "/" as separator (e.g., "2024/Q1/Reports")',
        },
      },
      required: ['parent_id', 'path'],
    },
  },
  {
    name: 'otcs_delete_node',
    description: 'Delete a node (folder, document, etc.). Warning: This permanently deletes the item.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the node to delete',
        },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'otcs_rename_node',
    description: 'Rename a node (folder, document, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the node to rename',
        },
        new_name: {
          type: 'string',
          description: 'New name for the node',
        },
      },
      required: ['node_id', 'new_name'],
    },
  },
  {
    name: 'otcs_move_node',
    description: 'Move a node to a different parent folder.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the node to move',
        },
        destination_id: {
          type: 'number',
          description: 'ID of the destination folder',
        },
      },
      required: ['node_id', 'destination_id'],
    },
  },
  {
    name: 'otcs_copy_node',
    description: 'Copy a node to a different location.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the node to copy',
        },
        destination_id: {
          type: 'number',
          description: 'ID of the destination folder',
        },
        new_name: {
          type: 'string',
          description: 'Optional new name for the copy',
        },
      },
      required: ['node_id', 'destination_id'],
    },
  },

  // Document Operations
  {
    name: 'otcs_upload_document',
    description: 'Upload a document to a folder. Provide the file content as base64 encoded string.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'number',
          description: 'ID of the folder to upload to',
        },
        name: {
          type: 'string',
          description: 'Name for the document (including extension)',
        },
        content_base64: {
          type: 'string',
          description: 'File content as base64 encoded string',
        },
        mime_type: {
          type: 'string',
          description: 'MIME type of the file (e.g., "application/pdf", "text/plain")',
        },
        description: {
          type: 'string',
          description: 'Optional description for the document',
        },
      },
      required: ['parent_id', 'name', 'content_base64', 'mime_type'],
    },
  },
  {
    name: 'otcs_upload_file',
    description: 'Upload a file from the local filesystem to OpenText Content Server. This is the preferred method when you have a file path. The MIME type is auto-detected from the file extension.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'number',
          description: 'ID of the folder to upload to',
        },
        file_path: {
          type: 'string',
          description: 'Full path to the local file to upload (e.g., "/Users/john/Documents/report.pdf")',
        },
        name: {
          type: 'string',
          description: 'Optional: Name for the document in OTCS. If not provided, uses the original filename.',
        },
        description: {
          type: 'string',
          description: 'Optional description for the document',
        },
      },
      required: ['parent_id', 'file_path'],
    },
  },
  {
    name: 'otcs_download_content',
    description: 'Download the content of a document. Returns base64 encoded content.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the document to download',
        },
      },
      required: ['node_id'],
    },
  },

  // Version Operations
  {
    name: 'otcs_list_versions',
    description: 'List all versions of a document.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the document',
        },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'otcs_add_version',
    description: 'Add a new version to an existing document.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'ID of the document',
        },
        content_base64: {
          type: 'string',
          description: 'File content as base64 encoded string',
        },
        mime_type: {
          type: 'string',
          description: 'MIME type of the file',
        },
        file_name: {
          type: 'string',
          description: 'File name for the new version',
        },
        description: {
          type: 'string',
          description: 'Optional version description/comment',
        },
      },
      required: ['node_id', 'content_base64', 'mime_type', 'file_name'],
    },
  },

  // Business Workspace Tools
  {
    name: 'otcs_get_workspace_types',
    description: 'List all available business workspace types. Use this to discover what types of workspaces can be created.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'otcs_get_workspace_form',
    description: 'Get the form schema for creating a business workspace of a specific type. Returns required and optional fields.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'number',
          description: 'The workspace type/template ID',
        },
      },
      required: ['template_id'],
    },
  },
  {
    name: 'otcs_create_workspace',
    description: 'Create a new business workspace. Use otcs_get_workspace_types to find available types and otcs_get_workspace_form to get required fields.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'number',
          description: 'The workspace type/template ID',
        },
        name: {
          type: 'string',
          description: 'Name for the new workspace',
        },
        parent_id: {
          type: 'number',
          description: 'Optional parent folder ID. If not provided, uses default location.',
        },
        description: {
          type: 'string',
          description: 'Optional description for the workspace',
        },
        business_properties: {
          type: 'object',
          description: 'Optional business properties/metadata for the workspace (depends on workspace type)',
        },
      },
      required: ['template_id', 'name'],
    },
  },
  {
    name: 'otcs_get_workspace',
    description: 'Get detailed information about a business workspace including its type and business properties.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'otcs_search_workspaces',
    description: 'Search for business workspaces by name, type, or custom query. Supports filtering by workspace type and business properties.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_type_name: {
          type: 'string',
          description: 'Filter by workspace type name (e.g., "Customer", "Project", "Contract")',
        },
        workspace_type_id: {
          type: 'number',
          description: 'Filter by workspace type ID',
        },
        where_name: {
          type: 'string',
          description: 'Search by workspace name. Use "contains_" prefix for partial match (e.g., "contains_Acme")',
        },
        where_column_query: {
          type: 'string',
          description: 'Advanced query on business properties (e.g., "status = \'Active\' AND expiration_date > 2024-01-01")',
        },
        sort: {
          type: 'string',
          description: 'Sort order (e.g., "name", "-modify_date")',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination',
        },
        limit: {
          type: 'number',
          description: 'Number of results per page (default: 100)',
        },
      },
    },
  },
  {
    name: 'otcs_find_workspace_root',
    description: 'Find the business workspace that contains a given node. Useful for determining which workspace a document or folder belongs to.',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'number',
          description: 'The ID of any node (document, folder, etc.)',
        },
      },
      required: ['node_id'],
    },
  },

  // Workspace Relations Tools
  {
    name: 'otcs_get_related_workspaces',
    description: 'Get all workspaces related to a given workspace (e.g., related projects, contracts, customers).',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'otcs_add_workspace_relation',
    description: 'Create a relationship between two workspaces (e.g., link a project to a customer).',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the source workspace',
        },
        related_workspace_id: {
          type: 'number',
          description: 'The ID of the workspace to relate',
        },
        relation_type: {
          type: 'string',
          description: 'Optional type of relationship',
        },
      },
      required: ['workspace_id', 'related_workspace_id'],
    },
  },
  {
    name: 'otcs_remove_workspace_relation',
    description: 'Remove a relationship between workspaces.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the source workspace',
        },
        relation_id: {
          type: 'number',
          description: 'The ID of the relation to remove',
        },
      },
      required: ['workspace_id', 'relation_id'],
    },
  },

  // Workspace Roles & Members Tools
  {
    name: 'otcs_get_workspace_roles',
    description: 'Get all roles defined for a workspace (e.g., Owner, Reviewer, Contributor).',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'otcs_get_workspace_members',
    description: 'Get all members (users and groups) who have access to a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'otcs_get_role_members',
    description: 'Get all members assigned to a specific role in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
        role_id: {
          type: 'number',
          description: 'The ID of the role',
        },
      },
      required: ['workspace_id', 'role_id'],
    },
  },
  {
    name: 'otcs_add_role_member',
    description: 'Add a user or group to a role in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
        role_id: {
          type: 'number',
          description: 'The ID of the role',
        },
        member_id: {
          type: 'number',
          description: 'The ID of the user or group to add',
        },
      },
      required: ['workspace_id', 'role_id', 'member_id'],
    },
  },
  {
    name: 'otcs_remove_role_member',
    description: 'Remove a user or group from a role in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'number',
          description: 'The ID of the workspace',
        },
        role_id: {
          type: 'number',
          description: 'The ID of the role',
        },
        member_id: {
          type: 'number',
          description: 'The ID of the user or group to remove',
        },
      },
      required: ['workspace_id', 'role_id', 'member_id'],
    },
  },

  // ============ Workflow & Assignment Tools ============
  {
    name: 'otcs_get_assignments',
    description: 'Get current user\'s pending workflow assignments (tasks). Returns all workflow tasks awaiting action.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'otcs_get_workflow_status',
    description: 'Get workflows by status (ontime, workflowlate, completed, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by workflow status: "ontime", "workflowlate", or leave empty for all',
          enum: ['ontime', 'workflowlate'],
        },
        kind: {
          type: 'string',
          description: 'Filter by kind: "initiated" (workflows you started) or "managed" (workflows you manage)',
          enum: ['initiated', 'managed'],
        },
      },
    },
  },
  {
    name: 'otcs_get_active_workflows',
    description: 'Get running/active workflows with optional filters by map, name, workspace, or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        map_id: {
          type: 'number',
          description: 'Filter by workflow map ID',
        },
        search_name: {
          type: 'string',
          description: 'Search workflows by name',
        },
        business_workspace_id: {
          type: 'number',
          description: 'Filter by business workspace ID',
        },
        start_date: {
          type: 'string',
          description: 'Filter by start date (yyyy-mm-dd)',
        },
        end_date: {
          type: 'string',
          description: 'Filter by end date (yyyy-mm-dd)',
        },
      },
    },
  },
  {
    name: 'otcs_get_workflow_definition',
    description: 'Get the workflow map definition including available tasks and data packages.',
    inputSchema: {
      type: 'object',
      properties: {
        map_id: {
          type: 'number',
          description: 'The ID of the workflow map',
        },
      },
      required: ['map_id'],
    },
  },
  {
    name: 'otcs_get_workflow_tasks',
    description: 'Get the task list for a workflow instance, showing completed, current, and next tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: {
          type: 'number',
          description: 'The workflow instance/process ID',
        },
      },
      required: ['process_id'],
    },
  },
  {
    name: 'otcs_get_workflow_activities',
    description: 'Get the activity/audit history for a workflow instance.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: {
          type: 'number',
          description: 'The workflow instance/process ID',
        },
        subprocess_id: {
          type: 'number',
          description: 'The subprocess ID (usually same as process_id for main workflow)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of activities to return',
        },
      },
      required: ['process_id', 'subprocess_id'],
    },
  },
  {
    name: 'otcs_create_draft_workflow',
    description: 'Create a draft workflow process before initiation. Use this to prepare a workflow with documents attached.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'number',
          description: 'The workflow map ID',
        },
        doc_ids: {
          type: 'string',
          description: 'Comma-separated document IDs to attach (e.g., "123,456,789")',
        },
        attach_documents: {
          type: 'boolean',
          description: 'Whether to attach the documents to the workflow',
          default: true,
        },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'otcs_initiate_workflow',
    description: 'Start a new workflow instance. Optionally assign roles to specific users/groups.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'number',
          description: 'The workflow map ID to initiate',
        },
        role_info: {
          type: 'object',
          description: 'Optional role assignments as key-value pairs: {"RoleName": userId, ...}',
        },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'otcs_start_workflow',
    description: 'Start a workflow with disabled start step (direct start). For workflows that don\'t require initial form completion.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'number',
          description: 'The workflow map ID',
        },
        doc_ids: {
          type: 'string',
          description: 'Comma-separated document IDs to attach (e.g., "123,456")',
        },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'otcs_send_workflow_task',
    description: 'Execute an action on a workflow task: SendOn (approve/complete), Delegate, SendForReview, or a custom disposition. Supports workflow form data for tasks requiring attribute values.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: {
          type: 'number',
          description: 'The workflow instance/process ID',
        },
        subprocess_id: {
          type: 'number',
          description: 'The subprocess ID (usually same as process_id)',
        },
        task_id: {
          type: 'number',
          description: 'The task ID to act on',
        },
        action: {
          type: 'string',
          description: 'Standard action: "SendOn", "Delegate", or "SendForReview"',
          enum: ['SendOn', 'Delegate', 'SendForReview'],
        },
        custom_action: {
          type: 'string',
          description: 'Custom disposition action (alternative to standard action)',
        },
        comment: {
          type: 'string',
          description: 'Comment to add with the action',
        },
        form_data: {
          type: 'object',
          description: 'Workflow form field values as key-value pairs (e.g., {"WorkflowForm_10": "01/12/2026"} for date fields). Use otcs_get_workflow_form to discover field names.',
        },
      },
      required: ['process_id', 'subprocess_id', 'task_id'],
    },
  },
  {
    name: 'otcs_update_workflow_status',
    description: 'Change the status of a workflow: suspend, resume, stop, or archive.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: {
          type: 'number',
          description: 'The workflow instance/process ID',
        },
        status: {
          type: 'string',
          description: 'New status for the workflow',
          enum: ['suspend', 'resume', 'stop', 'archive'],
        },
      },
      required: ['process_id', 'status'],
    },
  },
  {
    name: 'otcs_delete_workflow',
    description: 'Delete a workflow instance. Warning: This permanently removes the workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: {
          type: 'number',
          description: 'The workflow instance/process ID to delete',
        },
      },
      required: ['process_id'],
    },
  },
  {
    name: 'otcs_get_workflow_form',
    description: 'Get the form schema for a workflow task, including available actions and custom dispositions.',
    inputSchema: {
      type: 'object',
      properties: {
        process_id: {
          type: 'number',
          description: 'The workflow instance/process ID',
        },
        subprocess_id: {
          type: 'number',
          description: 'The subprocess ID',
        },
        task_id: {
          type: 'number',
          description: 'The task ID',
        },
      },
      required: ['process_id', 'subprocess_id', 'task_id'],
    },
  },
];

// ============ Tool Handler ============

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // Authentication
    case 'otcs_authenticate': {
      const { username, password, domain } = args as {
        username: string;
        password: string;
        domain?: string;
      };
      const ticket = await client.authenticate(username, password, domain);
      return {
        success: true,
        message: 'Authentication successful',
        ticket_preview: ticket.substring(0, 20) + '...',
      };
    }

    case 'otcs_session_status': {
      const isValid = await client.validateSession();
      return {
        authenticated: isValid,
        has_ticket: client.isAuthenticated(),
      };
    }

    case 'otcs_logout': {
      await client.logout();
      return { success: true, message: 'Logged out successfully' };
    }

    // Navigation
    case 'otcs_get_node': {
      const { node_id, include_path } = args as {
        node_id: number;
        include_path?: boolean;
      };

      if (include_path) {
        const { node, ancestors } = await client.getNodeWithAncestors(node_id);
        return {
          ...node,
          path: ancestors.map(a => a.name),
          ancestors: ancestors.map(a => ({ id: a.id, name: a.name })),
        };
      }

      return await client.getNode(node_id);
    }

    case 'otcs_browse': {
      const { folder_id, page, page_size, filter_type, sort } = args as {
        folder_id: number;
        page?: number;
        page_size?: number;
        filter_type?: 'folders' | 'documents' | 'all';
        sort?: string;
      };

      // Map filter_type to node types
      let where_type: number[] | undefined;
      if (filter_type === 'folders') {
        where_type = [NodeTypes.FOLDER];
      } else if (filter_type === 'documents') {
        where_type = [NodeTypes.DOCUMENT];
      }

      const result = await client.getSubnodes(folder_id, {
        page: page || 1,
        limit: page_size || 100,
        sort: sort,
        where_type,
      });

      return result;
    }

    case 'otcs_search': {
      const { query, location_id, limit } = args as {
        query: string;
        location_id?: number;
        limit?: number;
      };

      const result = await client.searchNodes(query, {
        location: location_id,
        limit: limit || 50,
      });

      return result;
    }

    // Folder Operations
    case 'otcs_create_folder': {
      const { parent_id, name, description } = args as {
        parent_id: number;
        name: string;
        description?: string;
      };

      const result = await client.createFolder(parent_id, name, description);
      return {
        success: true,
        folder: result,
        message: `Folder "${name}" created with ID ${result.id}`,
      };
    }

    case 'otcs_create_folder_path': {
      const { parent_id, path } = args as {
        parent_id: number;
        path: string;
      };

      const result = await client.createFolderPath(parent_id, path);
      return {
        success: true,
        folders_created: result.folders,
        leaf_folder_id: result.leafId,
        message: `Folder path "${path}" created/verified. Leaf folder ID: ${result.leafId}`,
      };
    }

    case 'otcs_delete_node': {
      const { node_id } = args as { node_id: number };
      await client.deleteNode(node_id);
      return {
        success: true,
        message: `Node ${node_id} deleted successfully`,
      };
    }

    case 'otcs_rename_node': {
      const { node_id, new_name } = args as {
        node_id: number;
        new_name: string;
      };
      const result = await client.renameNode(node_id, new_name);
      return {
        success: true,
        node: result,
        message: `Node renamed to "${new_name}"`,
      };
    }

    case 'otcs_move_node': {
      const { node_id, destination_id } = args as {
        node_id: number;
        destination_id: number;
      };
      const result = await client.moveNode(node_id, destination_id);
      return {
        success: true,
        node: result,
        message: `Node ${node_id} moved to folder ${destination_id}`,
      };
    }

    case 'otcs_copy_node': {
      const { node_id, destination_id, new_name } = args as {
        node_id: number;
        destination_id: number;
        new_name?: string;
      };
      const result = await client.copyNode(node_id, destination_id, new_name);
      return {
        success: true,
        new_node: result,
        message: `Node copied. New node ID: ${result.id}`,
      };
    }

    // Document Operations
    case 'otcs_upload_document': {
      const { parent_id, name, content_base64, mime_type, description } = args as {
        parent_id: number;
        name: string;
        content_base64: string;
        mime_type: string;
        description?: string;
      };

      const buffer = Buffer.from(content_base64, 'base64');
      const result = await client.uploadDocument(parent_id, name, buffer, mime_type, description);

      return {
        success: true,
        document: result,
        message: `Document "${name}" uploaded with ID ${result.id}`,
      };
    }

    case 'otcs_upload_file': {
      const { parent_id, file_path: filePath, name, description } = args as {
        parent_id: number;
        file_path: string;
        name?: string;
        description?: string;
      };

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read file from disk
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = name || path.basename(filePath);
      const mimeType = getMimeType(filePath);

      const result = await client.uploadDocument(parent_id, fileName, fileBuffer, mimeType, description);

      return {
        success: true,
        document: result,
        message: `File "${fileName}" uploaded with ID ${result.id}`,
        source_path: filePath,
        size_bytes: fileBuffer.length,
      };
    }

    case 'otcs_download_content': {
      const { node_id } = args as { node_id: number };
      const { content, mimeType, fileName } = await client.getContent(node_id);

      // Convert to base64
      const base64Content = Buffer.from(content).toString('base64');

      return {
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: content.byteLength,
        content_base64: base64Content,
      };
    }

    // Version Operations
    case 'otcs_list_versions': {
      const { node_id } = args as { node_id: number };
      const versions = await client.getVersions(node_id);
      return {
        node_id,
        versions,
        version_count: versions.length,
      };
    }

    case 'otcs_add_version': {
      const { node_id, content_base64, mime_type, file_name, description } = args as {
        node_id: number;
        content_base64: string;
        mime_type: string;
        file_name: string;
        description?: string;
      };

      const buffer = Buffer.from(content_base64, 'base64');
      const result = await client.addVersion(node_id, buffer, mime_type, file_name, description);

      return {
        success: true,
        version: result,
        message: `New version added to document ${node_id}`,
      };
    }

    // Business Workspace Operations
    case 'otcs_get_workspace_types': {
      const types = await client.getWorkspaceTypes();
      return {
        workspace_types: types,
        count: types.length,
      };
    }

    case 'otcs_get_workspace_form': {
      const { template_id } = args as { template_id: number };
      const form = await client.getWorkspaceForm(template_id);
      return {
        template_id,
        schema: form,
      };
    }

    case 'otcs_create_workspace': {
      const { template_id, name, parent_id, description, business_properties } = args as {
        template_id: number;
        name: string;
        parent_id?: number;
        description?: string;
        business_properties?: Record<string, unknown>;
      };

      const workspace = await client.createWorkspace({
        template_id,
        name,
        parent_id,
        description,
        business_properties,
      });

      return {
        success: true,
        workspace,
        message: `Workspace "${name}" created with ID ${workspace.id}`,
      };
    }

    case 'otcs_get_workspace': {
      const { workspace_id } = args as { workspace_id: number };
      const workspace = await client.getWorkspace(workspace_id);
      return workspace;
    }

    case 'otcs_search_workspaces': {
      const {
        workspace_type_name,
        workspace_type_id,
        where_name,
        where_column_query,
        sort,
        page,
        limit,
      } = args as {
        workspace_type_name?: string;
        workspace_type_id?: number;
        where_name?: string;
        where_column_query?: string;
        sort?: string;
        page?: number;
        limit?: number;
      };

      const result = await client.searchWorkspaces({
        workspace_type_name,
        workspace_type_id,
        where_name,
        where_column_query,
        sort,
        page,
        limit,
      });

      return result;
    }

    case 'otcs_find_workspace_root': {
      const { node_id } = args as { node_id: number };
      const workspace = await client.findWorkspaceRoot(node_id);

      if (!workspace) {
        return {
          found: false,
          message: `No business workspace found containing node ${node_id}`,
        };
      }

      return {
        found: true,
        workspace,
      };
    }

    // Workspace Relations
    case 'otcs_get_related_workspaces': {
      const { workspace_id } = args as { workspace_id: number };
      const relations = await client.getWorkspaceRelations(workspace_id);
      return {
        workspace_id,
        relations,
        count: relations.length,
      };
    }

    case 'otcs_add_workspace_relation': {
      const { workspace_id, related_workspace_id, relation_type } = args as {
        workspace_id: number;
        related_workspace_id: number;
        relation_type?: string;
      };

      const relation = await client.addWorkspaceRelation(
        workspace_id,
        related_workspace_id,
        relation_type
      );

      return {
        success: true,
        relation,
        message: `Workspace ${related_workspace_id} linked to workspace ${workspace_id}`,
      };
    }

    case 'otcs_remove_workspace_relation': {
      const { workspace_id, relation_id } = args as {
        workspace_id: number;
        relation_id: number;
      };

      await client.removeWorkspaceRelation(workspace_id, relation_id);

      return {
        success: true,
        message: `Relation ${relation_id} removed from workspace ${workspace_id}`,
      };
    }

    // Workspace Roles & Members
    case 'otcs_get_workspace_roles': {
      const { workspace_id } = args as { workspace_id: number };
      const roles = await client.getWorkspaceRoles(workspace_id);
      return {
        workspace_id,
        roles,
        count: roles.length,
      };
    }

    case 'otcs_get_workspace_members': {
      const { workspace_id } = args as { workspace_id: number };
      const members = await client.getWorkspaceMembers(workspace_id);
      return {
        workspace_id,
        members,
        count: members.length,
      };
    }

    case 'otcs_get_role_members': {
      const { workspace_id, role_id } = args as {
        workspace_id: number;
        role_id: number;
      };
      const members = await client.getRoleMembers(workspace_id, role_id);
      return {
        workspace_id,
        role_id,
        members,
        count: members.length,
      };
    }

    case 'otcs_add_role_member': {
      const { workspace_id, role_id, member_id } = args as {
        workspace_id: number;
        role_id: number;
        member_id: number;
      };

      await client.addRoleMember(workspace_id, role_id, member_id);

      return {
        success: true,
        message: `Member ${member_id} added to role ${role_id} in workspace ${workspace_id}`,
      };
    }

    case 'otcs_remove_role_member': {
      const { workspace_id, role_id, member_id } = args as {
        workspace_id: number;
        role_id: number;
        member_id: number;
      };

      await client.removeRoleMember(workspace_id, role_id, member_id);

      return {
        success: true,
        message: `Member ${member_id} removed from role ${role_id} in workspace ${workspace_id}`,
      };
    }

    // ============ Workflow & Assignment Handlers ============

    case 'otcs_get_assignments': {
      const assignments = await client.getAssignments();
      return {
        assignments,
        count: assignments.length,
        message: assignments.length > 0
          ? `Found ${assignments.length} pending workflow task(s)`
          : 'No pending workflow tasks',
      };
    }

    case 'otcs_get_workflow_status': {
      const { status, kind } = args as {
        status?: string;
        kind?: string;
      };

      const workflows = await client.getWorkflowStatus({ status, kind });
      return {
        workflows,
        count: workflows.length,
        filters: { status, kind },
      };
    }

    case 'otcs_get_active_workflows': {
      const { map_id, search_name, business_workspace_id, start_date, end_date } = args as {
        map_id?: number;
        search_name?: string;
        business_workspace_id?: number;
        start_date?: string;
        end_date?: string;
      };

      const workflows = await client.getActiveWorkflows({
        map_id,
        search_name,
        business_workspace_id,
        start_date,
        end_date,
      });

      return {
        workflows,
        count: workflows.length,
      };
    }

    case 'otcs_get_workflow_definition': {
      const { map_id } = args as { map_id: number };
      const definition = await client.getWorkflowDefinition(map_id);
      return {
        definition,
        task_count: definition.tasks?.length || 0,
        data_package_count: definition.data_packages?.length || 0,
      };
    }

    case 'otcs_get_workflow_tasks': {
      const { process_id } = args as { process_id: number };
      const taskList = await client.getWorkflowTasks(process_id);
      return {
        ...taskList,
        summary: {
          completed: taskList.tasks?.completed?.length || 0,
          current: taskList.tasks?.current?.length || 0,
          next: taskList.tasks?.next?.length || 0,
        },
      };
    }

    case 'otcs_get_workflow_activities': {
      const { process_id, subprocess_id, limit } = args as {
        process_id: number;
        subprocess_id: number;
        limit?: number;
      };

      const activities = await client.getWorkflowActivities(process_id, subprocess_id, limit);
      return {
        activities,
        count: activities.length,
      };
    }

    case 'otcs_create_draft_workflow': {
      const { workflow_id, doc_ids, attach_documents } = args as {
        workflow_id: number;
        doc_ids?: string;
        attach_documents?: boolean;
      };

      const result = await client.createDraftWorkflow(workflow_id, doc_ids, attach_documents);
      return {
        success: true,
        draftprocess_id: result.draftprocess_id,
        workflow_type: result.workflow_type,
        message: `Draft workflow created with ID ${result.draftprocess_id}`,
      };
    }

    case 'otcs_initiate_workflow': {
      const { workflow_id, role_info } = args as {
        workflow_id: number;
        role_info?: Record<string, number>;
      };

      const result = await client.initiateWorkflow({ workflow_id, role_info });
      return {
        success: true,
        work_id: result.work_id,
        workflow_id: result.workflow_id,
        message: `Workflow initiated with instance ID ${result.work_id}`,
      };
    }

    case 'otcs_start_workflow': {
      const { workflow_id, doc_ids } = args as {
        workflow_id: number;
        doc_ids?: string;
      };

      const result = await client.startWorkflow(workflow_id, doc_ids);
      return {
        success: true,
        work_id: result.work_id,
        message: `Workflow started with instance ID ${result.work_id}`,
      };
    }

    case 'otcs_send_workflow_task': {
      const { process_id, subprocess_id, task_id, action, custom_action, comment, form_data } = args as {
        process_id: number;
        subprocess_id: number;
        task_id: number;
        action?: string;
        custom_action?: string;
        comment?: string;
        form_data?: Record<string, string>;
      };

      await client.sendWorkflowTask({
        process_id,
        subprocess_id,
        task_id,
        action,
        custom_action,
        comment,
        form_data,
      });

      const actionDesc = action || custom_action || 'action';
      return {
        success: true,
        message: `Task ${task_id} completed with ${actionDesc}`,
        details: { process_id, subprocess_id, task_id, action: actionDesc, comment, form_data },
      };
    }

    case 'otcs_update_workflow_status': {
      const { process_id, status } = args as {
        process_id: number;
        status: 'suspend' | 'resume' | 'stop' | 'archive';
      };

      await client.updateWorkflowStatus(process_id, status);
      return {
        success: true,
        message: `Workflow ${process_id} status changed to ${status}`,
      };
    }

    case 'otcs_delete_workflow': {
      const { process_id } = args as { process_id: number };
      await client.deleteWorkflow(process_id);
      return {
        success: true,
        message: `Workflow ${process_id} deleted`,
      };
    }

    case 'otcs_get_workflow_form': {
      const { process_id, subprocess_id, task_id } = args as {
        process_id: number;
        subprocess_id: number;
        task_id: number;
      };

      const form = await client.getWorkflowTaskForm(process_id, subprocess_id, task_id);
      return {
        form,
        available_actions: form.actions?.map(a => a.key) || [],
        custom_actions: form.custom_actions?.map(a => a.key) || [],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============ MCP Server Setup ============

const server = new Server(
  {
    name: 'otcs-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: errorMessage,
            suggestion: getSuggestion(errorMessage),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// MIME type detection from file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    '.rtf': 'application/rtf',
    // Text
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'application/xml',
    '.json': 'application/json',
    '.md': 'text/markdown',
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    // Media
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wav': 'audio/wav',
    // Other
    '.eml': 'message/rfc822',
    '.msg': 'application/vnd.ms-outlook',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Error suggestions for common issues
function getSuggestion(error: string): string {
  if (error.includes('401') || error.includes('Authentication')) {
    return 'Session may have expired. Try calling otcs_authenticate again.';
  }
  if (error.includes('404') || error.includes('not found')) {
    return 'The node may have been deleted or moved. Try searching for it by name.';
  }
  if (error.includes('403') || error.includes('permission')) {
    return 'You may not have permission for this operation. Check with an administrator.';
  }
  if (error.includes('already exists')) {
    return 'An item with this name already exists. Try a different name or check the existing item.';
  }
  return 'Check the error message for details and try again.';
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OTCS MCP Server running on stdio');

  // Auto-authenticate if credentials are provided via environment variables
  if (config.username && config.password) {
    try {
      await client.authenticate();
      console.error('Auto-authenticated with environment credentials');
    } catch (error) {
      console.error('Auto-authentication failed:', error instanceof Error ? error.message : error);
      console.error('Tools requiring authentication will fail until otcs_authenticate is called');
    }
  } else {
    console.error('No credentials in environment. Call otcs_authenticate to establish a session.');
  }
}

main().catch(console.error);
