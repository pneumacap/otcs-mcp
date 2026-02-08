/**
 * Workspace handlers — otcs_workspace_types, otcs_create_workspace,
 * otcs_create_workspaces, otcs_get_workspace, otcs_search_workspaces,
 * otcs_workspace_relations, otcs_workspace_roles
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const workspaceHandlers: Record<string, HandlerFn> = {
  otcs_workspace_types: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, template_id } = args as {
      action?: string;
      template_id?: number;
    };
    if (action === 'get_form') {
      if (!template_id) throw new Error('template_id required for get_form');
      const form = await client.getWorkspaceForm(template_id);
      return { template_id, schema: form };
    }
    const types = await client.getWorkspaceTypes();
    return { workspace_types: types, count: types.length };
  },

  otcs_create_workspace: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { template_id, name, parent_id, description, business_properties } = args as {
      template_id: number;
      name: string;
      parent_id?: number;
      description?: string;
      business_properties?: Record<string, unknown>;
    };
    const workspace = await client.createWorkspace({
      template_id,
      name,
      parent_id,
      description,
      business_properties,
    });
    return {
      success: true,
      workspace,
      message: `Workspace "${name}" created with ID ${workspace.id}`,
    };
  },

  otcs_create_workspaces: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { workspaces } = args as {
      workspaces: Array<{
        template_id: number;
        name: string;
        parent_id?: number;
        description?: string;
        business_properties?: Record<string, unknown>;
      }>;
    };
    const results = await client.createWorkspaces(workspaces);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return {
      success: failed === 0,
      message: `Created ${succeeded}/${results.length} workspaces${failed > 0 ? ` (${failed} failed)` : ''}`,
      results,
    };
  },

  otcs_get_workspace: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { workspace_id, find_for_node } = args as {
      workspace_id?: number;
      find_for_node?: number;
    };
    if (find_for_node) {
      const workspace = await client.findWorkspaceRoot(find_for_node);
      return workspace
        ? { found: true, workspace }
        : {
            found: false,
            message: `No workspace found for node ${find_for_node}`,
          };
    }
    if (!workspace_id) throw new Error('Either workspace_id or find_for_node required');
    return await client.getWorkspace(workspace_id);
  },

  otcs_search_workspaces: async (client: OTCSClient, args: Record<string, unknown>) => {
    const params = args as any;
    return await client.searchWorkspaces(params);
  },

  otcs_workspace_relations: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, workspace_id, related_workspace_id, relation_id, relation_type } = args as {
      action: string;
      workspace_id: number;
      related_workspace_id?: number;
      relation_id?: number;
      relation_type?: string;
    };
    switch (action) {
      case 'list': {
        const relations = await client.getWorkspaceRelations(workspace_id);
        return { workspace_id, relations, count: relations.length };
      }
      case 'add': {
        if (!related_workspace_id) throw new Error('related_workspace_id required for add');
        const newRelation = await client.addWorkspaceRelation(
          workspace_id,
          related_workspace_id,
          relation_type,
        );
        return {
          success: true,
          relation: newRelation,
          message: `Workspace ${related_workspace_id} linked to ${workspace_id}`,
        };
      }
      case 'remove':
        if (!relation_id) throw new Error('relation_id required for remove');
        await client.removeWorkspaceRelation(workspace_id, relation_id);
        return { success: true, message: `Relation ${relation_id} removed` };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  otcs_workspace_roles: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, workspace_id, role_id, member_id } = args as {
      action: string;
      workspace_id: number;
      role_id?: number;
      member_id?: number;
    };
    switch (action) {
      case 'get_roles': {
        const roles = await client.getWorkspaceRoles(workspace_id);
        return { workspace_id, roles, count: roles.length };
      }
      case 'get_members': {
        const members = await client.getWorkspaceMembers(workspace_id);
        return { workspace_id, members, count: members.length };
      }
      case 'get_role_members': {
        if (!role_id) throw new Error('role_id required');
        const roleMembers = await client.getRoleMembers(workspace_id, role_id);
        return {
          workspace_id,
          role_id,
          members: roleMembers,
          count: roleMembers.length,
        };
      }
      case 'add_member':
        if (!role_id || !member_id) throw new Error('role_id and member_id required');
        await client.addRoleMember(workspace_id, role_id, member_id);
        return {
          success: true,
          message: `Member ${member_id} added to role ${role_id}`,
        };
      case 'remove_member':
        if (!role_id || !member_id) throw new Error('role_id and member_id required');
        await client.removeRoleMember(workspace_id, role_id, member_id);
        return {
          success: true,
          message: `Member ${member_id} removed from role ${role_id}`,
        };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};
