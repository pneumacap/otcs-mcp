/**
 * Node operation handlers — otcs_node_action, otcs_delete_nodes
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const nodeOpsHandlers: Record<string, HandlerFn> = {
  otcs_delete_nodes: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { node_ids } = args as { node_ids: number[] };
    const results = await client.deleteNodes(node_ids);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return {
      success: failed === 0,
      message: `Deleted ${succeeded}/${results.length} nodes${failed > 0 ? ` (${failed} failed)` : ''}`,
      results,
    };
  },

  otcs_node_action: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, node_id, destination_id, new_name, description } = args as {
      action: string;
      node_id: number;
      destination_id?: number;
      new_name?: string;
      description?: string;
    };
    switch (action) {
      case 'copy': {
        if (!destination_id) throw new Error('destination_id required for copy');
        const copied = await client.copyNode(node_id, destination_id, new_name);
        return {
          success: true,
          new_node: copied,
          message: `Node copied. New ID: ${copied.id}`,
        };
      }
      case 'move': {
        if (!destination_id) throw new Error('destination_id required for move');
        const moved = await client.moveNode(node_id, destination_id);
        return {
          success: true,
          node: moved,
          message: `Node ${node_id} moved to ${destination_id}`,
        };
      }
      case 'rename': {
        if (!new_name) throw new Error('new_name required for rename');
        const renamed = await client.renameNode(node_id, new_name);
        return {
          success: true,
          node: renamed,
          message: `Node renamed to "${new_name}"`,
        };
      }
      case 'delete':
        await client.deleteNode(node_id);
        return { success: true, message: `Node ${node_id} deleted` };
      case 'update_description': {
        if (description === undefined)
          throw new Error('description required for update_description');
        const updated = await client.updateNodeDescription(node_id, description);
        return {
          success: true,
          node: updated,
          message: `Description updated for node ${node_id}`,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};
