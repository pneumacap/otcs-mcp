import type {
  PermissionString,
  PermissionEntry,
  NodePermissions,
  PermissionOperationResponse,
  EffectivePermissions,
  ApplyToScopeValue,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    getNodePermissions(nodeId: number): Promise<NodePermissions>;
    getOwnerPermissions(nodeId: number): Promise<PermissionEntry | null>;
    updateOwnerPermissions(
      nodeId: number,
      permissions: PermissionString[],
      options?: { right_id?: number; apply_to?: ApplyToScopeValue; include_sub_types?: number[] },
    ): Promise<PermissionOperationResponse>;
    getGroupPermissions(nodeId: number): Promise<PermissionEntry | null>;
    updateGroupPermissions(
      nodeId: number,
      permissions: PermissionString[],
      options?: { right_id?: number; apply_to?: ApplyToScopeValue; include_sub_types?: number[] },
    ): Promise<PermissionOperationResponse>;
    getPublicPermissions(nodeId: number): Promise<PermissionEntry | null>;
    updatePublicPermissions(
      nodeId: number,
      permissions: PermissionString[],
      options?: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] },
    ): Promise<PermissionOperationResponse>;
    addCustomPermission(
      nodeId: number,
      rightId: number,
      permissions: PermissionString[],
      options?: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] },
    ): Promise<PermissionOperationResponse>;
    getCustomPermission(nodeId: number, rightId: number): Promise<PermissionEntry | null>;
    updateCustomPermission(
      nodeId: number,
      rightId: number,
      permissions: PermissionString[],
      options?: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] },
    ): Promise<PermissionOperationResponse>;
    removeCustomPermission(
      nodeId: number,
      rightId: number,
      options?: { apply_to?: ApplyToScopeValue },
    ): Promise<PermissionOperationResponse>;
    getEffectivePermissions(nodeId: number, memberId: number): Promise<EffectivePermissions>;
    /** @internal */ transformPermissionEntry(
      data: any,
      type: 'owner' | 'group' | 'public' | 'custom',
    ): PermissionEntry;
    /** @internal */ extractPermissionStrings(data: any): PermissionString[];
  }
}

OTCSClient.prototype.getNodePermissions = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<NodePermissions> {
  const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/permissions?expand=member`);

  const permissions: NodePermissions = {
    node_id: nodeId,
    custom_permissions: [],
  };

  const results = response.results;
  if (Array.isArray(results)) {
    for (const item of results) {
      const entry = item?.data?.permissions;
      if (!entry) continue;
      const type: string = entry.type;
      const permEntry = this.transformPermissionEntry(entry, type as any);
      switch (type) {
        case 'owner':
          permissions.owner = permEntry;
          break;
        case 'group':
          permissions.group = permEntry;
          break;
        case 'public':
          permissions.public_access = permEntry;
          break;
        case 'custom':
          permissions.custom_permissions.push(permEntry);
          break;
      }
    }
    return permissions;
  }

  // Fallback: object-based response structure
  const data = (results && results.data) || results || {};

  if (data.owner) {
    permissions.owner = this.transformPermissionEntry(data.owner, 'owner');
  }
  if (data.group) {
    permissions.group = this.transformPermissionEntry(data.group, 'group');
  }
  if (data.public_access) {
    permissions.public_access = this.transformPermissionEntry(data.public_access, 'public');
  }
  if (Array.isArray(data.custom_permissions)) {
    permissions.custom_permissions = data.custom_permissions.map((p: any) =>
      this.transformPermissionEntry(p, 'custom'),
    );
  } else if (data.permissions) {
    for (const [rightId, permData] of Object.entries(data.permissions as Record<string, any>)) {
      if (!['owner', 'group', 'public_access'].includes(rightId)) {
        const entry = this.transformPermissionEntry(permData, 'custom');
        entry.right_id = parseInt(rightId, 10);
        permissions.custom_permissions.push(entry);
      }
    }
  }

  return permissions;
};

OTCSClient.prototype.getOwnerPermissions = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<PermissionEntry | null> {
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}/permissions/owner?expand=member`,
  );

  const data = response.results?.data || response.results || response;
  if (!data) return null;

  return this.transformPermissionEntry(data, 'owner');
};

OTCSClient.prototype.updateOwnerPermissions = async function (
  this: OTCSClient,
  nodeId: number,
  permissions: PermissionString[],
  options: { right_id?: number; apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {},
): Promise<PermissionOperationResponse> {
  const bodyData: any = {
    permissions,
  };
  if (options.right_id) bodyData.right_id = options.right_id;
  if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
  if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

  const formData = new URLSearchParams();
  formData.append('body', JSON.stringify(bodyData));

  await this.request<void>('PUT', `/v2/nodes/${nodeId}/permissions/owner`, undefined, formData);

  return { success: true };
};

OTCSClient.prototype.getGroupPermissions = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<PermissionEntry | null> {
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}/permissions/group?expand=member`,
  );

  const data = response.results?.data || response.results || response;
  if (!data) return null;

  return this.transformPermissionEntry(data, 'group');
};

OTCSClient.prototype.updateGroupPermissions = async function (
  this: OTCSClient,
  nodeId: number,
  permissions: PermissionString[],
  options: { right_id?: number; apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {},
): Promise<PermissionOperationResponse> {
  const bodyData: any = {
    permissions,
  };
  if (options.right_id) bodyData.right_id = options.right_id;
  if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
  if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

  const formData = new URLSearchParams();
  formData.append('body', JSON.stringify(bodyData));

  await this.request<void>('PUT', `/v2/nodes/${nodeId}/permissions/group`, undefined, formData);

  return { success: true };
};

OTCSClient.prototype.getPublicPermissions = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<PermissionEntry | null> {
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}/permissions/public?expand=member`,
  );

  const data = response.results?.data || response.results || response;
  if (!data) return null;

  return this.transformPermissionEntry(data, 'public');
};

OTCSClient.prototype.updatePublicPermissions = async function (
  this: OTCSClient,
  nodeId: number,
  permissions: PermissionString[],
  options: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {},
): Promise<PermissionOperationResponse> {
  const bodyData: any = {
    permissions,
  };
  if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
  if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

  const formData = new URLSearchParams();
  formData.append('body', JSON.stringify(bodyData));

  await this.request<void>('PUT', `/v2/nodes/${nodeId}/permissions/public`, undefined, formData);

  return { success: true };
};

OTCSClient.prototype.addCustomPermission = async function (
  this: OTCSClient,
  nodeId: number,
  rightId: number,
  permissions: PermissionString[],
  options: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {},
): Promise<PermissionOperationResponse> {
  const bodyData: any = {
    permissions,
    right_id: rightId,
  };
  if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
  if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

  const formData = new URLSearchParams();
  formData.append('body', JSON.stringify(bodyData));

  await this.request<void>('POST', `/v2/nodes/${nodeId}/permissions/custom`, undefined, formData);

  return { success: true };
};

OTCSClient.prototype.getCustomPermission = async function (
  this: OTCSClient,
  nodeId: number,
  rightId: number,
): Promise<PermissionEntry | null> {
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}/permissions/custom/${rightId}?expand=member`,
  );

  const data = response.results?.data || response.results || response;
  if (!data) return null;

  return this.transformPermissionEntry(data, 'custom');
};

OTCSClient.prototype.updateCustomPermission = async function (
  this: OTCSClient,
  nodeId: number,
  rightId: number,
  permissions: PermissionString[],
  options: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {},
): Promise<PermissionOperationResponse> {
  const bodyData: any = {
    permissions,
  };
  if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
  if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

  const formData = new URLSearchParams();
  formData.append('body', JSON.stringify(bodyData));

  await this.request<void>(
    'PUT',
    `/v2/nodes/${nodeId}/permissions/custom/${rightId}`,
    undefined,
    formData,
  );

  return { success: true };
};

OTCSClient.prototype.removeCustomPermission = async function (
  this: OTCSClient,
  nodeId: number,
  rightId: number,
  options: { apply_to?: ApplyToScopeValue } = {},
): Promise<PermissionOperationResponse> {
  const params = new URLSearchParams();
  if (options.apply_to !== undefined) {
    params.append('apply_to', options.apply_to.toString());
  }

  const queryString = params.toString();
  const path = `/v2/nodes/${nodeId}/permissions/custom/${rightId}${queryString ? '?' + queryString : ''}`;

  await this.request<void>('DELETE', path);

  return { success: true };
};

OTCSClient.prototype.getEffectivePermissions = async function (
  this: OTCSClient,
  nodeId: number,
  memberId: number,
): Promise<EffectivePermissions> {
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}/permissions/effective/${memberId}`,
  );

  const data = response.results?.data || response.results || response;
  const permissions = this.extractPermissionStrings(data.permissions || data);

  return {
    node_id: nodeId,
    member_id: memberId,
    permissions,
  };
};

OTCSClient.prototype.transformPermissionEntry = function (
  this: OTCSClient,
  data: any,
  type: 'owner' | 'group' | 'public' | 'custom',
): PermissionEntry {
  return {
    right_id: data.right_id || data.id,
    right_name: data.right_name || data.name,
    right_type: data.right_type || data.type,
    right_type_name: data.right_type_name || data.type_name,
    permissions: this.extractPermissionStrings(data.permissions || data),
    permission_type: type,
  };
};

OTCSClient.prototype.extractPermissionStrings = function (
  this: OTCSClient,
  data: any,
): PermissionString[] {
  if (Array.isArray(data)) {
    return data.filter((p) => typeof p === 'string') as PermissionString[];
  }

  const permissions: PermissionString[] = [];
  const permissionMap: Record<string, PermissionString> = {
    see: 'see',
    see_contents: 'see_contents',
    modify: 'modify',
    edit_attributes: 'edit_attributes',
    add_items: 'add_items',
    reserve: 'reserve',
    add_major_version: 'add_major_version',
    delete_versions: 'delete_versions',
    delete: 'delete',
    edit_permissions: 'edit_permissions',
  };

  for (const [key, permString] of Object.entries(permissionMap)) {
    if (data[key] === true) {
      permissions.push(permString);
    }
  }

  return permissions;
};
