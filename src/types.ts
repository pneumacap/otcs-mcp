// Configuration types
export interface OTCSConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  domain?: string;
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
  results?: {
    data?: {
      properties: OTCSNode;
    };
  } | OTCSNode;
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

// ============ Workflow & Assignment Types ============

export interface WorkflowAssignment {
  id: number;
  name: string;
  type: number;
  type_name: string;
  description?: string;
  instructions?: string;
  priority: number;
  priority_name: string;
  status: number;
  status_name: string;
  date_due?: string;
  from_user_id?: number;
  location_id?: number;
  workflow_id: number;
  workflow_subworkflow_id: number;
  workflow_subworkflow_task_id: number;
  maptask_subtype?: number;
  favorite?: boolean;
}

export interface WorkflowAssignmentsResponse {
  results: Array<{
    data: {
      assignments: WorkflowAssignment[];
    };
  }>;
}

export interface WorkflowStatus {
  workflow_id: number;
  workflow_name: string;
  workflow_status: string;
  date_initiated?: string;
  date_due?: string;
  initiator?: {
    id: number;
    name: string;
  };
  tasks?: WorkflowTaskSummary[];
  permissions?: WorkflowPermissions;
}

export interface WorkflowTaskSummary {
  task_id: number;
  task_name: string;
  task_status?: string;
  assignees?: WorkflowAssignee[];
}

export interface WorkflowAssignee {
  id: number;
  name: string;
  type?: number;
}

export interface WorkflowPermissions {
  can_archive?: boolean;
  can_change_attributes?: boolean;
  can_delete?: boolean;
  can_modify_route?: boolean;
  can_manage_permissions?: boolean;
  can_see_details?: boolean;
  can_stop?: boolean;
  can_suspend?: boolean;
}

export interface WorkflowStatusListResponse {
  results: {
    data: Array<{
      properties: WorkflowStatus;
    }>;
    permissions?: WorkflowPermissions;
  };
}

export interface WorkflowDefinition {
  workflow_id: number;
  data_packages?: WorkflowDataPackage[];
  tasks?: WorkflowDefinitionTask[];
}

export interface WorkflowDataPackage {
  data?: Record<string, unknown>;
  description?: string;
  type?: number;
  sub_type?: number;
}

export interface WorkflowDefinitionTask {
  data?: Record<string, unknown>;
  description?: string;
  instructions?: string;
  sub_type?: number;
  task_id: number;
  title: string;
  type?: number;
}

export interface WorkflowDefinitionResponse {
  results: {
    data: WorkflowDefinition;
  };
}

export interface WorkflowTaskList {
  attachments?: WorkflowAttachment[];
  data_packages?: WorkflowDataPackage[];
  details?: WorkflowDetails;
  tasks?: {
    completed?: WorkflowTaskInfo[];
    current?: WorkflowTaskInfo[];
    next?: WorkflowTaskInfo[];
  };
  permissions?: WorkflowPermissions;
}

export interface WorkflowAttachment {
  id: number;
  name: string;
  type?: number;
}

export interface WorkflowDetails {
  date_initiated?: string;
  date_due?: string;
  initiator?: {
    id: number;
    name: string;
  };
  workflow_name: string;
  workflow_id: number;
}

export interface WorkflowTaskInfo {
  task_id: number;
  task_name: string;
  assignees?: Array<{
    group?: WorkflowAssignee[];
    individual?: WorkflowAssignee;
  }>;
}

export interface WorkflowTaskListResponse {
  results: {
    data: WorkflowTaskList;
  };
}

export interface WorkflowActivity {
  action?: string;
  comment?: string;
  date?: string;
  performer?: {
    id: number;
    name: string;
  };
  step_name?: string;
}

export interface WorkflowActivitiesResponse {
  results: {
    data: {
      activities: WorkflowActivity[];
    };
  };
}

export interface DraftProcessResponse {
  draftprocess_id: number;
  workflow_type?: number;
}

export interface WorkflowInitiateParams {
  workflow_id: number;
  role_info?: Record<string, number>;
  doc_ids?: string;
  attach_documents?: boolean;
}

export interface WorkflowInitiateResponse {
  work_id: number;
  workflow_id: number;
}

export interface WorkflowTaskActionParams {
  process_id: number;
  subprocess_id: number;
  task_id: number;
  action?: string;
  custom_action?: string;
  comment?: string;
  /** Workflow form field values (e.g., {"WorkflowForm_10": "01/12/2026"}) */
  form_data?: Record<string, string>;
}

export interface WorkflowStatusChangeParams {
  process_id: number;
  status: 'suspend' | 'resume' | 'stop' | 'archive';
}

export interface ActiveWorkflowsOptions {
  map_id?: number;
  search_name?: string;
  business_workspace_id?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  kind?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface WorkflowFormSchema {
  workflow_id: number;
  subprocess_id: number;
  task_id: number;
  title?: string;
  instructions?: string;
  priority?: number;
  comments_enabled?: boolean;
  attachments_enabled?: boolean;
  actions?: WorkflowAction[];
  custom_actions?: WorkflowAction[];
  data_packages?: WorkflowDataPackage[];
}

export interface WorkflowAction {
  key: string;
  label: string;
}

export interface WorkflowFormResponse {
  forms: Array<{
    data: WorkflowFormSchema;
  }>;
}
