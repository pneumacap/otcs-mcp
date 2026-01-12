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

// ============ Workflow Forms & Attributes Types ============

/**
 * Alpaca form field schema from /v1/forms/processes/tasks/update
 */
export interface AlpacaFormField {
  type?: string;
  title?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  readonly?: boolean;
  hidden?: boolean;
  format?: string;
  maxLength?: number;
  minLength?: number;
  maximum?: number;
  minimum?: number;
  properties?: Record<string, AlpacaFormField>;
  items?: AlpacaFormField;
}

/**
 * Alpaca form structure returned by workflow form endpoints
 */
export interface AlpacaForm {
  data: Record<string, unknown>;          // Current field values
  options: {
    fields?: Record<string, {
      label?: string;
      helper?: string;
      type?: string;
      hidden?: boolean;
      readonly?: boolean;
      order?: number;
      optionLabels?: string[];
      placeholder?: string;
    }>;
    form?: Record<string, unknown>;
  };
  schema: {
    type?: string;
    properties?: Record<string, AlpacaFormField>;
    required?: string[];
  };
  columns?: 1 | 2;
}

/**
 * Workflow action (standard or custom disposition)
 */
export interface WorkflowFormAction {
  key: string;
  label: string;
}

/**
 * Data package info (attachments=1, comments=2, attributes=3)
 */
export interface WorkflowFormDataPackage {
  type: number;
  sub_type: number;
  data?: Record<string, unknown>;
}

/**
 * Workflow task info from form schema
 */
export interface WorkflowFormTaskInfo {
  type?: number;
  sub_type?: number;
  data?: Record<string, unknown>;
}

/**
 * Message info for delegate/review workflows
 */
export interface WorkflowFormMessage {
  performer?: number;
  type?: string;  // 'delegate', 'review', 'review_return'
  text?: string;
}

/**
 * Complete workflow properties form info from /v1/forms/processes/tasks/update
 */
export interface WorkflowPropertiesFormInfo {
  data: {
    title?: string;
    instructions?: string;
    priority?: number;
    comments_on?: boolean;
    attachments_on?: boolean;
    data_packages?: WorkflowFormDataPackage[];
    actions?: WorkflowFormAction[];
    custom_actions?: WorkflowFormAction[];
    message?: WorkflowFormMessage;
    member_accept?: boolean;
    reply_performer_id?: number;
    task?: WorkflowFormTaskInfo;
    authentication?: boolean;
  };
  forms: AlpacaForm[];
}

/**
 * Parameters for updating draft workflow form
 */
export interface UpdateDraftFormParams {
  draftprocess_id: number;
  action: 'formUpdate' | 'Initiate';
  comment?: string;
  values?: Record<string, unknown>;
}

/**
 * Workflow info response from /v2/workflows/status/info
 */
export interface WorkflowInfoResponse {
  results: {
    Attachments?: number;
    Attributes?: Array<{
      Content?: {
        Rootset?: {
          Children?: Array<{
            DisplayName?: string;
            ID?: string;
            Name?: string;
            Type?: string;
            Value?: unknown;
          }>;
          DisplayName?: string;
          ID?: string;
          Name?: string;
        };
      };
    }>;
    auditInfo?: Array<{
      action?: string;
      date?: string;
      performer?: string;
      step?: string;
    }>;
    comments?: Array<{
      comment?: string;
      date?: string;
      user_id?: number;
      user_name?: string;
    }>;
    forms?: Array<{
      AvailableForms?: {
        data?: Record<string, unknown>;
      };
    }>;
    generalInfo?: Array<{
      date_due?: string;
      date_initiated?: string;
      initiator_id?: number;
      initiator_name?: string;
      status?: string;
      title?: string;
      wf_name?: string;
      work_id?: number;
    }>;
    ManagerList?: Array<{
      id?: number;
      name?: string;
    }>;
    stepList?: Array<{
      disposition?: string;
      performer?: string;
      start_date?: string;
      step_name?: string;
      status?: string;
    }>;
  };
}

/**
 * Simplified workflow info for agent consumption
 */
export interface WorkflowInfo {
  work_id: number;
  title: string;
  status: string;
  date_initiated?: string;
  date_due?: string;
  initiator?: {
    id: number;
    name: string;
  };
  managers?: Array<{
    id: number;
    name: string;
  }>;
  steps?: Array<{
    step_name: string;
    status: string;
    performer?: string;
    disposition?: string;
    start_date?: string;
  }>;
  comments?: Array<{
    comment: string;
    date: string;
    user_name: string;
  }>;
  attributes?: Record<string, unknown>;
  attachment_count?: number;
}

/**
 * Accept task response
 */
export interface AcceptTaskResponse {
  success: boolean;
  message?: string;
}

// ============ Category & Metadata Types ============

/**
 * Category applied to a node
 */
export interface CategoryInfo {
  id: number;
  name: string;
  display_name?: string;
}

/**
 * Category attribute definition
 */
export interface CategoryAttribute {
  key: string;
  name: string;
  type: string;
  type_name?: string;
  required?: boolean;
  multi_value?: boolean;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  default_value?: unknown;
  read_only?: boolean;
  hidden?: boolean;
  valid_values?: Array<{ key: string; value: string }>;
  description?: string;
}

/**
 * Category with its attributes and values
 */
export interface CategoryWithValues {
  id: number;
  name: string;
  display_name?: string;
  attributes: Array<{
    key: string;
    name: string;
    type: string;
    value?: unknown;
    values?: unknown[];
    display_value?: string;
  }>;
}

/**
 * Category values to set/update (keyed by attribute key)
 * Key format: {category_id}_{attribute_id} or {category_id}_{set_id}_{row}_{attribute_id}
 */
export interface CategoryValues {
  [key: string]: unknown;
}

/**
 * Response from adding a category
 */
export interface AddCategoryResponse {
  success: boolean;
  category_id: number;
  message?: string;
}

/**
 * Category form schema for creating/updating categories
 */
export interface CategoryFormSchema {
  category_id: number;
  category_name: string;
  attributes: CategoryAttribute[];
}

/**
 * Response containing categories on a node
 */
export interface NodeCategoriesResponse {
  node_id: number;
  categories: CategoryWithValues[];
}

/**
 * Workspace metadata form schema
 */
export interface WorkspaceMetadataFormSchema {
  workspace_id: number;
  categories: CategoryFormSchema[];
}

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
  type?: 0 | 1;  // 0=user, 1=group
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

export type PermissionString = typeof PermissionStrings[keyof typeof PermissionStrings];

/**
 * Apply-to scope for permission operations
 */
export const ApplyToScope = {
  THIS_ITEM: 0,
  SUB_ITEMS: 1,
  THIS_AND_SUB_ITEMS: 2,
  THIS_AND_IMMEDIATE_SUB_ITEMS: 3,
} as const;

export type ApplyToScopeValue = typeof ApplyToScope[keyof typeof ApplyToScope];

/**
 * Permission entry for a user/group on a node
 */
export interface PermissionEntry {
  right_id: number;
  right_name?: string;
  right_type?: number;  // 0=user, 1=group
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
  right_id?: number;  // User/group ID (required for custom, optional for owner/group)
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
