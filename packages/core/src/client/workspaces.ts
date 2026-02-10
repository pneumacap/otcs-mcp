import type {
  WorkspaceType,
  WorkspaceInfo,
  WorkspaceCreateParams,
  WorkspaceRole,
  WorkspaceMember,
  WorkspaceRelation,
  WorkspaceSearchOptions,
  WorkspaceSearchResult,
  WorkspaceFormSchema as WorkspaceFormSchemaType,
  FormField,
  CategoryValues,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    getWorkspaceTypes(): Promise<WorkspaceType[]>;
    resolveTemplateId(id: number): Promise<number>;
    getWorkspaceForm(templateId: number): Promise<WorkspaceFormSchemaType>;
    createWorkspace(params: WorkspaceCreateParams): Promise<WorkspaceInfo>;
    createWorkspaces(
      workspaces: WorkspaceCreateParams[],
    ): Promise<
      Array<{ name: string; success: boolean; workspace?: WorkspaceInfo; error?: string }>
    >;
    /** @internal */ applyWorkspaceBusinessProperties(
      workspaceId: number,
      properties: Record<string, unknown>,
    ): Promise<{ updated: number[]; failed: number[] }>;
    /** @internal */ buildCategoryNameMap(
      workspaceId: number,
    ): Promise<Map<string, string>>;
    getWorkspace(workspaceId: number): Promise<WorkspaceInfo>;
    searchWorkspaces(options?: WorkspaceSearchOptions): Promise<WorkspaceSearchResult>;
    getWorkspaceRelations(workspaceId: number): Promise<WorkspaceRelation[]>;
    addWorkspaceRelation(
      workspaceId: number,
      relatedWorkspaceId: number,
      relationType?: string,
    ): Promise<WorkspaceRelation>;
    removeWorkspaceRelation(workspaceId: number, relationId: number): Promise<void>;
    getWorkspaceRoles(workspaceId: number): Promise<WorkspaceRole[]>;
    getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]>;
    getRoleMembers(workspaceId: number, roleId: number): Promise<WorkspaceMember[]>;
    addRoleMember(workspaceId: number, roleId: number, memberId: number): Promise<void>;
    removeRoleMember(workspaceId: number, roleId: number, memberId: number): Promise<void>;
    findWorkspaceRoot(nodeId: number): Promise<WorkspaceInfo | null>;
  }
}

OTCSClient.prototype.getWorkspaceTypes = async function (
  this: OTCSClient,
): Promise<WorkspaceType[]> {
  // Use expand_templates=true to get template IDs needed for workspace creation
  const response = await this.request<any>(
    'GET',
    '/v2/businessworkspacetypes?expand_templates=true',
  );

  // Response structure: results[].data.properties contains workspace type + templates array
  const results = response.results || [];
  return results.map((item: any) => {
    const props = item.data?.properties || {};
    const info = item.data?.wksp_info || {};
    const templates = props.templates || [];
    // Get first template if available
    const firstTemplate = templates[0];

    return {
      wksp_type_id: props.wksp_type_id,
      wksp_type_name: props.wksp_type_name,
      wksp_type_icon: info.wksp_type_icon,
      rm_enabled: props.rm_enabled,
      // template_id comes from the templates array
      template_id: firstTemplate?.id,
      template_name: firstTemplate?.name,
      subtype: firstTemplate?.subtype,
    };
  });
};

OTCSClient.prototype.resolveTemplateId = async function (
  this: OTCSClient,
  id: number,
): Promise<number> {
  const types = await this.getWorkspaceTypes();
  const matchByType = types.find((t) => t.wksp_type_id === id);
  if (matchByType?.template_id) {
    return matchByType.template_id;
  }
  const matchByTemplate = types.find((t) => t.template_id === id);
  if (matchByTemplate) {
    return id;
  }
  return id;
};

OTCSClient.prototype.getWorkspaceForm = async function (
  this: OTCSClient,
  templateId: number,
): Promise<WorkspaceFormSchemaType> {
  // Resolve in case caller passed wksp_type_id instead of template node ID
  const resolvedId = await this.resolveTemplateId(templateId);

  const response = await this.request<any>(
    'GET',
    `/v2/forms/businessworkspaces/create?template_id=${resolvedId}`,
  );

  // Parse the form schema from the response
  const forms = response.forms || [];
  const fields: FormField[] = [];
  const categories: Array<{ id: number; name: string; fields: FormField[] }> = [];

  for (const form of forms) {
    if (form.data) {
      // Extract general fields
      if (form.schema?.properties) {
        for (const [key, schema] of Object.entries(form.schema.properties as Record<string, any>)) {
          const field: FormField = {
            id: key,
            name: schema.title || key,
            type: schema.type || 'string',
            required: form.schema.required?.includes(key) || false,
            description: schema.description,
          };
          if (schema.maxLength) field.max_length = schema.maxLength;
          if (schema.minimum) field.min_value = schema.minimum;
          if (schema.maximum) field.max_value = schema.maximum;
          if (schema.enum) {
            field.options = schema.enum.map((v: string, i: number) => ({
              key: v,
              value: schema.enumNames?.[i] || v,
            }));
          }
          fields.push(field);
        }
      }
    }
  }

  return { fields, categories };
};

OTCSClient.prototype.createWorkspace = async function (
  this: OTCSClient,
  params: WorkspaceCreateParams,
): Promise<WorkspaceInfo> {
  // Resolve in case caller passed wksp_type_id instead of template node ID
  const resolvedTemplateId = await this.resolveTemplateId(params.template_id);

  const formData = new URLSearchParams();
  formData.append('template_id', resolvedTemplateId.toString());
  formData.append('name', params.name);

  if (params.parent_id) {
    formData.append('parent_id', params.parent_id.toString());
  }
  if (params.description) {
    formData.append('description', params.description);
  }

  const response = await this.request<any>('POST', '/v2/businessworkspaces', undefined, formData);

  // Extract workspace from response - structure varies by API version
  let props = response?.results?.data?.properties;
  if (!props && response?.results) {
    props = response.results;
  }
  if (!props && response?.data?.properties) {
    props = response.data.properties;
  }

  // If we still don't have props, get the workspace by ID from the response
  const workspaceId = props?.id || response?.results?.id || response?.id;
  if (!workspaceId) {
    throw new Error('Failed to create workspace: No ID in response');
  }

  // If business_properties were provided, update the workspace categories
  let propertyResults: { updated: number[]; failed: number[] } | undefined;
  if (params.business_properties && Object.keys(params.business_properties).length > 0) {
    propertyResults = await this.applyWorkspaceBusinessProperties(
      workspaceId,
      params.business_properties,
    );
  }

  // Fetch the full workspace details
  const workspace = await this.getWorkspace(workspaceId);

  // Attach property update results so the caller can see what happened
  if (propertyResults) {
    (workspace as any)._propertyResults = propertyResults;
  }

  return workspace;
};

OTCSClient.prototype.createWorkspaces = async function (
  this: OTCSClient,
  workspaces: WorkspaceCreateParams[],
): Promise<Array<{ name: string; success: boolean; workspace?: WorkspaceInfo; error?: string }>> {
  const results: Array<{
    name: string;
    success: boolean;
    workspace?: WorkspaceInfo;
    error?: string;
  }> = [];
  for (const params of workspaces) {
    try {
      const workspace = await this.createWorkspace(params);
      results.push({ name: params.name, success: true, workspace });
    } catch (error: any) {
      results.push({ name: params.name, success: false, error: error.message });
    }
  }
  return results;
};

OTCSClient.prototype.applyWorkspaceBusinessProperties = async function (
  this: OTCSClient,
  workspaceId: number,
  properties: Record<string, unknown>,
): Promise<{ updated: number[]; failed: number[] }> {
  // Group properties by category ID
  const categorizedValues: Record<number, CategoryValues> = {};
  const unresolvedEntries: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(properties)) {
    // Format 1: flat key like "11150_28"
    const flatMatch = key.match(/^(\d+)_(\d+)/);
    if (flatMatch) {
      const categoryId = parseInt(flatMatch[1], 10);
      if (!categorizedValues[categoryId]) {
        categorizedValues[categoryId] = {};
      }
      categorizedValues[categoryId][key] = value;
      continue;
    }

    // Format 2/3: key is a plain category ID and value is an object of attributes
    const plainId = key.match(/^(\d+)$/);
    if (plainId && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const categoryId = parseInt(plainId[1], 10);
      if (!categorizedValues[categoryId]) {
        categorizedValues[categoryId] = {};
      }
      // Flatten the nested object into {category_id}_{attribute_id} keys
      for (const [attrKey, attrVal] of Object.entries(value as Record<string, unknown>)) {
        // If attrKey already has the category prefix, use as-is
        if (attrKey.startsWith(`${categoryId}_`)) {
          categorizedValues[categoryId][attrKey] = attrVal;
        } else {
          categorizedValues[categoryId][`${categoryId}_${attrKey}`] = attrVal;
        }
      }
      continue;
    }

    // Collect unrecognised keys for name-based resolution
    unresolvedEntries.push([key, value]);
  }

  // Attempt to resolve friendly-name keys (e.g. "Equipment_Number" → "10596_2_1_6")
  if (unresolvedEntries.length > 0) {
    const nameMap = await this.buildCategoryNameMap(workspaceId);

    for (const [key, value] of unresolvedEntries) {
      const normalized = key.replace(/[_\s\-\/().]/g, '').toLowerCase();
      const resolvedKey = nameMap.get(normalized);

      if (resolvedKey) {
        const catMatch = resolvedKey.match(/^(\d+)_/);
        if (catMatch) {
          const categoryId = parseInt(catMatch[1], 10);
          if (!categorizedValues[categoryId]) {
            categorizedValues[categoryId] = {};
          }
          categorizedValues[categoryId][resolvedKey] = value;
        }
      } else {
        console.warn(`applyWorkspaceBusinessProperties: could not resolve key "${key}"`);
      }
    }
  }

  const updated: number[] = [];
  const failed: number[] = [];

  // Update each category with its values
  for (const [categoryIdStr, values] of Object.entries(categorizedValues)) {
    const categoryId = parseInt(categoryIdStr, 10);
    try {
      await this.updateCategory(workspaceId, categoryId, values);
      updated.push(categoryId);
    } catch (error) {
      console.warn(`Failed to update category ${categoryId} on workspace ${workspaceId}:`, error);
      failed.push(categoryId);
    }
  }

  // Verify: if we expected categories but none succeeded, throw so the caller knows
  if (updated.length === 0 && failed.length > 0) {
    throw new Error(
      `Failed to apply business properties: all ${failed.length} category update(s) failed (categories: ${failed.join(', ')})`,
    );
  }

  return { updated, failed };
};

/**
 * Build a map of normalised attribute names → category key IDs for a workspace.
 * Used to resolve friendly-name keys (e.g. "EquipmentNumber") to proper
 * category keys (e.g. "10596_2_1_6") when the LLM passes human-readable names.
 */
OTCSClient.prototype.buildCategoryNameMap = async function (
  this: OTCSClient,
  workspaceId: number,
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();

  const addAttrs = (attrs: Array<{ key: string; name?: string; children?: any[] }>) => {
    for (const attr of attrs) {
      if (attr.name) {
        const normalized = attr.name.replace(/[_\s\-\/().]/g, '').toLowerCase();
        nameMap.set(normalized, attr.key);
      }
      if (attr.children) {
        addAttrs(attr.children);
      }
    }
  };

  // Strategy 1: try workspace metadata form (returns all categories at once)
  try {
    const metadataForm = await this.getWorkspaceMetadataForm(workspaceId);
    for (const cat of metadataForm.categories) {
      addAttrs(cat.attributes);
    }
    if (nameMap.size > 0) return nameMap;
  } catch {
    // Fall through to strategy 2
  }

  // Strategy 2: enumerate categories and fetch each form individually
  try {
    const categoriesResponse = await this.getCategories(workspaceId);
    for (const cat of categoriesResponse.categories) {
      try {
        const form = await this.getCategoryCreateForm(workspaceId, cat.id);
        addAttrs(form.attributes);
      } catch {
        // Skip this category
      }
    }
  } catch {
    // No categories available
  }

  return nameMap;
};

OTCSClient.prototype.getWorkspace = async function (
  this: OTCSClient,
  workspaceId: number,
): Promise<WorkspaceInfo> {
  const response = await this.request<any>('GET', `/v2/businessworkspaces/${workspaceId}`);

  const props = response?.results?.data?.properties || response?.results;
  if (!props) {
    throw new Error('Workspace not found');
  }

  return this.transformWorkspace(props);
};

OTCSClient.prototype.searchWorkspaces = async function (
  this: OTCSClient,
  options: WorkspaceSearchOptions = {},
): Promise<WorkspaceSearchResult> {
  const params = new URLSearchParams();

  // Always include page and limit (API requires them)
  params.append('page', (options.page || 1).toString());
  params.append('limit', (options.limit || 100).toString());

  if (options.workspace_type_id) {
    params.append('where_workspace_type_id', options.workspace_type_id.toString());
  }
  if (options.workspace_type_name) {
    params.append('where_workspace_type_name', options.workspace_type_name);
  }
  if (options.where_name) {
    params.append('where_name', options.where_name);
  }
  if (options.where_column_query) {
    params.append('where_column_query', options.where_column_query);
  }
  if (options.sort) {
    params.append('sort', options.sort);
  }

  const path = `/v2/businessworkspaces?${params.toString()}`;
  const response = await this.request<any>('GET', path);

  const results: WorkspaceInfo[] = (response.results || []).map((item: any) => {
    const props = item.data?.properties || item;
    return this.transformWorkspace(props);
  });

  const paging = response.paging ||
    response.collection?.paging || {
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

OTCSClient.prototype.getWorkspaceRelations = async function (
  this: OTCSClient,
  workspaceId: number,
): Promise<WorkspaceRelation[]> {
  const response = await this.request<any>(
    'GET',
    `/v2/businessworkspaces/${workspaceId}/relateditems`,
  );

  const items = response.results || [];
  return items.map((item: any) => {
    const props = item.data?.properties || item;
    return {
      rel_id: props.rel_id || props.id,
      rel_type: props.rel_type || 'related',
      workspace_id: props.id,
      workspace_name: props.name,
      workspace_type_name: props.wksp_type_name || props.type_name,
    };
  });
};

OTCSClient.prototype.addWorkspaceRelation = async function (
  this: OTCSClient,
  workspaceId: number,
  relatedWorkspaceId: number,
  relationType?: string,
): Promise<WorkspaceRelation> {
  const effectiveRelType = relationType || 'child';
  const formData = new URLSearchParams();
  formData.append('rel_bw_id', relatedWorkspaceId.toString());
  formData.append('rel_type', effectiveRelType);

  const response = await this.request<any>(
    'POST',
    `/v2/businessworkspaces/${workspaceId}/relateditems`,
    undefined,
    formData,
  );

  const props = response?.results?.data?.properties || response?.results || response;
  return {
    rel_id: props.rel_id || props.id || relatedWorkspaceId,
    rel_type: effectiveRelType,
    workspace_id: relatedWorkspaceId,
    workspace_name: props.name || '',
    workspace_type_name: props.wksp_type_name,
  };
};

OTCSClient.prototype.removeWorkspaceRelation = async function (
  this: OTCSClient,
  workspaceId: number,
  relationId: number,
): Promise<void> {
  await this.request<void>(
    'DELETE',
    `/v2/businessworkspaces/${workspaceId}/relateditems/${relationId}`,
  );
};

OTCSClient.prototype.getWorkspaceRoles = async function (
  this: OTCSClient,
  workspaceId: number,
): Promise<WorkspaceRole[]> {
  const response = await this.request<any>('GET', `/v2/businessworkspaces/${workspaceId}/roles`);

  const roles = response.results || [];
  return roles.map((role: any) => {
    const props = role.data?.properties || role;
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      leader: props.leader || false,
      member_count: props.member_count || 0,
    };
  });
};

OTCSClient.prototype.getWorkspaceMembers = async function (
  this: OTCSClient,
  workspaceId: number,
): Promise<WorkspaceMember[]> {
  const response = await this.request<any>('GET', `/v2/businessworkspaces/${workspaceId}/members`);

  const members = response.results || [];
  return members.map((member: any) => {
    const props = member.data?.properties || member;
    return {
      id: props.id,
      name: props.name,
      type: props.type === 1 ? 'group' : 'user',
      display_name: props.display_name || props.name,
      first_name: props.first_name,
      last_name: props.last_name,
      email: props.email || props.business_email,
    };
  });
};

OTCSClient.prototype.getRoleMembers = async function (
  this: OTCSClient,
  workspaceId: number,
  roleId: number,
): Promise<WorkspaceMember[]> {
  const response = await this.request<any>(
    'GET',
    `/v2/businessworkspaces/${workspaceId}/roles/${roleId}/members`,
  );

  const members = response.results || [];
  return members.map((member: any) => {
    const props = member.data?.properties || member;
    return {
      id: props.id,
      name: props.name,
      type: props.type === 1 ? 'group' : 'user',
      display_name: props.display_name || props.name,
      first_name: props.first_name,
      last_name: props.last_name,
      email: props.email || props.business_email,
    };
  });
};

OTCSClient.prototype.addRoleMember = async function (
  this: OTCSClient,
  workspaceId: number,
  roleId: number,
  memberId: number,
): Promise<void> {
  const formData = new URLSearchParams();
  formData.append('member_id', memberId.toString());

  await this.request<void>(
    'POST',
    `/v2/businessworkspaces/${workspaceId}/roles/${roleId}/members`,
    undefined,
    formData,
  );
};

OTCSClient.prototype.removeRoleMember = async function (
  this: OTCSClient,
  workspaceId: number,
  roleId: number,
  memberId: number,
): Promise<void> {
  await this.request<void>(
    'DELETE',
    `/v2/businessworkspaces/${workspaceId}/roles/${roleId}/members/${memberId}`,
  );
};

OTCSClient.prototype.findWorkspaceRoot = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<WorkspaceInfo | null> {
  try {
    const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/businessworkspace`);

    const props = response?.results?.data?.properties || response?.data || response;
    if (props && props.id) {
      return this.transformWorkspace(props);
    }
    return null;
  } catch {
    return null;
  }
};
