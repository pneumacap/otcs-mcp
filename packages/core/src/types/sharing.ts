// ============ Sharing Types ============

/**
 * Share invitee permission levels
 * 1=Viewer, 2=Collaborator, 3=Manager, 4=Owner
 */
export const SharePermissions = {
  VIEWER: 1,
  COLLABORATOR: 2,
  MANAGER: 3,
  OWNER: 4,
} as const;

export type SharePermission = (typeof SharePermissions)[keyof typeof SharePermissions];

/**
 * Share invitee identity types
 * 1=User, 2=Pending User, 3=Group
 */
export const ShareIdentityTypes = {
  USER: 1,
  PENDING_USER: 2,
  GROUP: 3,
} as const;

export type ShareIdentityType = (typeof ShareIdentityTypes)[keyof typeof ShareIdentityTypes];

/**
 * Invitee to share with
 */
export interface ShareInvitee {
  id?: string;
  business_email: string;
  name?: string;
  perm: SharePermission;
  identityType?: ShareIdentityType;
  providerId?: string;
}

/**
 * Parameters for creating a share
 */
export interface ShareCreateParams {
  node_ids: number[];
  share_provider?: string;
  expire_date?: string;
  share_initiator_role?: SharePermission;
  invitees?: ShareInvitee[];
  sharing_message?: string;
  coordinators?: number[];
}

/**
 * Share information returned from API
 */
export interface ShareInfo {
  node_ids: number[];
  success: boolean;
  partial?: boolean;
  message?: string;
}

/**
 * Response from share operations
 */
export interface ShareOperationResponse {
  success: boolean;
  message?: string;
  partial?: boolean;
}

/**
 * Shared item information from the shares list
 */
export interface SharedItem {
  node_id: number;
  name: string;
  type: number;
  type_name: string;
  share_id?: string;
  shared_date?: string;
  expire_date?: string;
  share_provider?: string;
  invitees?: Array<{
    email: string;
    name?: string;
    permission: number;
    permission_name?: string;
  }>;
}

/**
 * Response from listing shares
 */
export interface ShareListResponse {
  shares: SharedItem[];
  total_count: number;
}
