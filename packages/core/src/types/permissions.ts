// ============ Permission Types ============

/**
 * Permission string constants
 */
export const PermissionStrings = {
  SEE: 'see',
  SEE_CONTENTS: 'see_contents',
  MODIFY: 'modify',
  EDIT_ATTRIBUTES: 'edit_attributes',
  ADD_ITEMS: 'add_items',
  RESERVE: 'reserve',
  ADD_MAJOR_VERSION: 'add_major_version',
  DELETE_VERSIONS: 'delete_versions',
  DELETE: 'delete',
  EDIT_PERMISSIONS: 'edit_permissions',
} as const;

export type PermissionString = (typeof PermissionStrings)[keyof typeof PermissionStrings];

/**
 * Apply-to scope for permission operations
 */
export const ApplyToScope = {
  THIS_ITEM: 0,
  SUB_ITEMS: 1,
  THIS_AND_SUB_ITEMS: 2,
  THIS_AND_IMMEDIATE_SUB_ITEMS: 3,
} as const;

export type ApplyToScopeValue = (typeof ApplyToScope)[keyof typeof ApplyToScope];

/**
 * Permission entry for a user/group on a node
 */
export interface PermissionEntry {
  right_id: number;
  right_name?: string;
  right_type?: number; // 0=user, 1=group
  right_type_name?: string;
  permissions: PermissionString[];
  permission_type?: 'owner' | 'group' | 'public' | 'custom';
}

/**
 * Complete permissions on a node
 */
export interface NodePermissions {
  node_id: number;
  owner?: PermissionEntry;
  group?: PermissionEntry;
  public_access?: PermissionEntry;
  custom_permissions: PermissionEntry[];
}

/**
 * Parameters for adding/updating permissions
 */
export interface PermissionUpdateParams {
  node_id: number;
  right_id?: number; // User/group ID (required for custom, optional for owner/group)
  permissions: PermissionString[];
  apply_to?: ApplyToScopeValue;
  include_sub_types?: number[];
}

/**
 * Response from permission operations
 */
export interface PermissionOperationResponse {
  success: boolean;
  message?: string;
}

/**
 * Effective permissions for a user on a node
 */
export interface EffectivePermissions {
  node_id: number;
  member_id: number;
  permissions: PermissionString[];
}
