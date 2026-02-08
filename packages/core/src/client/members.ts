import type {
  MemberInfo,
  MemberSearchResult,
  MemberSearchOptions,
  GroupMembershipInfo,
  GroupMembersResponse,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    searchMembers(options?: MemberSearchOptions): Promise<MemberSearchResult>;
    getMember(memberId: number): Promise<MemberInfo>;
    getUserGroups(
      userId: number,
      options?: { limit?: number; page?: number },
    ): Promise<GroupMembershipInfo>;
    getGroupMembers(
      groupId: number,
      options?: { limit?: number; page?: number; sort?: string },
    ): Promise<GroupMembersResponse>;
    addMemberToGroup(groupId: number, memberId: number): Promise<{ success: boolean }>;
    removeMemberFromGroup(groupId: number, memberId: number): Promise<{ success: boolean }>;
    /** @internal */ transformMember(data: any): MemberInfo;
  }
}

OTCSClient.prototype.searchMembers = async function (
  this: OTCSClient,
  options: MemberSearchOptions = {},
): Promise<MemberSearchResult> {
  const params = new URLSearchParams();

  if (options.type !== undefined) {
    params.append('where_type', options.type.toString());
  }
  if (options.query) {
    params.append('query', options.query);
  }
  if (options.where_name) {
    params.append('where_name', options.where_name);
  }
  if (options.where_first_name) {
    params.append('where_first_name', options.where_first_name);
  }
  if (options.where_last_name) {
    params.append('where_last_name', options.where_last_name);
  }
  if (options.where_business_email) {
    params.append('where_business_email', options.where_business_email);
  }
  if (options.sort) {
    params.append('sort', options.sort);
  }
  if (options.page) {
    params.append('page', options.page.toString());
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }

  const queryString = params.toString();
  const path = `/v2/members${queryString ? '?' + queryString : ''}`;
  const response = await this.request<any>('GET', path);

  const results: MemberInfo[] = (response.results || []).map((item: any) => {
    const data = item.data?.properties || item.data || item;
    return this.transformMember(data);
  });

  const paging = response.collection?.paging || {
    page: 1,
    limit: 100,
    total_count: results.length,
  };

  return {
    results,
    total_count: paging.total_count,
    page: paging.page,
    page_size: paging.limit,
  };
};

OTCSClient.prototype.getMember = async function (
  this: OTCSClient,
  memberId: number,
): Promise<MemberInfo> {
  const response = await this.request<any>('GET', `/v2/members/${memberId}`);

  const data =
    response.results?.data?.properties || response.results?.data || response.results || response;
  return this.transformMember(data);
};

OTCSClient.prototype.getUserGroups = async function (
  this: OTCSClient,
  userId: number,
  options: { limit?: number; page?: number } = {},
): Promise<GroupMembershipInfo> {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.page) params.append('page', options.page.toString());

  const queryString = params.toString();
  const path = `/v2/members/${userId}/memberof${queryString ? '?' + queryString : ''}`;
  const response = await this.request<any>('GET', path);

  const groups: MemberInfo[] = (response.results || []).map((item: any) => {
    const data = item.data?.properties || item.data || item;
    return this.transformMember(data);
  });

  const paging = response.collection?.paging || {
    total_count: groups.length,
  };

  return {
    user_id: userId,
    groups,
    total_count: paging.total_count,
  };
};

OTCSClient.prototype.getGroupMembers = async function (
  this: OTCSClient,
  groupId: number,
  options: { limit?: number; page?: number; sort?: string } = {},
): Promise<GroupMembersResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.page) params.append('page', options.page.toString());
  if (options.sort) params.append('sort', options.sort);

  const queryString = params.toString();
  const path = `/v2/members/${groupId}/members${queryString ? '?' + queryString : ''}`;
  const response = await this.request<any>('GET', path);

  const members: MemberInfo[] = (response.results || []).map((item: any) => {
    const data = item.data?.properties || item.data || item;
    return this.transformMember(data);
  });

  const paging = response.collection?.paging || {
    total_count: members.length,
  };

  return {
    group_id: groupId,
    members,
    total_count: paging.total_count,
  };
};

OTCSClient.prototype.addMemberToGroup = async function (
  this: OTCSClient,
  groupId: number,
  memberId: number,
): Promise<{ success: boolean }> {
  const formData = new URLSearchParams();
  formData.append('member_id', memberId.toString());

  await this.request<void>('POST', `/v2/members/${groupId}/members`, undefined, formData);

  return { success: true };
};

OTCSClient.prototype.removeMemberFromGroup = async function (
  this: OTCSClient,
  groupId: number,
  memberId: number,
): Promise<{ success: boolean }> {
  await this.request<void>('DELETE', `/v2/members/${groupId}/members/${memberId}`);

  return { success: true };
};

OTCSClient.prototype.transformMember = function (this: OTCSClient, data: any): MemberInfo {
  const hasPrivileges =
    data.privilege_login !== undefined ||
    data.privilege_modify_users !== undefined ||
    data.privilege_modify_groups !== undefined ||
    data.privilege_system_admin_rights !== undefined;

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    type_name: data.type_name || (data.type === 0 ? 'User' : 'Group'),
    display_name: data.name_formatted || data.display_name || data.name,
    first_name: data.first_name,
    last_name: data.last_name,
    middle_name: data.middle_name,
    title: data.title,
    business_email: data.business_email,
    business_phone: data.business_phone,
    business_fax: data.business_fax,
    office_location: data.office_location,
    time_zone: data.time_zone,
    birth_date: data.birth_date,
    cell_phone: data.cell_phone,
    personal_email: data.personal_email,
    group_id: data.group_id,
    leader_id: data.leader_id,
    photo_url: data.photo_url,
    deleted: data.deleted,
    privileges: hasPrivileges
      ? {
          create_users: data.privilege_modify_users,
          create_groups: data.privilege_modify_groups,
          login_enabled: data.privilege_login,
          admin: data.privilege_user_admin_rights,
          system_admin: data.privilege_system_admin_rights,
        }
      : undefined,
  };
};
