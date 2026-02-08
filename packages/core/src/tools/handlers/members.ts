/**
 * Member handlers — otcs_members, otcs_group_membership
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const memberHandlers: Record<string, HandlerFn> = {
  otcs_members: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      member_id,
      user_id,
      group_id,
      type,
      query,
      where_name,
      where_first_name,
      where_last_name,
      where_business_email,
      sort,
      limit,
      page,
    } = args as any;

    switch (action) {
      case 'search': {
        const searchResult = await client.searchMembers({
          type,
          query,
          where_name,
          where_first_name,
          where_last_name,
          where_business_email,
          sort,
          limit: limit || 100,
          page: page || 1,
        });
        return {
          ...searchResult,
          message: `Found ${searchResult.total_count} member(s)`,
          type_searched: type === 0 ? 'users' : type === 1 ? 'groups' : 'all',
        };
      }
      case 'get': {
        if (!member_id) throw new Error('member_id required');
        const member = await client.getMember(member_id);
        return {
          ...member,
          member_type: member.type === 0 ? 'user' : 'group',
        };
      }
      case 'get_user_groups': {
        if (!user_id) throw new Error('user_id required');
        const groupsResult = await client.getUserGroups(user_id, {
          limit: limit || 100,
          page: page || 1,
        });
        return {
          ...groupsResult,
          message: `User ${user_id} belongs to ${groupsResult.total_count} group(s)`,
        };
      }
      case 'get_group_members': {
        if (!group_id) throw new Error('group_id required');
        const membersResult = await client.getGroupMembers(group_id, {
          limit: limit || 100,
          page: page || 1,
          sort,
        });
        return {
          ...membersResult,
          message: `Group ${group_id} has ${membersResult.total_count} member(s)`,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  otcs_group_membership: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, group_id, member_id } = args as {
      action: string;
      group_id: number;
      member_id: number;
    };
    if (action === 'add') {
      const result = await client.addMemberToGroup(group_id, member_id);
      return {
        ...result,
        message: `Member ${member_id} added to group ${group_id}`,
      };
    } else if (action === 'remove') {
      const result = await client.removeMemberFromGroup(group_id, member_id);
      return {
        ...result,
        message: `Member ${member_id} removed from group ${group_id}`,
      };
    }
    throw new Error(`Unknown action: ${action}`);
  },
};
