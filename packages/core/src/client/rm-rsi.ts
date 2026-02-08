import type {
  RMRSI,
  RMRSISchedule,
  RMRSIListResponse,
  RMRSIItemsResponse,
  RMNodeRSIsResponse,
  RMRSICreateParams,
  RMRSIUpdateParams,
  RMRSIScheduleCreateParams,
  RMRSIAssignParams,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    getRMCodes(codeType: string): Promise<Array<{ code: string; description: string }>>;
    listRMRSIs(options?: { page?: number; limit?: number }): Promise<RMRSIListResponse>;
    getRMRSI(rsiId: number): Promise<RMRSI>;
    createRMRSI(params: RMRSICreateParams): Promise<RMRSI>;
    updateRMRSI(rsiId: number, params: RMRSIUpdateParams): Promise<RMRSI>;
    deleteRMRSI(rsiId: number): Promise<{ success: boolean }>;
    getNodeRMRSIs(nodeId: number): Promise<RMNodeRSIsResponse>;
    assignRMRSI(params: RMRSIAssignParams): Promise<{ success: boolean }>;
    removeRMRSI(nodeId: number, classId: number): Promise<{ success: boolean }>;
    getRMRSIItems(
      rsiId: number,
      options?: { page?: number; limit?: number; sort?: string },
    ): Promise<RMRSIItemsResponse>;
    createRMRSISchedule(params: RMRSIScheduleCreateParams): Promise<RMRSISchedule>;
    getRMRSISchedules(rsiId: number): Promise<RMRSISchedule[]>;
    approveRMRSISchedule(
      rsiId: number,
      stageId: number,
      comment?: string,
    ): Promise<{ success: boolean }>;
    getRMRSIApprovalHistory(
      rsiId: number,
    ): Promise<
      Array<{ stage_id: number; approved_by: number; approved_date: string; comment?: string }>
    >;
    /** @internal */ parseRMRSI(data: any): RMRSI;
    /** @internal */ parseRMRSISchedule(data: any, rsiId?: number): RMRSISchedule;
  }
}

OTCSClient.prototype.getRMCodes = async function (
  this: OTCSClient,
  codeType: string,
): Promise<Array<{ code: string; description: string }>> {
  const response = await this.request<any>('GET', `/v2/recordsmanagement/rmcodes`);
  const data = response.results || response.data || response;

  const codes: Array<{ code: string; description: string }> = [];
  const codesData = data[codeType] || data.codes?.[codeType] || [];

  if (Array.isArray(codesData)) {
    for (const item of codesData) {
      codes.push({
        code: item.code || item.Code || item,
        description: item.desc || item.description || item.Description || '',
      });
    }
  }

  return codes;
};

OTCSClient.prototype.listRMRSIs = async function (
  this: OTCSClient,
  options?: { page?: number; limit?: number },
): Promise<RMRSIListResponse> {
  let path = '/v2/rsis';
  const params: string[] = [];
  if (options?.page) params.push(`page=${options.page}`);
  if (options?.limit) params.push(`limit=${options.limit}`);
  if (params.length > 0) path += '?' + params.join('&');

  const response = await this.request<any>('GET', path);
  const rsisArray = response.results?.data?.rsis || response.data?.rsis || response.rsis || [];

  const rsis: RMRSI[] = [];
  for (const item of rsisArray) {
    rsis.push(this.parseRMRSI(item));
  }

  return {
    rsis,
    total_count: response.collection?.paging?.total_count || rsis.length,
    page: options?.page || 1,
    limit: options?.limit,
  };
};

OTCSClient.prototype.getRMRSI = async function (this: OTCSClient, rsiId: number): Promise<RMRSI> {
  const response = await this.request<any>('GET', `/v2/rsis/${rsiId}`);
  const rsiArray = response.results?.data?.rsi || response.data?.rsi || [];
  if (rsiArray.length > 0) {
    return this.parseRMRSI(rsiArray[0]);
  }
  const data = response.results?.data || response.data || response;
  return this.parseRMRSI(data);
};

OTCSClient.prototype.createRMRSI = async function (
  this: OTCSClient,
  params: RMRSICreateParams,
): Promise<RMRSI> {
  const formData = new URLSearchParams();
  formData.append('name', params.name);
  formData.append('status', params.status);
  if (params.status_date) formData.append('statusDate', params.status_date);
  if (params.description) formData.append('description', params.description);
  if (params.subject) formData.append('subject', params.subject);
  if (params.title) formData.append('title', params.title);
  if (params.disp_control !== undefined)
    formData.append('dispcontrol', params.disp_control.toString());
  if (params.source_app) formData.append('sourceApp', params.source_app);
  if (params.editing_app) formData.append('editingApp', params.editing_app);

  const response = await this.request<any>('POST', '/v2/rsischedules', undefined, formData);
  const rsiId = response.id || response.rsi_id || response.results?.id;
  if (rsiId) {
    return this.getRMRSI(rsiId);
  }
  return this.parseRMRSI(response.results || response.data || response);
};

OTCSClient.prototype.updateRMRSI = async function (
  this: OTCSClient,
  rsiId: number,
  params: RMRSIUpdateParams,
): Promise<RMRSI> {
  const formData = new URLSearchParams();
  if (params.new_name) formData.append('newName', params.new_name);
  if (params.status) formData.append('status', params.status);
  if (params.status_date) formData.append('statusDate', params.status_date);
  if (params.description) formData.append('description', params.description);
  if (params.subject) formData.append('subject', params.subject);
  if (params.title) formData.append('title', params.title);
  if (params.discontinue !== undefined)
    formData.append('discontinue', params.discontinue.toString());
  if (params.discontinue_date) formData.append('discontinueDate', params.discontinue_date);
  if (params.discontinue_comment) formData.append('discontinueComment', params.discontinue_comment);
  if (params.disp_control !== undefined)
    formData.append('dispcontrol', params.disp_control.toString());
  if (params.editing_app) formData.append('editingApp', params.editing_app);

  await this.request<any>('PUT', `/v2/rsischedules/${rsiId}`, undefined, formData);
  return this.getRMRSI(rsiId);
};

OTCSClient.prototype.deleteRMRSI = async function (
  this: OTCSClient,
  rsiId: number,
): Promise<{ success: boolean }> {
  await this.request<any>('DELETE', `/v2/rsischedules/${rsiId}`);
  return { success: true };
};

OTCSClient.prototype.getNodeRMRSIs = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<RMNodeRSIsResponse> {
  const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/rsis`);
  const data = response.data || response.results || response;

  const rsis: Array<{ rsi_id: number; rsi_name: string; class_id?: number; class_name?: string }> =
    [];
  const rsisArray = Array.isArray(data) ? data : data.rsis || [];

  for (const item of rsisArray) {
    rsis.push({
      rsi_id: item.rsi_id || item.RSID || item.id,
      rsi_name: item.rsi_name || item.RSIName || item.name,
      class_id: item.class_id || item.ClassID,
      class_name: item.class_name || item.ClassName,
    });
  }

  return {
    node_id: nodeId,
    rsis,
  };
};

OTCSClient.prototype.assignRMRSI = async function (
  this: OTCSClient,
  params: RMRSIAssignParams,
): Promise<{ success: boolean }> {
  const formData = new URLSearchParams();
  formData.append('rsi', params.rsi_id.toString());
  if (params.status_date) formData.append('status_date', params.status_date);

  await this.request<any>(
    'POST',
    `/v1/nodes/${params.node_id}/rmclassifications/${params.class_id}/rsis`,
    undefined,
    formData,
  );
  return { success: true };
};

OTCSClient.prototype.removeRMRSI = async function (
  this: OTCSClient,
  nodeId: number,
  classId: number,
): Promise<{ success: boolean }> {
  await this.request<any>('DELETE', `/v1/nodes/${nodeId}/rmclassifications/${classId}/rsis`);
  return { success: true };
};

OTCSClient.prototype.getRMRSIItems = async function (
  this: OTCSClient,
  rsiId: number,
  options?: { page?: number; limit?: number; sort?: string },
): Promise<RMRSIItemsResponse> {
  let path = `/v2/rsiitems/${rsiId}`;
  const params: string[] = [];
  if (options?.limit) params.push(`limit=${options.limit}`);
  if (options?.sort) params.push(`sort=${options.sort}`);
  if (params.length > 0) path += '?' + params.join('&');

  if (options?.page && options.page > 1) {
    path = `/v2/rsiitems/${rsiId}/page?page=${options.page}`;
    if (options.limit) path += `&limit=${options.limit}`;
    if (options.sort) path += `&sort=${options.sort}`;
  }

  const response = await this.request<any>('GET', path);
  const data = response.data || response.results || response;

  const items: Array<{ id: number; name: string; type: number; type_name: string }> = [];
  const itemsArray = Array.isArray(data) ? data : data.items || [];

  for (const item of itemsArray) {
    items.push({
      id: item.id,
      name: item.name,
      type: item.type,
      type_name: item.type_name,
    });
  }

  return {
    rsi_id: rsiId,
    items,
    total_count: response.collection?.paging?.total_count || items.length,
    page: options?.page || 1,
    limit: options?.limit,
  };
};

OTCSClient.prototype.createRMRSISchedule = async function (
  this: OTCSClient,
  params: RMRSIScheduleCreateParams,
): Promise<RMRSISchedule> {
  const formData = new URLSearchParams();
  formData.append('stage', params.stage);
  formData.append('objectType', params.object_type);
  formData.append('eventType', params.event_type.toString());

  if (params.date_to_use !== undefined) formData.append('dateToUse', params.date_to_use.toString());
  if (params.retention_years !== undefined)
    formData.append('retentionYears', params.retention_years.toString());
  if (params.retention_months !== undefined)
    formData.append('retentionMonths', params.retention_months.toString());
  if (params.retention_days !== undefined)
    formData.append('retentionDays', params.retention_days.toString());
  if (params.action_code !== undefined)
    formData.append('actionCode', params.action_code.toString());
  if (params.disposition) formData.append('disposition', params.disposition);
  if (params.description) formData.append('description', params.description);
  if (params.new_status) formData.append('newStatus', params.new_status);
  if (params.rule_code) formData.append('ruleCode', params.rule_code);
  if (params.rule_comment) formData.append('ruleComment', params.rule_comment);
  if (params.fixed_date) formData.append('fixedDate', params.fixed_date);
  if (params.event_condition) formData.append('eventCondition', params.event_condition);
  if (params.year_end_month !== undefined)
    formData.append('yearEndMonth', params.year_end_month.toString());
  if (params.year_end_day !== undefined)
    formData.append('yearEndDay', params.year_end_day.toString());
  if (params.category_id !== undefined)
    formData.append('categoryId', params.category_id.toString());
  if (params.category_attribute_id !== undefined)
    formData.append('categoryAttributeId', params.category_attribute_id.toString());
  if (params.fixed_retention !== undefined)
    formData.append('fixedRetention', params.fixed_retention.toString());
  if (params.maximum_retention !== undefined)
    formData.append('maximumRetention', params.maximum_retention.toString());
  if (params.retention_intervals !== undefined)
    formData.append('retentionIntervals', params.retention_intervals.toString());
  if (params.min_num_versions_to_keep !== undefined)
    formData.append('minNumVersionsToKeep', params.min_num_versions_to_keep.toString());
  if (params.purge_superseded !== undefined)
    formData.append('purgeSuperseded', params.purge_superseded.toString());
  if (params.purge_majors !== undefined)
    formData.append('purgeMajors', params.purge_majors.toString());
  if (params.mark_official_rendition !== undefined)
    formData.append('markOfficialRendition', params.mark_official_rendition.toString());

  const response = await this.request<any>(
    'POST',
    `/v2/rsischedules/${params.rsi_id}/stages`,
    undefined,
    formData,
  );
  return this.parseRMRSISchedule(response.results || response.data || response);
};

OTCSClient.prototype.getRMRSISchedules = async function (
  this: OTCSClient,
  rsiId: number,
): Promise<RMRSISchedule[]> {
  const response = await this.request<any>('GET', `/v2/rsischedule/${rsiId}`);
  const data = response.results?.data || response.data || [];

  const schedules: RMRSISchedule[] = [];
  const schedulesArray = Array.isArray(data) ? data : [];

  for (const item of schedulesArray) {
    const props = item.data?.properties || item.properties || item;
    schedules.push({
      id: props.id,
      rsi_id: rsiId,
      stage: props.name || props.stage,
      object_type: props.object_type === 'Classified Objects' ? 'LIV' : 'LRM',
      event_type: props.rule_type || props.event_type,
      date_to_use: props.date_to_use,
      retention_years: props.retyears,
      retention_months: props.retmonths,
      retention_days: props.retdays,
      action_code: props.action_code ? parseInt(props.action_code) : undefined,
      disposition: props.disposition,
      description: props.actiondesc_e,
      rule_code: props.rsirulecode,
      event_condition: props.eventrule,
      year_end_month: props.yearendmonth,
      year_end_day: props.yearendday,
      approved: props.approval_flag === true || props.approval_flag === 1,
    });
  }

  return schedules;
};

OTCSClient.prototype.approveRMRSISchedule = async function (
  this: OTCSClient,
  rsiId: number,
  stageId: number,
  comment?: string,
): Promise<{ success: boolean }> {
  const formData = new URLSearchParams();
  if (comment) formData.append('comment', comment);

  await this.request<any>(
    'PUT',
    `/v2/rsischedules/${rsiId}/approve/${stageId}`,
    undefined,
    formData,
  );
  return { success: true };
};

OTCSClient.prototype.getRMRSIApprovalHistory = async function (
  this: OTCSClient,
  rsiId: number,
): Promise<
  Array<{ stage_id: number; approved_by: number; approved_date: string; comment?: string }>
> {
  const response = await this.request<any>('GET', `/v2/rsischedules/${rsiId}/approvalhistory`);
  const data = response.results || response.data || response;

  const history: Array<{
    stage_id: number;
    approved_by: number;
    approved_date: string;
    comment?: string;
  }> = [];
  const historyArray = Array.isArray(data) ? data : data.history || [];

  for (const item of historyArray) {
    history.push({
      stage_id: item.stage_id || item.StageID,
      approved_by: item.approved_by || item.ApprovedBy,
      approved_date: item.approved_date || item.ApprovedDate,
      comment: item.comment || item.Comment,
    });
  }

  return history;
};

OTCSClient.prototype.parseRMRSI = function (this: OTCSClient, data: any): RMRSI {
  const rsi: RMRSI = {
    id: data.id || data.RSIID || data.rsi_id,
    name: data.name || data.RSI || data.Name || data.RSIName,
    status: data.status || data.RSIStatus || data.rsistatus || data.Status,
    status_date: data.status_date || data.StatusDate || data.statusDate || data.statusdate,
    description: data.description || data.Description,
    subject: data.subject || data.Subject,
    title: data.title || data.Title,
    disp_control: data.disp_control ?? data.DispControl ?? data.dispcontrol ?? data.disp_control,
    discontinued: data.discontinued ?? data.DiscontFlag ?? data.discont_flag,
    discontinue_date:
      data.discontinue_date || data.DiscontDate || data.DiscontinueDate || data.discontinueDate,
    discontinue_comment:
      data.discontinue_comment ||
      data.DiscontComment ||
      data.DiscontinueComment ||
      data.discontinueComment,
    source_app: data.source_app || data.sourceApp || data.SourceApp,
    editing_app: data.editing_app || data.editingApp || data.EditingApp,
  };

  if (data.RSIScheduleID || data.RetStage) {
    rsi.schedules = [
      {
        id: data.RSIScheduleID,
        rsi_id: rsi.id,
        stage: data.RetStage,
        object_type: data.ObjectType === 1 ? 'LIV' : 'LRM',
        event_type: data.EventType,
        date_to_use: data.DateToUse,
        retention_years: data.RetYears,
        retention_months: data.RetMonths,
        retention_days: data.RetDays,
        action_code: data.ActionCode,
        disposition: data.Disposition,
        description: data.ActionDescription,
        rule_code: data.RSIRuleCode,
        event_condition: data.EventRule,
        year_end_month: data.YearEndMonth,
        year_end_day: data.YearEndDay,
        approved: data.ApprovalFlag === 1,
      },
    ];
  } else if (data.schedules || data.Schedules) {
    const schedulesArray = data.schedules || data.Schedules;
    rsi.schedules = [];
    if (Array.isArray(schedulesArray)) {
      for (const sched of schedulesArray) {
        rsi.schedules.push(this.parseRMRSISchedule(sched, rsi.id));
      }
    }
  }

  return rsi;
};

OTCSClient.prototype.parseRMRSISchedule = function (
  this: OTCSClient,
  data: any,
  rsiId?: number,
): RMRSISchedule {
  return {
    id: data.id || data.ID || data.ScheduleID || data.stage_id,
    rsi_id: data.rsi_id || data.RSID || rsiId || 0,
    stage: data.stage || data.Stage,
    object_type: data.object_type || data.objectType || data.ObjectType,
    event_type: data.event_type ?? data.eventType ?? data.EventType,
    date_to_use: data.date_to_use ?? data.dateToUse ?? data.DateToUse,
    retention_years: data.retention_years ?? data.retentionYears ?? data.RetentionYears,
    retention_months: data.retention_months ?? data.retentionMonths ?? data.RetentionMonths,
    retention_days: data.retention_days ?? data.retentionDays ?? data.RetentionDays,
    action_code: data.action_code ?? data.actionCode ?? data.ActionCode,
    disposition: data.disposition || data.Disposition,
    description: data.description || data.Description,
    new_status: data.new_status || data.newStatus || data.NewStatus,
    rule_code: data.rule_code || data.ruleCode || data.RuleCode,
    rule_comment: data.rule_comment || data.ruleComment || data.RuleComment,
    fixed_date: data.fixed_date || data.fixedDate || data.FixedDate,
    event_condition: data.event_condition || data.eventCondition || data.EventCondition,
    year_end_month: data.year_end_month ?? data.yearEndMonth ?? data.YearEndMonth,
    year_end_day: data.year_end_day ?? data.yearEndDay ?? data.YearEndDay,
    approved: data.approved ?? data.Approved,
    approval_date: data.approval_date || data.approvalDate || data.ApprovalDate,
    approved_by: data.approved_by || data.approvedBy || data.ApprovedBy,
  };
};
