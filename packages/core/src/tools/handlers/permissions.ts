/**
 * Permission handlers — otcs_permissions
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const permissionHandlers: Record<string, HandlerFn> = {
  otcs_permissions: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, node_id, right_id, member_id, permissions, apply_to } = args as {
      action: string;
      node_id: number;
      right_id?: number;
      member_id?: number;
      permissions?: string[];
      apply_to?: number;
    };
    const targetId = right_id || member_id;

    switch (action) {
      case 'get': {
        const perms = await client.getNodePermissions(node_id);
        return {
          ...perms,
          summary: {
            has_owner: !!perms.owner,
            has_group: !!perms.group,
            has_public_access: !!perms.public_access,
            custom_permissions_count: perms.custom_permissions.length,
          },
        };
      }
      case 'add': {
        if (!targetId || !permissions) throw new Error('right_id and permissions required');
        const addResult = await client.addCustomPermission(node_id, targetId, permissions as any, {
          apply_to: apply_to as any,
        });
        return {
          ...addResult,
          message: `Permissions added for member ${targetId}`,
          permissions_granted: permissions,
        };
      }
      case 'update': {
        if (!targetId || !permissions) throw new Error('right_id and permissions required');
        const updateResult = await client.updateCustomPermission(
          node_id,
          targetId,
          permissions as any,
          { apply_to: apply_to as any },
        );
        return {
          ...updateResult,
          message: `Permissions updated for member ${targetId}`,
          new_permissions: permissions,
        };
      }
      case 'remove': {
        if (!targetId) throw new Error('right_id required');
        const removeResult = await client.removeCustomPermission(node_id, targetId, {
          apply_to: apply_to as any,
        });
        return {
          ...removeResult,
          message: `Permissions removed for member ${targetId}`,
        };
      }
      case 'effective': {
        if (!targetId) throw new Error('right_id or member_id required');
        const effective = await client.getEffectivePermissions(node_id, targetId);
        return {
          ...effective,
          permission_count: effective.permissions.length,
          has_see: effective.permissions.includes('see'),
          has_modify: effective.permissions.includes('modify'),
          has_delete: effective.permissions.includes('delete'),
          has_edit_permissions: effective.permissions.includes('edit_permissions'),
        };
      }
      case 'set_owner': {
        if (!permissions) throw new Error('permissions required');
        const ownerResult = await client.updateOwnerPermissions(node_id, permissions as any, {
          right_id: targetId,
          apply_to: apply_to as any,
        });
        return {
          ...ownerResult,
          message: targetId ? `Ownership transferred to ${targetId}` : 'Owner permissions updated',
          owner_permissions: permissions,
        };
      }
      case 'set_public': {
        if (!permissions)
          throw new Error('permissions required (use empty array to remove public access)');
        const publicResult = await client.updatePublicPermissions(node_id, permissions as any, {
          apply_to: apply_to as any,
        });
        return {
          ...publicResult,
          message: permissions.length > 0 ? 'Public access updated' : 'Public access removed',
          public_permissions: permissions,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};
