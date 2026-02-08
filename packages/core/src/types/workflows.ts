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

export interface WorkflowStatusAssignee {
  userId: number;
  loginName: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  phone?: string;
}

export interface WorkflowStatusTask {
  process_id: number;
  subprocess_id: number;
  task_id: number;
  task_name: string;
  task_due_date?: string;
  task_start_date?: string;
  task_status?: string;
  task_assignees?: {
    assignee: WorkflowStatusAssignee[];
    assigneeCount: number;
    currentAssignee?: string;
  };
}

export interface WorkflowStatus {
  process_id: number;
  subprocess_id?: number;
  task_id?: number;
  workflow_name: string;
  status_key: string;
  step_name?: string;
  assignees?: WorkflowStatusAssignee[];
  assignee_count?: number;
  date_initiated?: string;
  due_date?: string;
  steps_count?: number;
  comments_on?: boolean;
  current_tasks?: WorkflowStatusTask[];
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
  data: Record<string, unknown>; // Current field values
  options: {
    fields?: Record<
      string,
      {
        label?: string;
        helper?: string;
        type?: string;
        hidden?: boolean;
        readonly?: boolean;
        order?: number;
        optionLabels?: string[];
        placeholder?: string;
      }
    >;
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
  type?: string; // 'delegate', 'review', 'review_return'
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
    task_id?: number;
    type?: number;
    status: string;
    performer_id?: number;
    date_started?: string;
    date_completed?: string;
  }>;
  comments?: Array<{
    comment: string;
    date: string;
    user_name: string;
    step_name?: string;
    task_id?: number;
  }>;
  audit_info?: Array<{
    date: string;
    user_name: string;
    user_id?: number;
    message: string;
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
