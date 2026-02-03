#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { OTCSClient } from './client/otcs-client.js';
import { NodeTypes, NodeInfo, FolderContents, FolderTreeNode } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { createWorker } from 'tesseract.js';
import * as url from 'url';

const require = createRequire(import.meta.url);

// Resolve local eng.traineddata (avoids CDN download that causes hangs)
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const LANG_PATH = path.resolve(__dirname, '../eng.traineddata');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');

// ── Text content extraction (mirrors web/src/lib/otcs-bridge.ts) ──
const TEXT_MIME_TYPES = new Set([
  'text/plain', 'text/csv', 'text/html', 'text/xml', 'text/markdown',
  'application/json', 'application/xml', 'application/javascript',
  'application/x-yaml', 'text/yaml',
]);

async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ text: string; method: string } | null> {
  const MAX_TEXT_LENGTH = 100_000;

  try {
    // Plain text formats — decode directly
    if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
      const text = buffer.toString('utf-8').slice(0, MAX_TEXT_LENGTH);
      return { text, method: 'direct' };
    }

    // PDF
    if (mimeType === 'application/pdf') {
      const result = await pdfParse(buffer);
      return { text: result.text.slice(0, MAX_TEXT_LENGTH), method: 'pdf-parse' };
    }

    // Word .docx
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value.slice(0, MAX_TEXT_LENGTH), method: 'mammoth' };
    }

    // Legacy .doc — mammoth can sometimes handle these too
    if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        if (result.value.length > 0) {
          return { text: result.value.slice(0, MAX_TEXT_LENGTH), method: 'mammoth' };
        }
      } catch {
        // Fall through — .doc not always supported
      }
    }

    // TIFF / TIF images — OCR via Tesseract worker (with timeout)
    if (
      mimeType === 'image/tiff' ||
      fileName.endsWith('.tif') ||
      fileName.endsWith('.tiff')
    ) {
      const OCR_TIMEOUT_MS = 60_000; // 60 seconds max

      const ocrPromise = (async () => {
        const workerOpts: Record<string, unknown> = {};
        if (fs.existsSync(LANG_PATH)) {
          workerOpts.langPath = path.dirname(LANG_PATH);
        }
        const worker = await createWorker('eng', undefined, workerOpts);
        try {
          const { data } = await worker.recognize(buffer);
          return data.text.trim();
        } finally {
          await worker.terminate();
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS)
      );

      const text = await Promise.race([ocrPromise, timeoutPromise]);
      if (text.length > 0) {
        return { text: text.slice(0, MAX_TEXT_LENGTH), method: 'tesseract-ocr' };
      }
      return { text: '[OCR completed but no text detected in image]', method: 'tesseract-ocr' };
    }
  } catch (err: any) {
    return { text: `[Text extraction failed: ${err.message}]`, method: 'error' };
  }

  return null; // Unsupported format
}

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
    'otcs_create_folder', 'otcs_node_action', 'otcs_delete_nodes',
    'otcs_upload', 'otcs_upload_folder', 'otcs_upload_batch', 'otcs_upload_with_metadata', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace',
    'otcs_get_assignments', 'otcs_workflow_form', 'otcs_workflow_task',
    'otcs_members', 'otcs_permissions', 'otcs_categories',
    'otcs_share',
  ],
  workflow: [
    // Core tools plus full workflow support
    'otcs_authenticate', 'otcs_session_status',
    'otcs_get_node', 'otcs_browse', 'otcs_search',
    'otcs_create_folder', 'otcs_node_action', 'otcs_delete_nodes',
    'otcs_upload', 'otcs_upload_folder', 'otcs_upload_batch', 'otcs_upload_with_metadata', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace', 'otcs_workspace_types',
    'otcs_get_assignments', 'otcs_workflow_status', 'otcs_workflow_definition',
    'otcs_workflow_tasks', 'otcs_workflow_activities', 'otcs_workflow_form',
    'otcs_workflow_task', 'otcs_start_workflow', 'otcs_draft_workflow',
    'otcs_workflow_info', 'otcs_manage_workflow',
    'otcs_members', 'otcs_permissions', 'otcs_categories',
  ],
  admin: [
    // Core tools plus admin/permission management and RM
    'otcs_authenticate', 'otcs_session_status', 'otcs_logout',
    'otcs_get_node', 'otcs_browse', 'otcs_search',
    'otcs_create_folder', 'otcs_node_action', 'otcs_delete_nodes',
    'otcs_upload', 'otcs_upload_folder', 'otcs_upload_batch', 'otcs_upload_with_metadata', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace', 'otcs_create_workspace', 'otcs_create_workspaces',
    'otcs_workspace_types', 'otcs_workspace_relations', 'otcs_workspace_roles',
    'otcs_get_assignments', 'otcs_workflow_form', 'otcs_workflow_task',
    'otcs_members', 'otcs_group_membership',
    'otcs_permissions', 'otcs_categories', 'otcs_workspace_metadata',
    'otcs_rm_classification', 'otcs_rm_holds', 'otcs_rm_xref', 'otcs_rm_rsi',
    'otcs_share',
  ],
  rm: [
    // Core tools plus Records Management
    'otcs_authenticate', 'otcs_session_status',
    'otcs_get_node', 'otcs_browse', 'otcs_search',
    'otcs_create_folder', 'otcs_node_action', 'otcs_delete_nodes',
    'otcs_upload', 'otcs_upload_folder', 'otcs_upload_batch', 'otcs_upload_with_metadata', 'otcs_download_content',
    'otcs_versions',
    'otcs_search_workspaces', 'otcs_get_workspace',
    'otcs_members', 'otcs_permissions', 'otcs_categories',
    'otcs_rm_classification', 'otcs_rm_holds', 'otcs_rm_xref', 'otcs_rm_rsi',
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
    description: `Enterprise search — the primary discovery tool. Searches document content, names, descriptions, and category metadata. Use this FIRST when finding documents by topic, type, or content.

**Best practices for discovery:**
- Use **mode: "anywords"** + multiple keywords for broad discovery (finds documents matching ANY term)
- Use **location_id** to scope search to a workspace/folder subtree — finds all matching documents in that container
- Use **include_highlights: true** to see highlighted snippets showing why each result matched
- Document descriptions and category attributes are searchable metadata — searches match against these by default
- Combine location_id + query "*" to enumerate all documents within a container

**LQL Query Examples (use mode: "complexquery"):**
- Wildcards: "OTName:contract*" (names starting with contract), "OTName:*report*" (names containing report)
- Field queries: "OTName:invoice AND OTMIMEType:pdf" (PDF files named invoice)
- Date ranges: "OTObjectDate:[2024-01-01 TO 2024-12-31]" (items from 2024)
- Combined: "budget OTName:*.xlsx" (Excel files with "budget" in content)

**Filter Types:** Use filter_type to restrict results to specific object types (documents, folders, workspaces, workflows).`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Supports: keywords (budget report), exact phrases ("quarterly report"), wildcards (contract*, *report*), and field queries (OTName:contract*). Multiple terms are ANDed by default.'
        },
        filter_type: {
          type: 'string',
          enum: ['all', 'documents', 'folders', 'workspaces', 'workflows'],
          description: 'Filter results by object type: all (default), documents (files only), folders, workspaces (business workspaces), workflows'
        },
        mode: {
          type: 'string',
          enum: ['allwords', 'anywords', 'exactphrase', 'complexquery'],
          description: 'Search mode: allwords (default, all terms must match), anywords (any term matches), exactphrase (exact phrase match), complexquery (LQL syntax for field:value queries)'
        },
        search_in: {
          type: 'string',
          enum: ['all', 'content', 'metadata'],
          description: 'Where to search: all (default - content and metadata), content (document body text only), metadata (name, description, attributes only)'
        },
        modifier: {
          type: 'string',
          enum: ['synonymsof', 'relatedto', 'soundslike', 'wordbeginswith', 'wordendswith'],
          description: 'Expand search with related terms'
        },
        sort: {
          type: 'string',
          enum: ['relevance', 'desc_OTObjectDate', 'asc_OTObjectDate', 'desc_OTObjectSize', 'asc_OTObjectSize', 'asc_OTName', 'desc_OTName'],
          description: 'Sort order (default: relevance)'
        },
        location_id: {
          type: 'number',
          description: 'Scope search to a specific folder/workspace subtree by its node ID. Use this to find all documents within a known container regardless of query match.'
        },
        include_facets: {
          type: 'boolean',
          description: 'Include facets for filtering/drilling down results'
        },
        include_highlights: {
          type: 'boolean',
          description: 'Include highlighted snippets showing where matches occur'
        },
        limit: { type: 'number', description: 'Max results per page (default: 50)' },
        page: { type: 'number', description: 'Page number for pagination' },
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
    description: 'Perform action on a node: copy, move, rename, delete, or update_description.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['copy', 'move', 'rename', 'delete', 'update_description'], description: 'Action to perform' },
        node_id: { type: 'number', description: 'Node ID' },
        destination_id: { type: 'number', description: 'Destination folder ID (for copy/move)' },
        new_name: { type: 'string', description: 'New name (for rename, or optional for copy)' },
        description: { type: 'string', description: 'New description (for update_description)' },
      },
      required: ['action', 'node_id'],
    },
  },

  {
    name: 'otcs_delete_nodes',
    description: 'Delete multiple nodes in a single call. Each deletion is performed sequentially with graceful partial failure — if one fails, the rest still proceed.',
    inputSchema: {
      type: 'object',
      properties: {
        node_ids: {
          type: 'array',
          description: 'Array of node IDs to delete',
          items: { type: 'number' },
        },
      },
      required: ['node_ids'],
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
  {
    name: 'otcs_upload_folder',
    description: 'Upload all files from a local folder to OpenText with parallel processing. When recursive=true, preserves the folder structure from the local filesystem by creating matching subfolders in OpenText. Perfect for document migrations. Optionally filter by extension and auto-apply categories.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'number', description: 'Destination folder ID in OpenText' },
        folder_path: { type: 'string', description: 'Local folder path to upload (e.g., "/Users/me/Desktop/documents")' },
        extensions: { type: 'array', items: { type: 'string' }, description: 'Optional: Filter by file extensions (e.g., [".pdf", ".docx"]). If omitted, uploads all files.' },
        recursive: { type: 'boolean', description: 'Include subfolders and preserve folder structure (default: false). When true, creates matching subfolder hierarchy in OpenText.', default: false },
        concurrency: { type: 'number', description: 'Number of parallel uploads (default: 5, max: 10)', default: 5 },
        category_id: { type: 'number', description: 'Optional: Category ID to apply to all uploaded documents' },
        category_values: { type: 'object', description: 'Optional: Category attribute values keyed as {category_id}_{attribute_id}' },
      },
      required: ['parent_id', 'folder_path'],
    },
  },
  {
    name: 'otcs_upload_batch',
    description: 'Upload multiple specific files to OpenText with parallel processing. Provide an array of file paths.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'number', description: 'Destination folder ID in OpenText' },
        file_paths: { type: 'array', items: { type: 'string' }, description: 'Array of local file paths to upload' },
        concurrency: { type: 'number', description: 'Number of parallel uploads (default: 5, max: 10)', default: 5 },
        category_id: { type: 'number', description: 'Optional: Category ID to apply to all uploaded documents' },
        category_values: { type: 'object', description: 'Optional: Category attribute values keyed as {category_id}_{attribute_id}' },
      },
      required: ['parent_id', 'file_paths'],
    },
  },
  {
    name: 'otcs_upload_with_metadata',
    description: 'Upload a document and apply category/metadata in a single operation. Combines upload + category assignment for efficiency.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'number', description: 'Destination folder ID' },
        file_path: { type: 'string', description: 'Local file path to upload' },
        content_base64: { type: 'string', description: 'File content as base64 (alternative to file_path)' },
        name: { type: 'string', description: 'Document name (required if using content_base64)' },
        mime_type: { type: 'string', description: 'MIME type (auto-detected for file_path)' },
        description: { type: 'string', description: 'Optional description' },
        category_id: { type: 'number', description: 'Category ID to apply' },
        category_values: { type: 'object', description: 'Category attribute values keyed as {category_id}_{attribute_id}' },
        classification_id: { type: 'number', description: 'Optional: RM Classification ID to declare as record' },
        workflow_id: { type: 'number', description: 'Optional: Workflow map ID to start after upload' },
      },
      required: ['parent_id'],
    },
  },

  // ==================== Versions (1 consolidated tool) ====================
  {
    name: 'otcs_versions',
    description: 'Manage document versions. Actions: list, add. Provide either file_path (local file) OR content_base64 (base64 data) for add.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add'], description: 'Action to perform' },
        node_id: { type: 'number', description: 'Document ID' },
        file_path: { type: 'string', description: 'Local file path to upload as new version (for add)' },
        content_base64: { type: 'string', description: 'File content as base64 (alternative to file_path)' },
        mime_type: { type: 'string', description: 'MIME type (auto-detected for file_path)' },
        file_name: { type: 'string', description: 'File name (optional for file_path, required for content_base64)' },
        description: { type: 'string', description: 'Version description (for add)' },
      },
      required: ['action', 'node_id'],
    },
  },

  // ==================== Workspaces (4 tools) ====================
  {
    name: 'otcs_workspace_types',
    description: 'Get workspace types or form schema. Actions: list (types), get_form (creation form). IMPORTANT: Use the template_id from the list results (e.g. 17284), NOT the wksp_type_id (e.g. 13). Both are accepted and auto-resolved.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get_form'], description: 'Action', default: 'list' },
        template_id: { type: 'number', description: 'Template node ID from list results (e.g. 17284). Also accepts wksp_type_id which will be auto-resolved. Required for get_form.' },
      },
    },
  },
  {
    name: 'otcs_create_workspace',
    description: 'Create a business workspace. Business properties (category attributes) are automatically applied after creation. Property keys must be in format {category_id}_{attribute_id} (e.g., "11150_28" for Customer Number).',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'number', description: 'Template node ID from workspace types list (e.g. 17284). Also accepts wksp_type_id which will be auto-resolved.' },
        name: { type: 'string', description: 'Workspace name' },
        parent_id: { type: 'number', description: 'Optional parent folder ID' },
        description: { type: 'string', description: 'Optional description' },
        business_properties: { type: 'object', description: 'Optional business properties keyed as {category_id}_{attribute_id}. These are applied after workspace creation via category update.' },
      },
      required: ['template_id', 'name'],
    },
  },
  {
    name: 'otcs_create_workspaces',
    description: 'Create multiple business workspaces in a single call. Each workspace is created sequentially using the same logic as otcs_create_workspace, with graceful partial failure.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaces: {
          type: 'array',
          description: 'Array of workspace definitions to create',
          items: {
            type: 'object',
            properties: {
              template_id: { type: 'number', description: 'Template node ID from workspace types list (e.g. 17284). Also accepts wksp_type_id which will be auto-resolved.' },
              name: { type: 'string', description: 'Workspace name' },
              parent_id: { type: 'number', description: 'Optional parent folder ID' },
              description: { type: 'string', description: 'Optional description' },
              business_properties: { type: 'object', description: 'Optional business properties keyed as {category_id}_{attribute_id}.' },
            },
            required: ['template_id', 'name'],
          },
        },
      },
      required: ['workspaces'],
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
    description: 'Get workflows by status or search active/running workflows. Use by_status mode to query workflows dashboard (ontime, late, completed, stopped). Use active mode to list running workflow instances optionally filtered by map ID, date range, or archive status.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['by_status', 'active'], description: 'Query mode: by_status for dashboard view, active for running instances', default: 'by_status' },
        status: { type: 'string', enum: ['ontime', 'workflowlate', 'completed', 'stopped'], description: 'Status filter. For by_status: ontime|workflowlate|completed|stopped. For active: NOARCHIVE|ARCHIVED' },
        kind: { type: 'string', enum: ['Initiated', 'Managed', 'Both'], description: 'Kind filter - Initiated (you started), Managed (you manage), Both' },
        map_id: { type: 'number', description: 'Workflow map ID (for active mode)' },
        search_name: { type: 'string', description: 'Search by workflow name (for active mode)' },
        business_workspace_id: { type: 'number', description: 'Filter by workspace (for active mode)' },
        start_date: { type: 'string', description: 'Start date yyyy-mm-dd (for active mode)' },
        end_date: { type: 'string', description: 'End date yyyy-mm-dd (for active mode)' },
        wfretention: { type: 'number', description: 'Filter on workflow completion date in days (for by_status mode)' },
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
    description: 'Start a workflow. RECOMMENDED: Use mode "direct" (default) to immediately start with doc_ids and get a running instance in one call. Only use "draft" if you need to configure form fields before starting (requires separate otcs_draft_workflow initiate call). Use "initiate" for role assignments without documents.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['direct', 'draft', 'initiate'], description: 'Start mode. Use "direct" (default) for most cases - starts workflow immediately with attachments.', default: 'direct' },
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
    description: 'Manage draft workflow forms (advanced). Actions: get_form (view form fields), update_form (set field values), initiate (launch the draft as a running workflow). Note: documents must be attached during draft creation via otcs_start_workflow, not during initiate.',
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
    description: 'Manage node categories/metadata. Actions: list, get, add, update, remove, get_form. Supports nested set attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'add', 'update', 'remove', 'get_form'], description: 'Action' },
        node_id: { type: 'number', description: 'Node ID' },
        category_id: { type: 'number', description: 'Category ID (for get/add/update/remove/get_form)' },
        values: {
          type: 'object',
          description: 'Attribute values. Key formats: simple "{cat_id}_{attr_id}", set row "{cat_id}_{set_id}_{row}_{attr_id}", or nested object { set_id: [{ attr_id: value }] }',
        },
        include_metadata: { type: 'boolean', description: 'Include attribute type info including nested set structure (for list/get)' },
        form_mode: { type: 'string', enum: ['create', 'update'], description: 'Form mode (for get_form)', default: 'create' },
      },
      required: ['action', 'node_id'],
    },
  },
  {
    name: 'otcs_workspace_metadata',
    description: 'Manage workspace business properties. Actions: get_form, update. Supports nested set attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get_form', 'update'], description: 'Action' },
        workspace_id: { type: 'number', description: 'Workspace ID' },
        values: {
          type: 'object',
          description: 'Values. Key formats: simple "{cat_id}_{attr_id}", set row "{cat_id}_{set_id}_{row}_{attr_id}", or nested object { set_id: [{ attr_id: value }] }',
        },
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

  // ==================== Records Management (3 consolidated tools) ====================
  {
    name: 'otcs_rm_classification',
    description: 'Manage Records Management classifications. Actions: browse_tree (browse RM classification tree - default starts at node 2046), get_node_classifications (get classifications applied to a node), declare (apply classification to node), undeclare (remove), update_details (record properties), make_confidential, remove_confidential, finalize (make record immutable). NOTE: To find available RM classifications to apply, use browse_tree starting from the Classification Volume (node 2046).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['browse_tree', 'get_node_classifications', 'declare', 'undeclare', 'update_details', 'make_confidential', 'remove_confidential', 'finalize'], description: 'Action to perform' },
        node_id: { type: 'number', description: 'Node ID - for browse_tree: classification folder to browse (default: 2046 Classification Volume); for other actions: target document node' },
        node_ids: { type: 'array', items: { type: 'number' }, description: 'Array of node IDs (for finalize batch)' },
        classification_id: { type: 'number', description: 'Classification ID to apply (for declare)' },
        name: { type: 'string', description: 'Updated record name (for update_details)' },
        official: { type: 'boolean', description: 'Mark as official record (for update_details)' },
        storage: { type: 'string', description: 'Storage location (for update_details)' },
        accession: { type: 'string', description: 'Accession number (for update_details)' },
        subject: { type: 'string', description: 'Subject keywords (for update_details)' },
        rsi_data: { type: 'object', description: 'RSI-specific data (for declare)', properties: { rsid: { type: 'number' }, status_date: { type: 'string' } } },
      },
      required: ['action'],
    },
  },
  {
    name: 'otcs_rm_holds',
    description: 'Manage Legal and Administrative Holds. Actions: list_holds, get_hold, create_hold, update_hold, delete_hold, get_node_holds (holds on a node), apply_hold, remove_hold, apply_batch, remove_batch, get_hold_items, get_hold_users, add_hold_users, remove_hold_users.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list_holds', 'get_hold', 'create_hold', 'update_hold', 'delete_hold', 'get_node_holds', 'apply_hold', 'remove_hold', 'apply_batch', 'remove_batch', 'get_hold_items', 'get_hold_users', 'add_hold_users', 'remove_hold_users'], description: 'Action to perform' },
        hold_id: { type: 'number', description: 'Hold ID (for get/update/delete/apply/remove/items/users operations)' },
        node_id: { type: 'number', description: 'Node ID (for get_node_holds/apply_hold/remove_hold)' },
        node_ids: { type: 'array', items: { type: 'number' }, description: 'Array of node IDs (for batch operations)' },
        user_ids: { type: 'array', items: { type: 'number' }, description: 'Array of user IDs (for add/remove users)' },
        name: { type: 'string', description: 'Hold name (for create/update)' },
        hold_type: { type: 'string', enum: ['Legal', 'Administrative'], description: 'Hold type (for create)' },
        comment: { type: 'string', description: 'Comment (for create/update)' },
        alternate_id: { type: 'string', description: 'Alternate ID/matter number (for create/update)' },
        date_to_release: { type: 'string', description: 'Planned release date yyyy-mm-dd (for create/update)' },
        include_child: { type: 'boolean', description: 'Include children when applying hold', default: true },
      },
      required: ['action'],
    },
  },
  {
    name: 'otcs_rm_xref',
    description: 'Manage RM Cross-References between records. Actions: list_types, get_type, create_type, delete_type, get_node_xrefs (xrefs on a node), apply, remove, apply_batch, remove_batch.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list_types', 'get_type', 'create_type', 'delete_type', 'get_node_xrefs', 'apply', 'remove', 'apply_batch', 'remove_batch'], description: 'Action to perform' },
        type_name: { type: 'string', description: 'Cross-reference type name (for get_type/delete_type/apply/remove)' },
        node_id: { type: 'number', description: 'Source node ID (for get_node_xrefs/apply/remove)' },
        target_node_id: { type: 'number', description: 'Target node ID (for apply/remove)' },
        node_ids: { type: 'array', items: { type: 'number' }, description: 'Source node IDs (for batch operations)' },
        target_node_ids: { type: 'array', items: { type: 'number' }, description: 'Target node IDs (for batch operations)' },
        name: { type: 'string', description: 'Type name (for create_type)' },
        reciprocal_name: { type: 'string', description: 'Reciprocal type name (for create_type)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'otcs_rm_rsi',
    description: 'Manage RSI (Record Series Identifier) retention schedules. Actions: list (all RSIs), get (RSI details with schedules), create (new RSI), update (RSI metadata), delete, get_node_rsis (RSIs on a node), assign (RSI to classified node), remove (RSI from node), get_items (items with RSI), get_schedules (RSI schedule stages), create_schedule (new retention stage), approve_schedule, get_approval_history.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete', 'get_node_rsis', 'assign', 'remove', 'get_items', 'get_schedules', 'create_schedule', 'approve_schedule', 'get_approval_history'], description: 'Action to perform' },
        rsi_id: { type: 'number', description: 'RSI ID (for get/update/delete/get_items/get_schedules/create_schedule/approve_schedule/get_approval_history)' },
        node_id: { type: 'number', description: 'Node ID (for get_node_rsis/assign/remove)' },
        class_id: { type: 'number', description: 'Classification ID (for assign/remove - node must be classified)' },
        stage_id: { type: 'number', description: 'Schedule stage ID (for approve_schedule)' },
        // RSI create/update params
        name: { type: 'string', description: 'RSI name (for create/update)' },
        new_name: { type: 'string', description: 'New RSI name (for update/rename)' },
        status: { type: 'string', description: 'RSI status (for create/update)' },
        status_date: { type: 'string', description: 'Status date yyyy-mm-dd (for create/update/assign)' },
        description: { type: 'string', description: 'RSI description (for create/update)' },
        subject: { type: 'string', description: 'RSI subject (for create/update)' },
        title: { type: 'string', description: 'RSI title (for create/update)' },
        disp_control: { type: 'boolean', description: 'Under disposition control (for create/update)' },
        discontinue: { type: 'boolean', description: 'Discontinue RSI (for update)' },
        discontinue_date: { type: 'string', description: 'Discontinue date (for update)' },
        discontinue_comment: { type: 'string', description: 'Discontinue comment (for update)' },
        // Schedule create params
        stage: { type: 'string', description: 'Retention stage name (for create_schedule)' },
        object_type: { type: 'string', enum: ['LIV', 'LRM'], description: 'LIV=Classified Objects, LRM=RM Classifications (for create_schedule)' },
        event_type: { type: 'number', description: '1=Calculated Date, 2=Calendar, 3=Event Based, 4=Fixed Date, 5=Permanent (for create_schedule)' },
        date_to_use: { type: 'number', description: '91=Create, 92=Reserved, 93=Modify, 94=Status, 95=Record date (for create_schedule)' },
        retention_years: { type: 'number', description: 'Years to retain (for create_schedule)' },
        retention_months: { type: 'number', description: 'Months to retain (for create_schedule)' },
        retention_days: { type: 'number', description: 'Days to retain (for create_schedule)' },
        action_code: { type: 'number', description: '0=None, 1=Change Status, 7=Close, 8=Finalize, 9=Mark Official, 32=Destroy (for create_schedule)' },
        disposition: { type: 'string', description: 'Disposition action (for create_schedule)' },
        comment: { type: 'string', description: 'Approval comment (for approve_schedule)' },
        // Pagination
        page: { type: 'number', description: 'Page number (for list/get_items)' },
        limit: { type: 'number', description: 'Results per page (for list/get_items)' },
      },
      required: ['action'],
    },
  },

  // ==================== Sharing (1 tool) ====================
  {
    name: 'otcs_share',
    description: 'Manage document sharing with external providers (e.g., Core Share). Actions: list (list all active shares), create (share items with invitees), stop (stop sharing an item), stop_batch (stop sharing multiple items).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'stop', 'stop_batch'], description: 'Action to perform' },
        // For create action
        node_ids: { type: 'array', items: { type: 'number' }, description: 'Node IDs to share (for create)' },
        invitees: {
          type: 'array',
          description: 'Array of invitees with email and permissions (for create). Each invitee: { business_email: string, perm: 1|2|3|4 (1=Viewer, 2=Collaborator, 3=Manager, 4=Owner) }',
          items: {
            type: 'object',
            properties: {
              business_email: { type: 'string', description: 'Email address of the invitee' },
              perm: { type: 'number', enum: [1, 2, 3, 4], description: '1=Viewer, 2=Collaborator, 3=Manager, 4=Owner' },
              name: { type: 'string', description: 'Display name (optional)' },
            },
            required: ['business_email', 'perm'],
          },
        },
        expire_date: { type: 'string', description: 'Expiration date yyyy-mm-dd (for create)' },
        share_initiator_role: { type: 'number', enum: [1, 2, 3, 4], description: 'Initiator permission level: 1=Viewer, 2=Collaborator, 3=Manager, 4=Owner (for create)' },
        sharing_message: { type: 'string', description: 'Message to include with share notification (for create)' },
        coordinators: { type: 'array', items: { type: 'number' }, description: 'CS user IDs who can modify share config (for create)' },
        // For stop action
        node_id: { type: 'number', description: 'Node ID to stop sharing (for stop)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'otcs_browse_tree',
    description: 'Recursively browse a folder hierarchy and return the full tree structure in a single call. Useful for understanding folder layouts without multiple browse requests.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'number', description: 'The ID of the root folder to browse' },
        max_depth: { type: 'number', description: 'Maximum depth to recurse (default 5)' },
        folders_only: { type: 'boolean', description: 'If true, only include folders in the tree (default true)' },
      },
      required: ['folder_id'],
    },
  },
  {
    name: 'otcs_create_folder_structure',
    description: 'Create an entire folder tree structure in a single call. Accepts a nested array of folder names with optional children. Existing folders are reused rather than duplicated.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'number', description: 'The parent folder ID under which to create the structure' },
        folders: {
          type: 'array',
          description: 'Array of folders to create, each with a name and optional children array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Folder name' },
              children: { type: 'array', description: 'Nested child folders (same structure)', items: { type: 'object' } },
            },
            required: ['name'],
          },
        },
      },
      required: ['parent_id', 'folders'],
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
      const params = args as {
        query: string;
        filter_type?: 'all' | 'documents' | 'folders' | 'workspaces' | 'workflows';
        location_id?: number;
        mode?: 'allwords' | 'anywords' | 'exactphrase' | 'complexquery';
        search_in?: 'all' | 'content' | 'metadata';
        modifier?: 'synonymsof' | 'relatedto' | 'soundslike' | 'wordbeginswith' | 'wordendswith';
        sort?: string;
        include_facets?: boolean;
        include_highlights?: boolean;
        limit?: number;
        page?: number;
      };
      return await client.search({
        query: params.query,
        filter_type: params.filter_type,
        location_id: params.location_id,
        lookfor: params.mode,
        within: params.search_in,
        modifier: params.modifier,
        sort: params.sort as any,
        include_facets: params.include_facets,
        include_highlights: params.include_highlights,
        limit: params.limit || 50,
        page: params.page,
      });
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
      const { action, node_id, destination_id, new_name, description } = args as {
        action: string; node_id: number; destination_id?: number; new_name?: string; description?: string;
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
        case 'update_description':
          if (description === undefined) throw new Error('description required for update_description');
          const updated = await client.updateNodeDescription(node_id, description);
          return { success: true, node: updated, message: `Description updated for node ${node_id}` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case 'otcs_delete_nodes': {
      const { node_ids } = args as { node_ids: number[] };
      const results = await client.deleteNodes(node_ids);
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      return {
        success: failed === 0,
        message: `Deleted ${succeeded}/${results.length} nodes${failed > 0 ? ` (${failed} failed)` : ''}`,
        results,
      };
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
      const buf = Buffer.from(content);

      // Extract readable text when possible
      const extracted = await extractText(buf, mimeType, fileName);

      const result: Record<string, unknown> = {
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: buf.byteLength,
      };

      if (extracted) {
        result.text_content = extracted.text;
        result.extraction_method = extracted.method;
        result.text_length = extracted.text.length;
      } else {
        // For non-text formats, still return base64 but note it's binary
        result.content_base64 = buf.toString('base64');
        result.note = 'Binary content — text extraction not available for this format.';
      }

      return result;
    }

    case 'otcs_upload_folder': {
      const { parent_id, folder_path, extensions, recursive, concurrency, category_id, category_values } = args as {
        parent_id: number; folder_path: string; extensions?: string[]; recursive?: boolean;
        concurrency?: number; category_id?: number; category_values?: Record<string, unknown>;
      };

      if (!fs.existsSync(folder_path)) throw new Error(`Folder not found: ${folder_path}`);
      if (!fs.statSync(folder_path).isDirectory()) throw new Error(`Path is not a directory: ${folder_path}`);

      // Normalize the base folder path for consistent relative path calculation
      const baseFolderPath = path.resolve(folder_path);
      
      // Get the source folder name (e.g., "test" from "/Users/me/Desktop/test")
      const sourceFolderName = path.basename(baseFolderPath);

      // Create the root folder in OpenText (mirrors the source folder)
      let rootFolderId: number;
      try {
        const existingFolder = await client.findChildByName(parent_id, sourceFolderName);
        if (existingFolder) {
          rootFolderId = existingFolder.id;
        } else {
          const createdFolder = await client.createFolder(parent_id, sourceFolderName);
          rootFolderId = createdFolder.id;
        }
      } catch (error) {
        throw new Error(`Failed to create root folder "${sourceFolderName}": ${error}`);
      }

      // Collect all files to upload with their relative paths
      const filesToUpload: { fullPath: string; relativePath: string }[] = [];
      const collectFiles = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (recursive) {
              collectFiles(fullPath);
            }
          } else if (entry.isFile()) {
            // Filter by extension if specified
            if (extensions && extensions.length > 0) {
              const ext = path.extname(entry.name).toLowerCase();
              if (!extensions.map(e => e.toLowerCase()).includes(ext)) continue;
            }
            // Skip hidden files
            if (!entry.name.startsWith('.')) {
              // Calculate relative path from base folder
              const relativePath = path.relative(baseFolderPath, fullPath);
              filesToUpload.push({ fullPath, relativePath });
            }
          }
        }
      };
      collectFiles(folder_path);

      if (filesToUpload.length === 0) {
        return { success: true, uploaded: 0, message: 'No files found to upload', folder_path, root_folder: { name: sourceFolderName, id: rootFolderId }, extensions };
      }

      // Cache for created folders to avoid duplicate API calls
      // Key: relative folder path, Value: folder ID in OpenText
      const folderCache: Map<string, number> = new Map();
      folderCache.set('', rootFolderId); // Root maps to the created root folder

      // Helper function to ensure a folder path exists and return its ID
      const ensureFolderPath = async (relativeFolderPath: string): Promise<number> => {
        if (relativeFolderPath === '' || relativeFolderPath === '.') {
          return rootFolderId;
        }

        // Check cache first
        if (folderCache.has(relativeFolderPath)) {
          return folderCache.get(relativeFolderPath)!;
        }

        // Create folder path using the client method (relative to root folder)
        const result = await client.createFolderPath(rootFolderId, relativeFolderPath);
        
        // Cache all created folders
        const pathParts = relativeFolderPath.split(path.sep);
        let cumulativePath = '';
        for (let i = 0; i < pathParts.length; i++) {
          cumulativePath = i === 0 ? pathParts[i] : path.join(cumulativePath, pathParts[i]);
          if (result.folders[i]) {
            folderCache.set(cumulativePath, result.folders[i].id);
          }
        }

        return result.leafId;
      };

      // Pre-create all unique folder paths (sequential to avoid race conditions)
      const uniqueFolderPaths = new Set<string>();
      for (const file of filesToUpload) {
        const folderPath = path.dirname(file.relativePath);
        if (folderPath !== '' && folderPath !== '.') {
          uniqueFolderPaths.add(folderPath);
        }
      }

      // Sort by depth to create parent folders first
      const sortedFolderPaths = Array.from(uniqueFolderPaths).sort((a, b) => {
        return a.split(path.sep).length - b.split(path.sep).length;
      });

      // Create all folders first (sequentially to maintain hierarchy)
      const foldersCreated: string[] = [];
      for (const folderPath of sortedFolderPaths) {
        try {
          await ensureFolderPath(folderPath);
          foldersCreated.push(folderPath);
        } catch (error) {
          // Folder might already exist, continue
          console.error(`Note: Could not create folder ${folderPath}: ${error}`);
        }
      }

      // Parallel upload with concurrency limit
      const maxConcurrency = Math.min(concurrency || 5, 10);
      const results: { file: string; relativePath: string; success: boolean; node_id?: number; folder_id?: number; error?: string }[] = [];
      const startTime = Date.now();

      // Process in batches
      for (let i = 0; i < filesToUpload.length; i += maxConcurrency) {
        const batch = filesToUpload.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(async ({ fullPath, relativePath }) => {
          try {
            // Get the target folder ID for this file
            const relativeFolderPath = path.dirname(relativePath);
            const targetFolderId = folderCache.get(relativeFolderPath === '.' ? '' : relativeFolderPath) || rootFolderId;

            const buffer = fs.readFileSync(fullPath);
            const fileName = path.basename(fullPath);
            const mimeType = getMimeType(fullPath);
            const result = await client.uploadDocument(targetFolderId, fileName, buffer, mimeType);
            
            // Apply category if specified
            if (category_id && result.id) {
              try {
                await client.addCategory(result.id, category_id, category_values);
              } catch (catError) {
                return { file: fileName, relativePath, success: true, node_id: result.id, folder_id: targetFolderId, category_error: String(catError) };
              }
            }
            
            return { file: fileName, relativePath, success: true, node_id: result.id, folder_id: targetFolderId };
          } catch (error) {
            return { file: path.basename(fullPath), relativePath, success: false, error: String(error) };
          }
        });
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const elapsed = Date.now() - startTime;
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success);

      return {
        success: true,
        uploaded: successful,
        failed: failed.length,
        total_files: filesToUpload.length,
        root_folder: { name: sourceFolderName, id: rootFolderId },
        subfolders_created: foldersCreated.length,
        elapsed_ms: elapsed,
        files_per_second: (successful / (elapsed / 1000)).toFixed(2),
        message: `Created "${sourceFolderName}" folder (ID: ${rootFolderId}) and uploaded ${successful}/${filesToUpload.length} files in ${(elapsed / 1000).toFixed(1)}s`,
        structure_preserved: true,
        folder_structure: [sourceFolderName, ...foldersCreated.map(f => `${sourceFolderName}/${f}`)],
        results: results.slice(0, 50), // Limit results in response
        errors: failed.length > 0 ? failed.slice(0, 10) : undefined,
      };
    }

    case 'otcs_upload_batch': {
      const { parent_id, file_paths, concurrency, category_id, category_values } = args as {
        parent_id: number; file_paths: string[]; concurrency?: number;
        category_id?: number; category_values?: Record<string, unknown>;
      };

      if (!file_paths || file_paths.length === 0) throw new Error('file_paths array is required');

      // Validate all files exist first
      const missingFiles = file_paths.filter(fp => !fs.existsSync(fp));
      if (missingFiles.length > 0) {
        throw new Error(`Files not found: ${missingFiles.slice(0, 5).join(', ')}${missingFiles.length > 5 ? ` and ${missingFiles.length - 5} more` : ''}`);
      }

      const maxConcurrency = Math.min(concurrency || 5, 10);
      const results: { file: string; success: boolean; node_id?: number; error?: string }[] = [];
      const startTime = Date.now();

      // Process in batches
      for (let i = 0; i < file_paths.length; i += maxConcurrency) {
        const batch = file_paths.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(async (filePath) => {
          try {
            const buffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            const mimeType = getMimeType(filePath);
            const result = await client.uploadDocument(parent_id, fileName, buffer, mimeType);
            
            // Apply category if specified
            if (category_id && result.id) {
              try {
                await client.addCategory(result.id, category_id, category_values);
              } catch (catError) {
                return { file: fileName, success: true, node_id: result.id, category_error: String(catError) };
              }
            }
            
            return { file: fileName, success: true, node_id: result.id };
          } catch (error) {
            return { file: path.basename(filePath), success: false, error: String(error) };
          }
        });
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const elapsed = Date.now() - startTime;
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success);

      return {
        success: true,
        uploaded: successful,
        failed: failed.length,
        total_files: file_paths.length,
        elapsed_ms: elapsed,
        files_per_second: (successful / (elapsed / 1000)).toFixed(2),
        message: `Uploaded ${successful}/${file_paths.length} files in ${(elapsed / 1000).toFixed(1)}s`,
        results,
        errors: failed.length > 0 ? failed : undefined,
      };
    }

    case 'otcs_upload_with_metadata': {
      const { parent_id, file_path: filePath, content_base64, name, mime_type, description, category_id, category_values, classification_id, workflow_id } = args as {
        parent_id: number; file_path?: string; content_base64?: string; name?: string;
        mime_type?: string; description?: string; category_id?: number;
        category_values?: Record<string, unknown>; classification_id?: number; workflow_id?: number;
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

      // Step 1: Upload document
      const uploadResult = await client.uploadDocument(parent_id, fileName, buffer, mimeType, description);
      const nodeId = uploadResult.id;

      const operations: { operation: string; success: boolean; error?: string }[] = [];
      operations.push({ operation: 'upload', success: true });

      // Step 2: Apply category if specified
      if (category_id) {
        try {
          await client.addCategory(nodeId, category_id, category_values);
          operations.push({ operation: 'add_category', success: true });
        } catch (error) {
          operations.push({ operation: 'add_category', success: false, error: String(error) });
        }
      }

      // Step 3: Apply RM classification if specified
      if (classification_id) {
        try {
          await client.applyRMClassification({ node_id: nodeId, class_id: classification_id });
          operations.push({ operation: 'rm_classification', success: true });
        } catch (error) {
          operations.push({ operation: 'rm_classification', success: false, error: String(error) });
        }
      }

      // Step 4: Start workflow if specified
      let workflowResult: { work_id?: number } | undefined;
      if (workflow_id) {
        try {
          workflowResult = await client.startWorkflow(workflow_id, nodeId.toString());
          operations.push({ operation: 'start_workflow', success: true });
        } catch (error) {
          operations.push({ operation: 'start_workflow', success: false, error: String(error) });
        }
      }

      return {
        success: true,
        document: uploadResult,
        node_id: nodeId,
        size_bytes: buffer.length,
        operations,
        workflow_instance_id: workflowResult?.work_id,
        message: `"${fileName}" uploaded with ID ${nodeId}. ${operations.length} operation(s) completed.`,
      };
    }

    // ==================== Versions ====================
    case 'otcs_versions': {
      const { action, node_id, file_path: filePath, content_base64, mime_type, file_name, description } = args as {
        action: string; node_id: number; file_path?: string; content_base64?: string; mime_type?: string; file_name?: string; description?: string;
      };
      if (action === 'list') {
        const versions = await client.getVersions(node_id);
        return { node_id, versions, version_count: versions.length };
      } else if (action === 'add') {
        let buffer: Buffer;
        let fileName: string;
        let mimeType: string;

        if (filePath) {
          if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
          buffer = fs.readFileSync(filePath);
          fileName = file_name || path.basename(filePath);
          mimeType = mime_type || getMimeType(filePath);
        } else if (content_base64) {
          if (!file_name) throw new Error('file_name required when using content_base64');
          buffer = Buffer.from(content_base64, 'base64');
          fileName = file_name;
          mimeType = mime_type || 'application/octet-stream';
        } else {
          throw new Error('Either file_path or content_base64 is required for add');
        }

        const result = await client.addVersion(node_id, buffer, mimeType, fileName, description);
        return { success: true, version: result, message: `New version added to ${node_id}`, size_bytes: buffer.length };
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
      const propResults = (workspace as any)._propertyResults as { updated: number[]; failed: number[] } | undefined;
      delete (workspace as any)._propertyResults;

      let message = `Workspace "${name}" created with ID ${workspace.id}`;
      if (propResults) {
        if (propResults.updated.length > 0) {
          message += `. Categories updated: ${propResults.updated.join(', ')}`;
        }
        if (propResults.failed.length > 0) {
          message += `. WARNING: Failed to update categories: ${propResults.failed.join(', ')}`;
        }
      }
      return { success: true, workspace, message, categories_updated: propResults?.updated, categories_failed: propResults?.failed };
    }

    case 'otcs_create_workspaces': {
      const { workspaces } = args as { workspaces: Array<{ template_id: number; name: string; parent_id?: number; description?: string; business_properties?: Record<string, unknown> }> };
      const results = await client.createWorkspaces(workspaces);
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      return {
        success: failed === 0,
        message: `Created ${succeeded}/${results.length} workspaces${failed > 0 ? ` (${failed} failed)` : ''}`,
        results,
      };
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
      const { mode, status, kind, map_id, search_name, business_workspace_id, start_date, end_date, wfretention } = args as any;
      if (mode === 'active') {
        const workflows = await client.getActiveWorkflows({ map_id, search_name, business_workspace_id, start_date, end_date, status, kind });
        return { workflows, count: workflows.length, filters: { map_id, status, kind } };
      }
      const workflows = await client.getWorkflowStatus({ wstatus: status, kind, wfretention });
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
        return {
          success: true,
          work_id: result.work_id,
          message: `Workflow started with instance ID ${result.work_id}`,
        };
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

    // ==================== Records Management ====================
    case 'otcs_rm_classification': {
      const { action, node_id, node_ids, classification_id, name, official, storage, accession, subject } = args as {
        action: string; node_id?: number; node_ids?: number[]; classification_id?: number;
        name?: string; official?: boolean; storage?: string; accession?: string; subject?: string;
      };

      // Default Classification Volume ID
      const CLASSIFICATION_VOLUME_ID = 2046;

      switch (action) {
        case 'browse_tree':
          // Browse the RM classification tree - default to Classification Volume (2046)
          const browseId = node_id || CLASSIFICATION_VOLUME_ID;
          const browseResult = await client.getSubnodes(browseId, { limit: 100 });
          const rmClassifications = browseResult.items.filter((item: any) => item.type === 551 || item.type === 196);
          return {
            parent_id: browseId,
            parent_name: browseResult.folder?.name || 'Classification Volume',
            classifications: browseResult.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              type_name: item.type_name,
              description: item.description,
              has_children: item.container_size > 0,
              child_count: item.container_size
            })),
            count: browseResult.items.length,
            rm_classification_count: rmClassifications.length,
            message: browseId === CLASSIFICATION_VOLUME_ID
              ? `Classification Volume root contains ${browseResult.items.length} item(s). Use RM Classification (type 551) items for declaring records.`
              : `Found ${browseResult.items.length} item(s) in classification folder ${browseId}`,
            hint: 'To drill down, call browse_tree with node_id set to a classification folder ID. Type 551 = RM Classification (can be used for declare).'
          };
        case 'get_node_classifications':
          // Get classifications applied TO a specific node
          if (!node_id) throw new Error('node_id required');
          const classResult = await client.getRMClassifications(node_id);
          return { node_id, classifications: classResult.classifications, count: classResult.classifications.length, message: `Node ${node_id} has ${classResult.classifications.length} classification(s) applied` };
        case 'declare':
          if (!node_id || !classification_id) throw new Error('node_id and classification_id required');
          const declareResult = await client.applyRMClassification({ node_id, class_id: classification_id, official });
          return { success: true, result: declareResult, message: `Node ${node_id} declared as record under classification ${classification_id}` };
        case 'undeclare':
          if (!node_id || !classification_id) throw new Error('node_id and classification_id required');
          const undeclareResult = await client.removeRMClassification(node_id, classification_id);
          return { success: true, result: undeclareResult, message: `Record classification removed from node ${node_id}` };
        case 'update_details':
          if (!node_id) throw new Error('node_id required');
          const updateResult = await client.updateRMRecordDetails({ node_id, official, accession_code: accession, comments: subject });
          return { success: true, result: updateResult, message: `Record ${node_id} details updated` };
        case 'make_confidential':
          if (!node_id) throw new Error('node_id required');
          const confResult = await client.makeRMConfidential(node_id);
          return { success: true, result: confResult, message: `Node ${node_id} marked as confidential` };
        case 'remove_confidential':
          if (!node_id) throw new Error('node_id required');
          const unconfResult = await client.removeRMConfidential(node_id);
          return { success: true, result: unconfResult, message: `Confidential flag removed from node ${node_id}` };
        case 'finalize':
          if (!node_id && !node_ids) throw new Error('node_id or node_ids required');
          const idsToFinalize = node_ids || [node_id!];
          const finalizeResult = await client.finalizeRMRecords(idsToFinalize);
          return { success: true, result: finalizeResult, message: `${idsToFinalize.length} record(s) finalized`, node_ids: idsToFinalize };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case 'otcs_rm_holds': {
      const { action, hold_id, node_id, node_ids, user_ids, name, hold_type, comment, alternate_id } = args as {
        action: string; hold_id?: number; node_id?: number; node_ids?: number[]; user_ids?: number[];
        name?: string; hold_type?: 'Legal' | 'Administrative'; comment?: string; alternate_id?: string;
      };

      switch (action) {
        case 'list_holds':
          const holdsResult = await client.listRMHolds();
          return { holds: holdsResult.holds, count: holdsResult.holds.length, message: `Found ${holdsResult.holds.length} hold(s)` };
        case 'get_hold':
          if (!hold_id) throw new Error('hold_id required');
          const hold = await client.getRMHold(hold_id);
          return { hold, message: `Retrieved hold ${hold_id}` };
        case 'create_hold':
          if (!name) throw new Error('name required');
          const newHold = await client.createRMHold({ name, comment, type: hold_type, alternate_hold_id: alternate_id });
          return { success: true, hold: newHold, message: `Hold "${name}" created` };
        case 'update_hold':
          if (!hold_id) throw new Error('hold_id required');
          const updatedHold = await client.updateRMHold(hold_id, { name, comment, alternate_hold_id: alternate_id });
          return { success: true, hold: updatedHold, message: `Hold ${hold_id} updated` };
        case 'delete_hold':
          if (!hold_id) throw new Error('hold_id required');
          await client.deleteRMHold(hold_id);
          return { success: true, message: `Hold ${hold_id} deleted` };
        case 'get_node_holds':
          if (!node_id) throw new Error('node_id required');
          const nodeHoldsResult = await client.getNodeRMHolds(node_id);
          return { node_id, holds: nodeHoldsResult.holds, count: nodeHoldsResult.holds.length, message: `Node ${node_id} has ${nodeHoldsResult.holds.length} hold(s)` };
        case 'apply_hold':
          if (!hold_id || !node_id) throw new Error('hold_id and node_id required');
          const applyResult = await client.applyRMHold(node_id, hold_id);
          return { success: true, result: applyResult, message: `Hold ${hold_id} applied to node ${node_id}` };
        case 'remove_hold':
          if (!hold_id || !node_id) throw new Error('hold_id and node_id required');
          const removeResult = await client.removeRMHold(node_id, hold_id);
          return { success: true, result: removeResult, message: `Hold ${hold_id} removed from node ${node_id}` };
        case 'apply_batch':
          if (!hold_id || !node_ids || node_ids.length === 0) throw new Error('hold_id and node_ids required');
          const applyBatchResult = await client.applyRMHoldBatch(node_ids, hold_id);
          return { success: applyBatchResult.success, result: applyBatchResult, message: `Hold ${hold_id} applied to ${applyBatchResult.count}/${node_ids.length} node(s)${applyBatchResult.failed.length > 0 ? `, ${applyBatchResult.failed.length} failed` : ''}` };
        case 'remove_batch':
          if (!hold_id || !node_ids || node_ids.length === 0) throw new Error('hold_id and node_ids required');
          const removeBatchResult = await client.removeRMHoldBatch(node_ids, hold_id);
          return { success: removeBatchResult.success, result: removeBatchResult, message: `Hold ${hold_id} removed from ${removeBatchResult.count}/${node_ids.length} node(s)${removeBatchResult.failed.length > 0 ? `, ${removeBatchResult.failed.length} failed` : ''}` };
        case 'get_hold_items':
          if (!hold_id) throw new Error('hold_id required');
          const holdItemsResult = await client.getRMHoldItems(hold_id);
          return { hold_id, items: holdItemsResult.items, count: holdItemsResult.items.length, total_count: holdItemsResult.total_count, message: `Hold ${hold_id} contains ${holdItemsResult.total_count} item(s)` };
        case 'get_hold_users':
          if (!hold_id) throw new Error('hold_id required');
          const holdUsersResult = await client.getRMHoldUsers(hold_id);
          return { hold_id, users: holdUsersResult.users, count: holdUsersResult.users.length, message: `Hold ${hold_id} has ${holdUsersResult.users.length} authorized user(s)` };
        case 'add_hold_users':
          if (!hold_id || !user_ids || user_ids.length === 0) throw new Error('hold_id and user_ids required');
          const addUsersResult = await client.addRMHoldUsers(hold_id, user_ids);
          return { success: true, result: addUsersResult, message: `${user_ids.length} user(s) added to hold ${hold_id}` };
        case 'remove_hold_users':
          if (!hold_id || !user_ids || user_ids.length === 0) throw new Error('hold_id and user_ids required');
          const removeUsersResult = await client.removeRMHoldUsers(hold_id, user_ids);
          return { success: true, result: removeUsersResult, message: `${user_ids.length} user(s) removed from hold ${hold_id}` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case 'otcs_rm_xref': {
      const { action, type_name, node_id, target_node_id, node_ids, target_node_ids, name, reciprocal_name } = args as {
        action: string; type_name?: string; node_id?: number; target_node_id?: number;
        node_ids?: number[]; target_node_ids?: number[]; name?: string; reciprocal_name?: string;
      };

      switch (action) {
        case 'list_types':
          const xrefTypesResult = await client.listRMCrossRefTypes();
          return { types: xrefTypesResult.types, count: xrefTypesResult.types.length, message: `Found ${xrefTypesResult.types.length} cross-reference type(s)` };
        case 'get_type':
          if (!type_name) throw new Error('type_name required');
          const xrefType = await client.getRMCrossRefType(type_name);
          return { type: xrefType, message: `Retrieved cross-reference type "${type_name}"` };
        case 'create_type':
          if (!name) throw new Error('name required');
          const newType = await client.createRMCrossRefType(name, reciprocal_name);
          return { success: true, type: newType, message: `Cross-reference type "${name}" created` };
        case 'delete_type':
          if (!type_name) throw new Error('type_name required');
          await client.deleteRMCrossRefType(type_name);
          return { success: true, message: `Cross-reference type "${type_name}" deleted` };
        case 'get_node_xrefs':
          if (!node_id) throw new Error('node_id required');
          const nodeXrefsResult = await client.getNodeRMCrossRefs(node_id);
          return { node_id, cross_references: nodeXrefsResult.cross_references, count: nodeXrefsResult.cross_references.length, message: `Node ${node_id} has ${nodeXrefsResult.cross_references.length} cross-reference(s)` };
        case 'apply':
          if (!node_id || !target_node_id || !type_name) throw new Error('node_id, target_node_id, and type_name required');
          const applyXrefResult = await client.applyRMCrossRef({ node_id, ref_node_id: target_node_id, xref_type: type_name });
          return { success: true, result: applyXrefResult, message: `Cross-reference created between ${node_id} and ${target_node_id}` };
        case 'remove':
          if (!node_id || !target_node_id || !type_name) throw new Error('node_id, target_node_id, and type_name required');
          const removeXrefResult = await client.removeRMCrossRef(node_id, type_name, target_node_id);
          return { success: true, result: removeXrefResult, message: `Cross-reference removed between ${node_id} and ${target_node_id}` };
        case 'apply_batch':
          if (!node_ids || !target_node_ids || !type_name) throw new Error('node_ids, target_node_ids, and type_name required');
          if (node_ids.length !== target_node_ids.length) throw new Error('node_ids and target_node_ids must have same length');
          const applyBatchResult = await client.applyRMCrossRefBatch(node_ids, type_name, target_node_ids[0]);
          return { success: true, result: applyBatchResult, message: `${node_ids.length} cross-reference(s) created` };
        case 'remove_batch':
          if (!node_ids || !target_node_ids || !type_name) throw new Error('node_ids, target_node_ids, and type_name required');
          if (node_ids.length !== target_node_ids.length) throw new Error('node_ids and target_node_ids must have same length');
          const removeBatchResult = await client.removeRMCrossRefBatch(node_ids, type_name, target_node_ids[0]);
          return { success: true, result: removeBatchResult, message: `${node_ids.length} cross-reference(s) removed` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case 'otcs_rm_rsi': {
      const {
        action, rsi_id, node_id, class_id, stage_id,
        name, new_name, status, status_date, description, subject, title,
        disp_control, discontinue, discontinue_date, discontinue_comment,
        stage, object_type, event_type, date_to_use,
        retention_years, retention_months, retention_days,
        action_code, disposition, comment,
        page, limit
      } = args as {
        action: string; rsi_id?: number; node_id?: number; class_id?: number; stage_id?: number;
        name?: string; new_name?: string; status?: string; status_date?: string;
        description?: string; subject?: string; title?: string;
        disp_control?: boolean; discontinue?: boolean; discontinue_date?: string; discontinue_comment?: string;
        stage?: string; object_type?: 'LIV' | 'LRM'; event_type?: number; date_to_use?: number;
        retention_years?: number; retention_months?: number; retention_days?: number;
        action_code?: number; disposition?: string; comment?: string;
        page?: number; limit?: number;
      };

      switch (action) {
        case 'list':
          const listResult = await client.listRMRSIs({ page, limit });
          return { rsis: listResult.rsis, count: listResult.rsis.length, total_count: listResult.total_count, message: `Found ${listResult.total_count} RSI(s)` };
        case 'get':
          if (!rsi_id) throw new Error('rsi_id required');
          const rsi = await client.getRMRSI(rsi_id);
          return { rsi, schedule_count: rsi.schedules?.length || 0, message: `Retrieved RSI "${rsi.name}"` };
        case 'create':
          if (!name || !status) throw new Error('name and status required');
          const newRsi = await client.createRMRSI({ name, status, status_date, description, subject, title, disp_control });
          return { success: true, rsi: newRsi, message: `RSI "${name}" created with ID ${newRsi.id}` };
        case 'update':
          if (!rsi_id) throw new Error('rsi_id required');
          const updatedRsi = await client.updateRMRSI(rsi_id, { new_name, status, status_date, description, subject, title, disp_control, discontinue, discontinue_date, discontinue_comment });
          return { success: true, rsi: updatedRsi, message: `RSI ${rsi_id} updated` };
        case 'delete':
          if (!rsi_id) throw new Error('rsi_id required');
          await client.deleteRMRSI(rsi_id);
          return { success: true, message: `RSI ${rsi_id} deleted` };
        case 'get_node_rsis':
          if (!node_id) throw new Error('node_id required');
          const nodeRsisResult = await client.getNodeRMRSIs(node_id);
          return { node_id, rsis: nodeRsisResult.rsis, count: nodeRsisResult.rsis.length, message: `Node ${node_id} has ${nodeRsisResult.rsis.length} RSI(s) assigned` };
        case 'assign':
          if (!node_id || !class_id || !rsi_id) throw new Error('node_id, class_id, and rsi_id required');
          await client.assignRMRSI({ node_id, class_id, rsi_id, status_date });
          return { success: true, message: `RSI ${rsi_id} assigned to node ${node_id} under classification ${class_id}` };
        case 'remove':
          if (!node_id || !class_id) throw new Error('node_id and class_id required');
          await client.removeRMRSI(node_id, class_id);
          return { success: true, message: `RSI removed from node ${node_id}` };
        case 'get_items':
          if (!rsi_id) throw new Error('rsi_id required');
          const itemsResult = await client.getRMRSIItems(rsi_id, { page, limit });
          return { rsi_id, items: itemsResult.items, count: itemsResult.items.length, total_count: itemsResult.total_count, message: `RSI ${rsi_id} has ${itemsResult.total_count} item(s)` };
        case 'get_schedules':
          if (!rsi_id) throw new Error('rsi_id required');
          const schedules = await client.getRMRSISchedules(rsi_id);
          return { rsi_id, schedules, count: schedules.length, message: `RSI ${rsi_id} has ${schedules.length} schedule stage(s)` };
        case 'create_schedule':
          if (!rsi_id || !stage || !object_type || event_type === undefined) throw new Error('rsi_id, stage, object_type, and event_type required');
          const newSchedule = await client.createRMRSISchedule({
            rsi_id, stage, object_type, event_type, date_to_use,
            retention_years, retention_months, retention_days,
            action_code, disposition, description
          });
          return { success: true, schedule: newSchedule, message: `Schedule stage "${stage}" created for RSI ${rsi_id}` };
        case 'approve_schedule':
          if (!rsi_id || !stage_id) throw new Error('rsi_id and stage_id required');
          await client.approveRMRSISchedule(rsi_id, stage_id, comment);
          return { success: true, message: `Schedule stage ${stage_id} approved for RSI ${rsi_id}` };
        case 'get_approval_history':
          if (!rsi_id) throw new Error('rsi_id required');
          const history = await client.getRMRSIApprovalHistory(rsi_id);
          return { rsi_id, history, count: history.length, message: `RSI ${rsi_id} has ${history.length} approval(s)` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Sharing ====================
    case 'otcs_share': {
      const {
        action, node_ids, node_id, invitees,
        expire_date, share_initiator_role, sharing_message, coordinators
      } = args as {
        action: string;
        node_ids?: number[];
        node_id?: number;
        invitees?: Array<{ business_email: string; perm: number; name?: string }>;
        expire_date?: string;
        share_initiator_role?: number;
        sharing_message?: string;
        coordinators?: number[];
      };

      switch (action) {
        case 'list':
          const listResult = await client.listShares();
          return {
            shares: listResult.shares,
            total_count: listResult.total_count,
            message: listResult.total_count === 0
              ? 'No active shares found'
              : `Found ${listResult.total_count} active share(s)`,
          };
        case 'create':
          if (!node_ids || node_ids.length === 0) throw new Error('node_ids required');
          const shareResult = await client.createShare({
            node_ids,
            invitees: invitees as any,
            expire_date,
            share_initiator_role: share_initiator_role as any,
            sharing_message,
            coordinators,
          });
          return {
            success: shareResult.success,
            node_ids: shareResult.node_ids,
            partial: shareResult.partial,
            message: shareResult.message || `Shared ${node_ids.length} item(s)`,
          };
        case 'stop':
          if (!node_id) throw new Error('node_id required');
          const stopResult = await client.stopShare(node_id);
          return { success: stopResult.success, node_id, message: stopResult.message };
        case 'stop_batch':
          if (!node_ids || node_ids.length === 0) throw new Error('node_ids required');
          const batchResult = await client.stopShareBatch(node_ids);
          return {
            success: batchResult.success,
            count: batchResult.count,
            failed: batchResult.failed,
            message: batchResult.failed.length === 0
              ? `Stopped sharing ${batchResult.count} item(s)`
              : `Stopped sharing ${batchResult.count} item(s), ${batchResult.failed.length} failed`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Tree Browsing & Creation ====================
    case 'otcs_browse_tree': {
      const { folder_id, max_depth, folders_only } = args as { folder_id: number; max_depth?: number; folders_only?: boolean };
      const tree = await client.getTree(folder_id, max_depth ?? 5, folders_only ?? true);
      return { tree };
    }

    case 'otcs_create_folder_structure': {
      const { parent_id, folders } = args as { parent_id: number; folders: Array<{ name: string; children?: Array<any> }> };
      const result = await client.createFolderTree(parent_id, folders);
      return { success: true, folders: result };
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
    '.tif': 'image/tiff', '.tiff': 'image/tiff',
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
