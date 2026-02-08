import type {
  RMHold,
  RMHoldsResponse,
  RMNodeHoldsResponse,
  RMHoldItemsResponse,
  RMHoldUsersResponse,
  RMHoldParams,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    listRMHolds(): Promise<RMHoldsResponse>;
    getRMHold(holdId: number): Promise<RMHold>;
    createRMHold(params: RMHoldParams): Promise<RMHold>;
    updateRMHold(holdId: number, params: Partial<RMHoldParams>): Promise<RMHold>;
    deleteRMHold(holdId: number): Promise<{ success: boolean }>;
    getNodeRMHolds(nodeId: number): Promise<RMNodeHoldsResponse>;
    applyRMHold(nodeId: number, holdId: number): Promise<{ success: boolean }>;
    removeRMHold(nodeId: number, holdId: number): Promise<{ success: boolean }>;
    applyRMHoldBatch(
      nodeIds: number[],
      holdId: number,
    ): Promise<{
      success: boolean;
      count: number;
      failed: Array<{ node_id: number; error: string }>;
    }>;
    removeRMHoldBatch(
      nodeIds: number[],
      holdId: number,
    ): Promise<{
      success: boolean;
      count: number;
      failed: Array<{ node_id: number; error: string }>;
    }>;
    getRMHoldItems(
      holdId: number,
      options?: { page?: number; limit?: number },
    ): Promise<RMHoldItemsResponse>;
    getRMHoldUsers(holdId: number): Promise<RMHoldUsersResponse>;
    addRMHoldUsers(holdId: number, userIds: number[]): Promise<{ success: boolean }>;
    removeRMHoldUsers(holdId: number, userIds: number[]): Promise<{ success: boolean }>;
    /** @internal */ parseRMHold(data: any): RMHold;
  }
}

OTCSClient.prototype.listRMHolds = async function (this: OTCSClient): Promise<RMHoldsResponse> {
  const response = await this.request<any>('GET', `/v1/holds`);

  const holds: RMHold[] = [];
  const data = response.data || response.results || response;

  if (Array.isArray(data)) {
    for (const item of data) {
      holds.push(this.parseRMHold(item));
    }
  } else if (data && data.holds) {
    for (const item of data.holds) {
      holds.push(this.parseRMHold(item));
    }
  }

  return {
    holds,
    total_count: holds.length,
  };
};

OTCSClient.prototype.getRMHold = async function (
  this: OTCSClient,
  holdId: number,
): Promise<RMHold> {
  const response = await this.request<any>('GET', `/v2/hold?id=${holdId}`);
  const data = response.results?.data?.hold || response.data?.hold || response.data || response;
  return this.parseRMHold(data);
};

OTCSClient.prototype.createRMHold = async function (
  this: OTCSClient,
  params: RMHoldParams,
): Promise<RMHold> {
  const formData = new URLSearchParams();
  formData.append('name', params.name);
  formData.append('type', (params.type || 'LEGAL').toUpperCase());
  formData.append('date_applied', params.date_applied || new Date().toISOString().split('T')[0]);
  if (params.comment) formData.append('comment', params.comment);
  if (params.parent_id) formData.append('parent_id', params.parent_id.toString());
  if (params.alternate_hold_id) formData.append('alternate_id', params.alternate_hold_id);

  const response = await this.request<any>('POST', `/v1/holds`, undefined, formData);
  const holdId = response.holdID || response.hold_id || response.id;
  return this.getRMHold(holdId);
};

OTCSClient.prototype.updateRMHold = async function (
  this: OTCSClient,
  holdId: number,
  params: Partial<RMHoldParams>,
): Promise<RMHold> {
  const formData = new URLSearchParams();
  formData.append('id', holdId.toString());
  if (params.name) formData.append('name', params.name);
  if (params.type) formData.append('type', params.type.toUpperCase());
  if (params.comment) formData.append('comment', params.comment);
  if (params.alternate_hold_id) formData.append('alternate_id', params.alternate_hold_id);

  const response = await this.request<any>('PUT', `/v1/holds`, undefined, formData);
  return this.getRMHold(holdId);
};

OTCSClient.prototype.deleteRMHold = async function (
  this: OTCSClient,
  holdId: number,
): Promise<{ success: boolean }> {
  await this.request<any>('DELETE', `/v2/hold?id=${holdId}`);
  return { success: true };
};

OTCSClient.prototype.getNodeRMHolds = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<RMNodeHoldsResponse> {
  const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/holds`);

  const holds: RMHold[] = [];
  const data = response.data || response.results || response;

  if (Array.isArray(data)) {
    for (const item of data) {
      holds.push(this.parseRMHold(item));
    }
  } else if (data && data.holds) {
    for (const item of data.holds) {
      holds.push(this.parseRMHold(item));
    }
  }

  return {
    node_id: nodeId,
    holds,
  };
};

OTCSClient.prototype.applyRMHold = async function (
  this: OTCSClient,
  nodeId: number,
  holdId: number,
): Promise<{ success: boolean }> {
  const formData = new URLSearchParams();
  formData.append('hold_id', holdId.toString());

  await this.request<any>('POST', `/v1/nodes/${nodeId}/holds`, undefined, formData);
  return { success: true };
};

OTCSClient.prototype.removeRMHold = async function (
  this: OTCSClient,
  nodeId: number,
  holdId: number,
): Promise<{ success: boolean }> {
  await this.request<any>('DELETE', `/v1/nodes/${nodeId}/holds/${holdId}`);
  return { success: true };
};

OTCSClient.prototype.applyRMHoldBatch = async function (
  this: OTCSClient,
  nodeIds: number[],
  holdId: number,
): Promise<{ success: boolean; count: number; failed: Array<{ node_id: number; error: string }> }> {
  const failed: Array<{ node_id: number; error: string }> = [];
  let successCount = 0;

  const maxConcurrency = 5;
  for (let i = 0; i < nodeIds.length; i += maxConcurrency) {
    const batch = nodeIds.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(async (nodeId) => {
        try {
          await this.applyRMHold(nodeId, holdId);
          return { success: true, nodeId };
        } catch (error: any) {
          failed.push({ node_id: nodeId, error: error?.message || String(error) });
          return { success: false, nodeId };
        }
      }),
    );
    successCount += batchResults.filter((r) => r.success).length;
  }

  return {
    success: failed.length === 0,
    count: successCount,
    failed,
  };
};

OTCSClient.prototype.removeRMHoldBatch = async function (
  this: OTCSClient,
  nodeIds: number[],
  holdId: number,
): Promise<{ success: boolean; count: number; failed: Array<{ node_id: number; error: string }> }> {
  const failed: Array<{ node_id: number; error: string }> = [];
  let successCount = 0;

  const maxConcurrency = 5;
  for (let i = 0; i < nodeIds.length; i += maxConcurrency) {
    const batch = nodeIds.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(async (nodeId) => {
        try {
          await this.removeRMHold(nodeId, holdId);
          return { success: true, nodeId };
        } catch (error: any) {
          failed.push({ node_id: nodeId, error: error?.message || String(error) });
          return { success: false, nodeId };
        }
      }),
    );
    successCount += batchResults.filter((r) => r.success).length;
  }

  return {
    success: failed.length === 0,
    count: successCount,
    failed,
  };
};

OTCSClient.prototype.getRMHoldItems = async function (
  this: OTCSClient,
  holdId: number,
  options?: { page?: number; limit?: number },
): Promise<RMHoldItemsResponse> {
  let path = `/v2/holditems/${holdId}`;
  if (options?.page && options.page > 1) {
    path = `/v2/holditems/${holdId}/page?page=${options.page}`;
    if (options.limit) path += `&limit=${options.limit}`;
  } else if (options?.limit) {
    path += `?limit=${options.limit}`;
  }

  const response = await this.request<any>('GET', path);

  const items: Array<{ id: number; name: string; type: number; type_name: string }> = [];

  let itemsArray: any[] = [];
  if (response.results?.contents && Array.isArray(response.results.contents)) {
    itemsArray = response.results.contents;
  } else if (Array.isArray(response.results)) {
    itemsArray = response.results;
  }

  for (const item of itemsArray) {
    const props = item?.data?.properties || item;
    if (props && props.id) {
      items.push({
        id: props.id,
        name: props.name || '',
        type: props.type || 0,
        type_name: props.type_name || '',
      });
    }
  }

  return {
    hold_id: holdId,
    items,
    total_count: response.collection?.paging?.total_count || items.length,
    page: options?.page || 1,
    limit: options?.limit,
  };
};

OTCSClient.prototype.getRMHoldUsers = async function (
  this: OTCSClient,
  holdId: number,
): Promise<RMHoldUsersResponse> {
  const response = await this.request<any>('GET', `/v2/userholds/getusers/${holdId}`);
  const data = response.data || response.results || response;

  const users: Array<{ id: number; name: string; display_name?: string }> = [];
  const usersArray = Array.isArray(data) ? data : data.users || [];

  for (const user of usersArray) {
    users.push({
      id: user.id,
      name: user.name,
      display_name: user.display_name,
    });
  }

  return {
    hold_id: holdId,
    users,
  };
};

OTCSClient.prototype.addRMHoldUsers = async function (
  this: OTCSClient,
  holdId: number,
  userIds: number[],
): Promise<{ success: boolean }> {
  const body = {
    hold_id: holdId,
    user_ids: userIds,
  };

  await this.request<any>('POST', `/v2/userholds/addusers`, body);
  return { success: true };
};

OTCSClient.prototype.removeRMHoldUsers = async function (
  this: OTCSClient,
  holdId: number,
  userIds: number[],
): Promise<{ success: boolean }> {
  const body = {
    hold_id: holdId,
    user_ids: userIds,
  };

  await this.request<any>('POST', `/v2/userholds/removeusers`, body);
  return { success: true };
};

OTCSClient.prototype.parseRMHold = function (this: OTCSClient, data: any): RMHold {
  return {
    id: data.HoldID || data.hold_id || data.id || 0,
    name: data.HoldName || data.hold_name || data.name || '',
    comment: data.HoldComment || data.hold_comment || data.comment,
    type: data.HoldType || data.hold_type || data.type,
    type_name: data.HoldType || data.hold_type || data.type_name,
    parent_id: data.ParentID || data.parent_id,
    create_date: data.DateApplied || data.date_applied || data.create_date,
    modify_date: data.EditDate || data.modify_date,
    create_user_id: data.ApplyPatron || data.applied_by || data.create_user_id,
    items_count: data.items_count,
    alternate_hold_id: data.AlternateHoldID || data.alternate_hold_id,
  };
};
