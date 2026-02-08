import type {
  WorkflowAssignment,
  WorkflowStatus,
  WorkflowDefinition,
  WorkflowTaskList,
  WorkflowActivity,
  WorkflowInitiateParams,
  WorkflowTaskActionParams,
  ActiveWorkflowsOptions,
  WorkflowFormSchema,
  WorkflowPropertiesFormInfo,
  UpdateDraftFormParams,
  WorkflowInfo,
  AcceptTaskResponse,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    getAssignments(): Promise<WorkflowAssignment[]>;
    getWorkflowStatus(options?: {
      wstatus?: string;
      kind?: string;
      sort?: string;
      wfretention?: number;
    }): Promise<WorkflowStatus[]>;
    getActiveWorkflows(options?: ActiveWorkflowsOptions): Promise<WorkflowStatus[]>;
    getWorkflowDefinition(mapId: number): Promise<WorkflowDefinition>;
    getWorkflowTasks(processId: number): Promise<WorkflowTaskList>;
    getWorkflowActivities(
      processId: number,
      subprocessId: number,
      limit?: number,
    ): Promise<WorkflowActivity[]>;
    createDraftWorkflow(
      workflowId: number,
      docIds?: string,
      attachDocuments?: boolean,
    ): Promise<{ draftprocess_id: number; workflow_type?: number }>;
    initiateWorkflow(
      params: WorkflowInitiateParams,
    ): Promise<{ work_id: number; workflow_id: number }>;
    startWorkflow(workflowId: number, docIds?: string): Promise<{ work_id: number }>;
    sendWorkflowTask(params: WorkflowTaskActionParams): Promise<void>;
    updateWorkflowStatus(
      processId: number,
      status: 'suspend' | 'resume' | 'stop' | 'archive',
    ): Promise<void>;
    deleteWorkflow(processId: number): Promise<void>;
    getWorkflowTaskForm(
      processId: number,
      subprocessId: number,
      taskId: number,
    ): Promise<WorkflowFormSchema>;
    getWorkflowTaskFormFull(
      processId: number,
      subprocessId: number,
      taskId: number,
    ): Promise<WorkflowPropertiesFormInfo>;
    getDraftWorkflowForm(draftprocessId: number): Promise<WorkflowPropertiesFormInfo>;
    updateDraftWorkflowForm(params: UpdateDraftFormParams): Promise<void>;
    getWorkflowInfoFull(workId: number): Promise<WorkflowInfo>;
    getWorkflowInfo(workflowInstanceId: number): Promise<WorkflowStatus>;
    acceptWorkflowTask(
      processId: number,
      subprocessId: number,
      taskId: number,
    ): Promise<AcceptTaskResponse>;
    checkGroupAssignment(processId: number, subprocessId: number, taskId: number): Promise<boolean>;
    /** @internal */ transformWorkflowStatus(wfstatus: any, permissions?: any): WorkflowStatus;
    /** @internal */ transformActiveWorkflow(item: any): WorkflowStatus;
  }
}

OTCSClient.prototype.getAssignments = async function (
  this: OTCSClient,
): Promise<WorkflowAssignment[]> {
  const response = await this.request<any>('GET', '/v2/members/assignments');

  const assignments: WorkflowAssignment[] = [];

  let items: any[] = [];

  if (Array.isArray(response.results)) {
    for (const result of response.results) {
      const data = result.data || result;
      const resultAssignments = data.assignments || data.properties?.assignments;
      if (resultAssignments) {
        if (Array.isArray(resultAssignments)) {
          items = items.concat(resultAssignments);
        } else if (typeof resultAssignments === 'object') {
          items.push(resultAssignments);
        }
      }
    }
  } else if (response.results?.data?.assignments) {
    const a = response.results.data.assignments;
    items = Array.isArray(a) ? a : [a];
  } else if (response.data?.assignments) {
    const a = response.data.assignments;
    items = Array.isArray(a) ? a : [a];
  } else if (Array.isArray(response.assignments)) {
    items = response.assignments;
  }

  for (const item of items) {
    assignments.push({
      id: item.id,
      name: item.name,
      type: item.type,
      type_name: item.type_name,
      description: item.description,
      instructions: item.instructions,
      priority: item.priority,
      priority_name: item.priority_name,
      status: item.status,
      status_name: item.status_name,
      date_due: item.date_due,
      from_user_id: item.from_user_id,
      location_id: item.location_id,
      workflow_id: item.workflow_id,
      workflow_subworkflow_id: item.workflow_subworkflow_id,
      workflow_subworkflow_task_id: item.workflow_subworkflow_task_id,
      maptask_subtype: item.maptask_subtype,
      favorite: item.favorite,
    });
  }

  return assignments;
};

OTCSClient.prototype.getWorkflowStatus = async function (
  this: OTCSClient,
  options: {
    wstatus?: string;
    kind?: string;
    sort?: string;
    wfretention?: number;
  } = {},
): Promise<WorkflowStatus[]> {
  const params = new URLSearchParams();

  if (options.wstatus) params.append('wstatus', options.wstatus);
  if (options.kind) params.append('Kind', options.kind);
  if (options.sort) params.append('sort', options.sort);
  if (options.wfretention) params.append('wfretention', options.wfretention.toString());

  const path = `/v2/workflows/status${params.toString() ? '?' + params.toString() : ''}`;
  const response = await this.request<any>('GET', path);

  const results = response.results || [];
  return results.map((item: any) => {
    const wfstatus = item.data?.wfstatus || item.properties || item;
    const permissions = item.permissions;
    return this.transformWorkflowStatus(wfstatus, permissions);
  });
};

OTCSClient.prototype.getActiveWorkflows = async function (
  this: OTCSClient,
  options: ActiveWorkflowsOptions = {},
): Promise<WorkflowStatus[]> {
  const params = new URLSearchParams();

  if (options.map_id) params.append('mapObjId', options.map_id.toString());
  if (options.search_name) params.append('search_name', options.search_name);
  if (options.business_workspace_id)
    params.append('businessWorkspaceID', options.business_workspace_id.toString());
  if (options.start_date) params.append('fromDate', options.start_date);
  if (options.end_date) params.append('toDate', options.end_date);
  if (options.status) params.append('status', options.status);
  if (options.kind) params.append('Kind', options.kind);
  if (options.sort) params.append('sort', options.sort);

  const path = `/v2/workflows/status/active${params.toString() ? '?' + params.toString() : ''}`;
  const response = await this.request<any>('GET', path);

  const results = response.results || [];
  return results.map((item: any) => this.transformActiveWorkflow(item));
};

OTCSClient.prototype.getWorkflowDefinition = async function (
  this: OTCSClient,
  mapId: number,
): Promise<WorkflowDefinition> {
  const response = await this.request<any>('GET', `/v2/processes/${mapId}/definition`);

  const data = response.results?.data || response.results || response;
  return {
    workflow_id: data.workflow_id || mapId,
    data_packages: data.data_packages || [],
    tasks: (data.tasks || []).map((task: any) => ({
      task_id: task.task_id,
      title: task.title,
      description: task.description,
      instructions: task.instructions,
      type: task.type,
      sub_type: task.sub_type,
      data: task.data,
    })),
  };
};

OTCSClient.prototype.getWorkflowTasks = async function (
  this: OTCSClient,
  processId: number,
): Promise<WorkflowTaskList> {
  const response = await this.request<any>('GET', `/v2/workflows/status/processes/${processId}`);

  const data = response.results?.data || response.results || response;
  const stepList = data.step_list || data.tasks;
  const wfDetails = data.wf_details || data.details;
  return {
    attachments: data.attachments || [],
    data_packages: data.data_packages || [],
    details: wfDetails
      ? {
          date_initiated: wfDetails.date_initiated,
          date_due: wfDetails.due_date || wfDetails.date_due,
          initiator: wfDetails.initiator,
          workflow_name: wfDetails.wf_name || wfDetails.workflow_name,
          workflow_id: wfDetails.work_workID || wfDetails.workflow_id,
        }
      : undefined,
    tasks: stepList
      ? {
          completed: stepList.completed || [],
          current: stepList.current || [],
          next: stepList.next || [],
        }
      : undefined,
    permissions: data.permissions,
  };
};

OTCSClient.prototype.getWorkflowActivities = async function (
  this: OTCSClient,
  processId: number,
  subprocessId: number,
  limit?: number,
): Promise<WorkflowActivity[]> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());

  const path = `/v2/processes/${processId}/subprocesses/${subprocessId}/activities${params.toString() ? '?' + params.toString() : ''}`;
  const response = await this.request<any>('GET', path);

  const data = response.results?.data || response.results || response;
  const activities = data.activities || [];

  return activities.map((activity: any) => ({
    action: activity.action,
    comment: activity.comment,
    date: activity.date,
    performer: activity.performer,
    step_name: activity.step_name,
  }));
};

OTCSClient.prototype.createDraftWorkflow = async function (
  this: OTCSClient,
  workflowId: number,
  docIds?: string,
  attachDocuments?: boolean,
): Promise<{ draftprocess_id: number; workflow_type?: number }> {
  const formData = new URLSearchParams();
  formData.append('workflow_id', workflowId.toString());

  if (docIds) {
    formData.append('doc_ids', docIds);
  }
  if (attachDocuments) {
    formData.append('AttachDocuments', 'TRUE');
  }

  const response = await this.request<any>('POST', '/v2/draftprocesses', undefined, formData);

  const data = response.results?.data || response.results || response;
  return {
    draftprocess_id: data.draftprocess_id || data.id,
    workflow_type: data.workflow_type,
  };
};

OTCSClient.prototype.initiateWorkflow = async function (
  this: OTCSClient,
  params: WorkflowInitiateParams,
): Promise<{ work_id: number; workflow_id: number }> {
  // Build the body JSON structure
  const bodyJson = {
    definition: {
      workflow_id: params.workflow_id,
      role_info: params.role_info || {},
    },
  };

  // The API expects a form field called 'body' containing JSON
  const formData = new URLSearchParams();
  formData.append('body', JSON.stringify(bodyJson));

  const response = await this.request<any>('POST', '/v2/processes', undefined, formData);

  const data = response.results?.data || response.results || response;
  return {
    work_id: data.work_id || data.id,
    workflow_id: params.workflow_id,
  };
};

OTCSClient.prototype.startWorkflow = async function (
  this: OTCSClient,
  workflowId: number,
  docIds?: string,
): Promise<{ work_id: number }> {
  const formData = new URLSearchParams();
  formData.append('workflow_id', workflowId.toString());

  if (docIds) {
    formData.append('doc_ids', docIds);
  }

  const response = await this.request<any>(
    'POST',
    '/v2/draftprocesses/startwf',
    undefined,
    formData,
  );

  // API returns: {"results":{"custom_message":null,"process_id":176344}}
  const processId = response.results?.process_id || response.process_id;

  if (!processId) {
    throw new Error('Failed to get workflow instance ID from API response');
  }

  return {
    work_id: processId,
  };
};

OTCSClient.prototype.sendWorkflowTask = async function (
  this: OTCSClient,
  params: WorkflowTaskActionParams,
): Promise<void> {
  const formData = new URLSearchParams();

  if (params.action) {
    formData.append('action', params.action);
  }
  if (params.custom_action) {
    formData.append('custom_action', params.custom_action);
  }
  if (params.comment) {
    formData.append('comment', params.comment);
  }

  // Append workflow form field values
  if (params.form_data) {
    for (const [key, value] of Object.entries(params.form_data)) {
      formData.append(key, String(value));
    }
  }

  await this.request<void>(
    'PUT',
    `/v2/processes/${params.process_id}/subprocesses/${params.subprocess_id}/tasks/${params.task_id}`,
    undefined,
    formData,
  );
};

OTCSClient.prototype.updateWorkflowStatus = async function (
  this: OTCSClient,
  processId: number,
  status: 'suspend' | 'resume' | 'stop' | 'archive',
): Promise<void> {
  const formData = new URLSearchParams();
  formData.append('status', status);

  await this.request<void>('PUT', `/v2/processes/${processId}/status`, undefined, formData);
};

OTCSClient.prototype.deleteWorkflow = async function (
  this: OTCSClient,
  processId: number,
): Promise<void> {
  await this.request<void>('DELETE', `/v2/processes/${processId}`);
};

OTCSClient.prototype.getWorkflowTaskForm = async function (
  this: OTCSClient,
  processId: number,
  subprocessId: number,
  taskId: number,
): Promise<WorkflowFormSchema> {
  const response = await this.request<any>(
    'GET',
    `/v1/forms/processes/tasks/update?process_id=${processId}&subprocess_id=${subprocessId}&task_id=${taskId}`,
  );

  const data = response.data || {};
  return {
    workflow_id: processId,
    subprocess_id: subprocessId,
    task_id: taskId,
    title: data.title,
    instructions: data.instructions,
    priority: data.priority,
    comments_enabled: data.comments_on,
    attachments_enabled: data.attachments_on,
    actions: data.actions || [],
    custom_actions: data.custom_actions || [],
    data_packages: data.data_packages || [],
  };
};

OTCSClient.prototype.getWorkflowTaskFormFull = async function (
  this: OTCSClient,
  processId: number,
  subprocessId: number,
  taskId: number,
): Promise<WorkflowPropertiesFormInfo> {
  const response = await this.request<any>(
    'GET',
    `/v1/forms/processes/tasks/update?process_id=${processId}&subprocess_id=${subprocessId}&task_id=${taskId}`,
  );

  return {
    data: {
      title: response.data?.title,
      instructions: response.data?.instructions,
      priority: response.data?.priority,
      comments_on: response.data?.comments_on,
      attachments_on: response.data?.attachments_on,
      data_packages: response.data?.data_packages || [],
      actions: response.data?.actions || [],
      custom_actions: response.data?.custom_actions || [],
      message: response.data?.message,
      member_accept: response.data?.member_accept,
      reply_performer_id: response.data?.reply_performer_id,
      task: response.data?.task,
      authentication: response.data?.authentication,
    },
    forms: response.forms || [],
  };
};

OTCSClient.prototype.getDraftWorkflowForm = async function (
  this: OTCSClient,
  draftprocessId: number,
): Promise<WorkflowPropertiesFormInfo> {
  const response = await this.request<any>(
    'GET',
    `/v1/forms/draftprocesses?draftprocess_id=${draftprocessId}`,
  );

  return {
    data: {
      title: response.data?.title,
      instructions: response.data?.instructions,
      priority: response.data?.priority,
      comments_on: response.data?.comments_on,
      attachments_on: response.data?.attachments_on,
      data_packages: response.data?.data_packages || [],
      actions: response.data?.actions || [],
      custom_actions: response.data?.custom_actions || [],
      message: response.data?.message,
      member_accept: response.data?.member_accept,
      reply_performer_id: response.data?.reply_performer_id,
      task: response.data?.task,
      authentication: response.data?.authentication,
    },
    forms: response.forms || [],
  };
};

OTCSClient.prototype.updateDraftWorkflowForm = async function (
  this: OTCSClient,
  params: UpdateDraftFormParams,
): Promise<void> {
  const formData = new URLSearchParams();
  formData.append('action', params.action);

  if (params.comment) {
    formData.append('comment', params.comment);
  }

  if (params.values && params.action === 'formUpdate') {
    formData.append('values', JSON.stringify(params.values));
  }

  await this.request<void>(
    'PUT',
    `/v2/draftprocesses/${params.draftprocess_id}`,
    undefined,
    formData,
  );
};

OTCSClient.prototype.getWorkflowInfoFull = async function (
  this: OTCSClient,
  workId: number,
): Promise<WorkflowInfo> {
  const response = await this.request<any>('GET', `/v2/workflows/status/info?workid=${workId}`);

  const results = response.results || {};
  const generalInfo = Array.isArray(results.generalInfo)
    ? results.generalInfo[0]
    : results.generalInfo || {};
  const managers = Array.isArray(results.ManagerList) ? results.ManagerList : [];
  const stepList = Array.isArray(results.stepList) ? results.stepList : [];
  const comments = Array.isArray(results.Comments) ? results.Comments : [];
  const auditInfo = Array.isArray(results.auditInfo) ? results.auditInfo : [];
  const attributes = Array.isArray(results.Attributes) ? results.Attributes : [];

  // Extract attribute values into a flat object
  const attributeValues: Record<string, unknown> = {};
  for (const attr of attributes) {
    const children = Array.isArray(attr?.Content?.Rootset?.Children)
      ? attr.Content.Rootset.Children
      : [];
    for (const child of children) {
      if (child.Name && child.Value !== undefined) {
        attributeValues[child.Name] = child.Value;
      }
    }
  }

  return {
    work_id: workId,
    title: generalInfo.title || generalInfo.wf_name || '',
    status: generalInfo.status || '',
    date_initiated: generalInfo.date_initiated,
    date_due: generalInfo.date_due,
    initiator: generalInfo.initiator_id
      ? {
          id: generalInfo.initiator_id,
          name: generalInfo.initiator_name || '',
        }
      : undefined,
    managers: managers.map((m: any) => ({
      id: m.id,
      name: m.name,
    })),
    steps: stepList.map((s: any) => ({
      step_name: s.TITLE || '',
      task_id: s.TASKID,
      type: s.TYPE,
      status: s.WORKINFO?.SubWorkTask_Status || '',
      performer_id: s.WORKINFO?.SubWorkTask_PerformerID,
      date_started: s.WORKINFO?.Work_DateInitiated,
      date_completed: s.WORKINFO?.SubWorkTask_DateDone,
    })),
    comments: comments.map((c: any) => ({
      comment: c.COMMENTS || '',
      date: c.DATESAVED || '',
      user_name: c.USERNAME || '',
      step_name: c.STEPNAME || '',
      task_id: c.TASKID,
    })),
    audit_info: auditInfo.map((a: any) => ({
      date: a.AUDIT_DATE || '',
      user_name: a.USER_NAME || '',
      user_id: a.USER_ID,
      message: a.AUDIT_MSG || '',
    })),
    attributes: attributeValues,
    attachment_count: results.Attachments,
  };
};

OTCSClient.prototype.getWorkflowInfo = async function (
  this: OTCSClient,
  workflowInstanceId: number,
): Promise<WorkflowStatus> {
  const params = new URLSearchParams();
  params.append('workid', workflowInstanceId.toString());

  const response = await this.request<any>('GET', `/v2/workflows/status/info?${params.toString()}`);

  const results = response.results || {};
  const generalInfo = results.generalInfo?.[0] || {};

  return {
    process_id: workflowInstanceId,
    workflow_name: generalInfo.wf_name || generalInfo.title || '',
    status_key: generalInfo.status || '',
    date_initiated: generalInfo.date_initiated,
    due_date: generalInfo.date_due,
  };
};

OTCSClient.prototype.acceptWorkflowTask = async function (
  this: OTCSClient,
  processId: number,
  subprocessId: number,
  taskId: number,
): Promise<AcceptTaskResponse> {
  const response = await this.request<any>(
    'POST',
    `/v2/mobilegroupassignment/accept/taskid/${taskId}/processid/${processId}/subprocessid/${subprocessId}`,
  );

  return {
    success: true,
    message: response.results?.data?.message || 'Task accepted successfully',
  };
};

OTCSClient.prototype.checkGroupAssignment = async function (
  this: OTCSClient,
  processId: number,
  subprocessId: number,
  taskId: number,
): Promise<boolean> {
  try {
    const response = await this.request<any>(
      'GET',
      `/v2/mobilegroupassignment/check/taskid/${taskId}/processid/${processId}/subprocessid/${subprocessId}`,
    );
    return response.results?.data?.isGroupAssignment === true;
  } catch {
    return false;
  }
};

OTCSClient.prototype.transformWorkflowStatus = function (
  this: OTCSClient,
  wfstatus: any,
  permissions?: any,
): WorkflowStatus {
  return {
    process_id: wfstatus.process_id,
    subprocess_id: wfstatus.subprocess_id,
    task_id: wfstatus.task_id,
    workflow_name: wfstatus.wf_name,
    status_key: wfstatus.status_key,
    step_name: wfstatus.step_name,
    assignees: wfstatus.assignee,
    assignee_count: wfstatus.assignee_count,
    date_initiated: wfstatus.date_initiated,
    due_date: wfstatus.due_date,
    steps_count: wfstatus.steps_count,
    comments_on: wfstatus.comments_on,
    current_tasks: wfstatus.parallel_steps,
    permissions: permissions
      ? {
          can_archive: permissions.Archive,
          can_change_attributes: permissions.ChangeAttr,
          can_delete: permissions.Delete,
          can_modify_route: permissions.ChangeRoute,
          can_manage_permissions: permissions.ManagerPerms,
          can_see_details: permissions.SeeDetail,
          can_stop: permissions.Stop,
          can_suspend: permissions.Suspend,
        }
      : undefined,
  };
};

OTCSClient.prototype.transformActiveWorkflow = function (
  this: OTCSClient,
  item: any,
): WorkflowStatus {
  const statusMap: Record<number, string> = {
    [-1]: 'active',
    0: 'active',
    1: 'stopped',
    2: 'completed',
    3: 'archived',
  };
  return {
    process_id: item.Work_WorkID,
    subprocess_id: item.SubWork_SubWorkID,
    workflow_name: item.SubWork_Title,
    status_key: statusMap[item.Work_Status] ?? String(item.Work_Status),
    date_initiated: item.SubWork_DateInitiated,
    due_date: item.Work_DateDue_Max || item.SubWork_DateDue_Max,
    comments_on: item.comments_on === 1,
  };
};
