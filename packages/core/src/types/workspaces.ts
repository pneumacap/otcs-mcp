import type { NodeInfo } from './core';
import type { CategoryFormSchema } from './categories';

// ============ Business Workspace Types ============

export interface WorkspaceType {
  wksp_type_id: number;
  wksp_type_name: string;
  wksp_type_icon?: string;
  template_id?: number;
  template_name?: string;
  subtype?: number;
  rm_enabled?: boolean;
}

export interface WorkspaceTypesResponse {
  results: WorkspaceType[];
}

export interface WorkspaceInfo extends NodeInfo {
  workspace_type_id: number;
  workspace_type_name: string;
  business_properties?: Record<string, unknown>;
}

export interface WorkspaceCreateParams {
  template_id: number;
  name: string;
  parent_id?: number;
  description?: string;
  business_properties?: Record<string, unknown>;
  roles?: Record<string, unknown>;
}

export interface WorkspaceRole {
  id: number;
  name: string;
  description?: string;
  leader?: boolean;
  members?: WorkspaceMember[];
  member_count?: number;
}

export interface WorkspaceMember {
  id: number;
  name: string;
  type: 'user' | 'group';
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface WorkspaceRelation {
  rel_id: number;
  rel_type: string;
  workspace_id: number;
  workspace_name: string;
  workspace_type_name?: string;
}

export interface WorkspaceSearchOptions {
  workspace_type_id?: number;
  workspace_type_name?: string;
  where_name?: string;
  where_column_query?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface WorkspaceSearchResult {
  results: WorkspaceInfo[];
  total_count: number;
  page: number;
  page_size: number;
}

// Form schema types for workspace creation
export interface FormField {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  default_value?: unknown;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  options?: Array<{ key: string; value: string }>;
  description?: string;
}

export interface WorkspaceFormSchema {
  fields: FormField[];
  categories?: Array<{
    id: number;
    name: string;
    fields: FormField[];
  }>;
}

/**
 * Workspace metadata form schema
 */
export interface WorkspaceMetadataFormSchema {
  workspace_id: number;
  categories: CategoryFormSchema[];
}
