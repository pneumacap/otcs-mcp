// ============ Member (Users & Groups) Types ============

/**
 * Member type constants
 */
export const MemberTypes = {
  USER: 0,
  GROUP: 1,
} as const;

/**
 * Member info returned from /v2/members/{id} or search results
 */
export interface MemberInfo {
  id: number;
  name: string;
  type: number;
  type_name: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  title?: string;
  business_email?: string;
  business_phone?: string;
  business_fax?: string;
  office_location?: string;
  time_zone?: number;
  birth_date?: string;
  cell_phone?: string;
  personal_email?: string;
  group_id?: number;
  leader_id?: number;
  photo_url?: string;
  deleted?: boolean;
  privileges?: MemberPrivileges;
}

/**
 * Member privileges
 */
export interface MemberPrivileges {
  create_users?: boolean;
  create_groups?: boolean;
  login_enabled?: boolean;
  admin?: boolean;
  system_admin?: boolean;
}

/**
 * Search result for members
 */
export interface MemberSearchResult {
  results: MemberInfo[];
  total_count: number;
  page: number;
  page_size: number;
}

/**
 * Options for searching members
 */
export interface MemberSearchOptions {
  type?: 0 | 1; // 0=user, 1=group
  query?: string;
  where_name?: string;
  where_first_name?: string;
  where_last_name?: string;
  where_business_email?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

/**
 * Group membership info
 */
export interface GroupMembershipInfo {
  user_id: number;
  groups: MemberInfo[];
  total_count: number;
}

/**
 * Group members response
 */
export interface GroupMembersResponse {
  group_id: number;
  members: MemberInfo[];
  total_count: number;
}
