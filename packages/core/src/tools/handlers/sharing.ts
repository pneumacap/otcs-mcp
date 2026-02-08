/**
 * Sharing handlers — otcs_share
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const sharingHandlers: Record<string, HandlerFn> = {
  otcs_share: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      node_ids,
      node_id,
      invitees,
      expire_date,
      share_initiator_role,
      sharing_message,
      coordinators,
    } = args as {
      action: string;
      node_ids?: number[];
      node_id?: number;
      invitees?: Array<{
        business_email: string;
        perm: number;
        name?: string;
      }>;
      expire_date?: string;
      share_initiator_role?: number;
      sharing_message?: string;
      coordinators?: number[];
    };

    switch (action) {
      case 'list': {
        const listResult = await client.listShares();
        return {
          shares: listResult.shares,
          total_count: listResult.total_count,
          message:
            listResult.total_count === 0
              ? 'No active shares found'
              : `Found ${listResult.total_count} active share(s)`,
        };
      }
      case 'create': {
        if (!node_ids || node_ids.length === 0) throw new Error('node_ids required');
        const shareResult = await client.createShare({
          node_ids,
          invitees: invitees as any,
          expire_date,
          share_initiator_role: share_initiator_role as any,
          sharing_message,
          coordinators,
        });
        return {
          success: shareResult.success,
          node_ids: shareResult.node_ids,
          partial: shareResult.partial,
          message: shareResult.message || `Shared ${node_ids.length} item(s)`,
        };
      }
      case 'stop': {
        if (!node_id) throw new Error('node_id required');
        const stopResult = await client.stopShare(node_id);
        return {
          success: stopResult.success,
          node_id,
          message: stopResult.message,
        };
      }
      case 'stop_batch': {
        if (!node_ids || node_ids.length === 0) throw new Error('node_ids required');
        const batchResult = await client.stopShareBatch(node_ids);
        return {
          success: batchResult.success,
          count: batchResult.count,
          failed: batchResult.failed,
          message:
            batchResult.failed.length === 0
              ? `Stopped sharing ${batchResult.count} item(s)`
              : `Stopped sharing ${batchResult.count} item(s), ${batchResult.failed.length} failed`,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};
