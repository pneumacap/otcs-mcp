import type {
  ShareCreateParams,
  ShareInfo,
  ShareOperationResponse,
  SharedItem,
  ShareListResponse,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    createShare(params: ShareCreateParams): Promise<ShareInfo>;
    stopShare(nodeId: number): Promise<ShareOperationResponse>;
    stopShareBatch(
      nodeIds: number[],
    ): Promise<{ success: boolean; count: number; failed: number[] }>;
    listShares(): Promise<ShareListResponse>;
    /** @internal */ getPermissionName(perm: number | string): string;
  }
}

OTCSClient.prototype.createShare = async function (
  this: OTCSClient,
  params: ShareCreateParams,
): Promise<ShareInfo> {
  const formData = new FormData();

  formData.append('ids', JSON.stringify(params.node_ids));
  formData.append('shareProvider', params.share_provider || 'CORE');

  const shareOptions: Record<string, unknown> = {};
  if (params.expire_date) {
    shareOptions.expire_date = params.expire_date;
  }
  if (params.share_initiator_role) {
    shareOptions.shareInitiatorRole = params.share_initiator_role;
  }
  formData.append('shareOptions', JSON.stringify(shareOptions));

  const providerParams: Record<string, unknown> = {};
  if (params.invitees && params.invitees.length > 0) {
    providerParams.invitees = params.invitees.map((invitee) => ({
      id: invitee.id || invitee.business_email,
      business_email: invitee.business_email,
      name: invitee.name || invitee.business_email.split('@')[0],
      perm: String(invitee.perm),
      identityType: invitee.identityType || 1,
      providerId: invitee.providerId || '',
    }));
  }
  if (params.sharing_message) {
    providerParams.sharing_message = params.sharing_message;
  }
  formData.append('providerParams', JSON.stringify(providerParams));

  const coordinators =
    params.coordinators && params.coordinators.length > 0 ? params.coordinators : [];
  if (coordinators.length > 0) {
    formData.append('coordinators', JSON.stringify(coordinators));
  }

  const response = await this.request<any>('POST', '/v2/shares', undefined, formData);

  const result = response.results?.data || response.data || response;
  const isPartial = result.partial === true;
  const message =
    result.msg ||
    (isPartial ? 'Share operation completed with partial success' : 'Share created successfully');

  return {
    node_ids: params.node_ids,
    success: !isPartial,
    partial: isPartial,
    message: message,
  };
};

OTCSClient.prototype.stopShare = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<ShareOperationResponse> {
  await this.request<any>('DELETE', `/v2/shares/${nodeId}`);
  return {
    success: true,
    message: `Sharing stopped for node ${nodeId}`,
  };
};

OTCSClient.prototype.stopShareBatch = async function (
  this: OTCSClient,
  nodeIds: number[],
): Promise<{ success: boolean; count: number; failed: number[] }> {
  const failed: number[] = [];
  let successCount = 0;

  const maxConcurrency = 5;
  for (let i = 0; i < nodeIds.length; i += maxConcurrency) {
    const batch = nodeIds.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(async (nodeId) => {
        try {
          await this.stopShare(nodeId);
          return { success: true, nodeId };
        } catch {
          failed.push(nodeId);
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

OTCSClient.prototype.listShares = async function (this: OTCSClient): Promise<ShareListResponse> {
  const response = await this.request<any>('GET', '/v2/shares');

  const data = response.results?.data || response.data || response.results || response;
  const items = Array.isArray(data) ? data : data.shares || data.items || [];

  const shares: SharedItem[] = items.map((item: any) => {
    const nodeData = item.data?.properties || item.properties || item.node || item;

    return {
      node_id: nodeData.id || nodeData.node_id || item.id,
      name: nodeData.name || item.name || 'Unknown',
      type: nodeData.type || item.type || 0,
      type_name: nodeData.type_name || item.type_name || 'Unknown',
      share_id: item.share_id || item.shareId || item.id?.toString(),
      shared_date: item.shared_date || item.create_date || item.sharedDate,
      expire_date: item.expire_date || item.expireDate,
      share_provider: item.share_provider || item.provider || 'CORE',
      invitees: item.invitees?.map((inv: any) => ({
        email: inv.business_email || inv.email,
        name: inv.name || inv.display_name,
        permission: typeof inv.perm === 'string' ? parseInt(inv.perm) : inv.perm || inv.permission,
        permission_name:
          inv.perm_name ||
          inv.permission_name ||
          this.getPermissionName(inv.perm || inv.permission),
      })),
    };
  });

  return {
    shares,
    total_count: shares.length,
  };
};

OTCSClient.prototype.getPermissionName = function (
  this: OTCSClient,
  perm: number | string,
): string {
  const permNum = typeof perm === 'string' ? parseInt(perm) : perm;
  switch (permNum) {
    case 1:
      return 'Viewer';
    case 2:
      return 'Collaborator';
    case 3:
      return 'Manager';
    case 4:
      return 'Owner';
    default:
      return 'Unknown';
  }
};
