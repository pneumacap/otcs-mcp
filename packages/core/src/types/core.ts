// Configuration types
export interface OTCSConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  domain?: string;
  /** Disable TLS certificate verification (for self-signed certs in dev). */
  tlsSkipVerify?: boolean;
}

// API Response types
export interface OTCSAuthResponse {
  ticket: string;
}

export interface OTCSError {
  error: string;
  errorDetail?: string;
}

// Node types
export interface OTCSNode {
  id: number;
  parent_id: number;
  name: string;
  type: number;
  type_name: string;
  description?: string;
  create_date: string;
  create_user_id: number;
  modify_date: string;
  modify_user_id: number;
  owner_user_id?: number;
  owner_group_id?: number;
  reserved?: boolean;
  reserved_user_id?: number;
  reserved_date?: string;
  size?: number;
  mime_type?: string;
  container?: boolean;
  container_size?: number;
  favorite?: boolean;
  permissions?: OTCSPermissions;
  versions_control_advanced?: boolean;
  volume_id?: number;
}

export interface OTCSPermissions {
  perm_see?: boolean;
  perm_see_contents?: boolean;
  perm_modify?: boolean;
  perm_modify_attributes?: boolean;
  perm_modify_permissions?: boolean;
  perm_create?: boolean;
  perm_delete?: boolean;
  perm_delete_versions?: boolean;
  perm_reserve?: boolean;
  perm_add_major_version?: boolean;
}

export interface OTCSNodeResponse {
  links?: {
    data?: {
      self?: { href: string };
    };
  };
  results?:
    | {
        data?: {
          properties: OTCSNode;
        };
      }
    | OTCSNode;
}

export interface OTCSNodesResponse {
  links?: {
    data?: {
      self?: { href: string };
    };
  };
  results?: Array<{
    data?: {
      properties: OTCSNode;
    };
  }>;
  collection?: {
    paging?: {
      limit: number;
      page: number;
      page_total: number;
      range_max: number;
      range_min: number;
      total_count: number;
    };
  };
}

export interface OTCSCreateNodeResponse {
  id: number;
  name?: string;
  type?: number;
}

// Ancestor/path types
export interface OTCSAncestor {
  id: number;
  name: string;
  parent_id: number;
  type: number;
  type_name: string;
  volume_id: number;
}

// Volume types
export interface OTCSVolume {
  id: number;
  name: string;
  type: number;
  type_name: string;
}

// Version types
export interface OTCSVersion {
  version_number: number;
  version_number_major?: number;
  version_number_minor?: number;
  version_number_name?: string;
  create_date: string;
  description?: string;
  file_size?: number;
  mime_type?: string;
  owner_id: number;
}

// Tool response types - what we return to the agent
export interface NodeInfo {
  id: number;
  name: string;
  type: number;
  type_name: string;
  parent_id: number;
  path?: string[];
  description?: string;
  create_date: string;
  modify_date: string;
  size?: number;
  mime_type?: string;
  container: boolean;
  container_size?: number;
  permissions: {
    can_see: boolean;
    can_modify: boolean;
    can_delete: boolean;
    can_add_items: boolean;
  };
}

export interface FolderContents {
  folder: NodeInfo;
  items: NodeInfo[];
  paging: {
    page: number;
    page_size: number;
    total_count: number;
    page_total: number;
  };
}

export interface FolderTreeNode {
  id: number;
  name: string;
  type: number;
  type_name: string;
  children?: FolderTreeNode[];
}

// Node type constants
export const NodeTypes = {
  FOLDER: 0,
  SHORTCUT: 1,
  GENERATION: 2,
  WORKFLOW_MAP: 128,
  CATEGORY: 131,
  COMPOUND_DOCUMENT: 136,
  URL: 140,
  DOCUMENT: 144,
  PROJECT: 202,
  TASK_LIST: 204,
  TASK_GROUP: 205,
  TASK: 206,
  CHANNEL: 207,
  NEWS: 208,
  MILESTONE: 212,
  BUSINESS_WORKSPACE: 848,
  VIRTUAL_FOLDER: 899,
} as const;
