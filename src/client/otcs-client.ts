import {
  OTCSConfig,
  OTCSAuthResponse,
  OTCSNode,
  OTCSNodeResponse,
  OTCSNodesResponse,
  OTCSCreateNodeResponse,
  OTCSAncestor,
  OTCSVersion,
  NodeInfo,
  FolderContents,
  NodeTypes,
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
  // Workflow types
  WorkflowAssignment,
  WorkflowStatus,
  WorkflowDefinition,
  WorkflowTaskList,
  WorkflowActivity,
  WorkflowInitiateParams,
  WorkflowTaskActionParams,
  ActiveWorkflowsOptions,
  WorkflowFormSchema,
} from '../types.js';

export class OTCSClient {
  private baseUrl: string;
  private ticket: string | null = null;
  private config: OTCSConfig;

  constructor(config: OTCSConfig) {
    // Normalize base URL - remove trailing slash and ensure /api path
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    if (!this.baseUrl.includes('/api')) {
      this.baseUrl = this.baseUrl + '/api';
    }
    this.config = config;
  }

  // ============ Authentication ============

  async authenticate(username?: string, password?: string, domain?: string): Promise<string> {
    const user = username || this.config.username;
    const pass = password || this.config.password;
    const dom = domain || this.config.domain;

    if (!user || !pass) {
      throw new Error('Username and password are required for authentication');
    }

    const formData = new URLSearchParams();
    formData.append('username', user);
    formData.append('password', pass);
    if (dom) {
      formData.append('domain', dom);
    }

    const response = await fetch(`${this.baseUrl}/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as OTCSAuthResponse;
    this.ticket = data.ticket;
    return this.ticket;
  }

  async validateSession(): Promise<boolean> {
    if (!this.ticket) return false;

    try {
      const response = await fetch(`${this.baseUrl}/v2/auth`, {
        method: 'HEAD',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    if (!this.ticket) return;

    await fetch(`${this.baseUrl}/v2/auth`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    this.ticket = null;
  }

  isAuthenticated(): boolean {
    return this.ticket !== null;
  }

  getTicket(): string | null {
    return this.ticket;
  }

  setTicket(ticket: string): void {
    this.ticket = ticket;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.ticket) {
      headers['OTCSTicket'] = this.ticket;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    formData?: FormData | URLSearchParams
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {};
    if (this.ticket) {
      headers['OTCSTicket'] = this.ticket;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (formData) {
      if (formData instanceof URLSearchParams) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      options.body = formData;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    options.headers = headers;

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OTCS API Error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.errorDetail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  // ============ Node Operations ============

  async getNode(nodeId: number): Promise<NodeInfo> {
    const response = await this.request<OTCSNodeResponse>(
      'GET',
      `/v2/nodes/${nodeId}`
    );

    const props = this.extractNodeProperties(response);
    return this.transformNode(props);
  }

  async getNodeWithAncestors(nodeId: number): Promise<{ node: NodeInfo; ancestors: OTCSAncestor[] }> {
    const response = await this.request<any>(
      'GET',
      `/v2/nodes/${nodeId}?expand=properties{original_id}&actions=open&actions=download`
    );

    const props = this.extractNodeProperties(response);
    const ancestors: OTCSAncestor[] = response.results?.data?.properties?.ancestors || [];

    const node = this.transformNode(props);
    node.path = ancestors.map(a => a.name);

    return { node, ancestors };
  }

  async getSubnodes(
    nodeId: number,
    options: {
      page?: number;
      limit?: number;
      sort?: string;
      where_type?: number[];
    } = {}
  ): Promise<FolderContents> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.sort) params.append('sort', options.sort);
    if (options.where_type && options.where_type.length > 0) {
      options.where_type.forEach(t => params.append('where_type', t.toString()));
    }

    const queryString = params.toString();
    const path = `/v2/nodes/${nodeId}/nodes${queryString ? '?' + queryString : ''}`;

    const response = await this.request<OTCSNodesResponse>('GET', path);

    // Get folder info
    const folderInfo = await this.getNode(nodeId);

    // Transform items
    const items: NodeInfo[] = (response.results || []).map(item => {
      const props = item.data?.properties;
      if (!props) return null;
      return this.transformNode(props);
    }).filter((item): item is NodeInfo => item !== null);

    const paging = response.collection?.paging || {
      page: 1,
      limit: 100,
      total_count: items.length,
      page_total: 1,
      range_min: 1,
      range_max: items.length,
    };

    return {
      folder: folderInfo,
      items,
      paging: {
        page: paging.page,
        page_size: paging.limit,
        total_count: paging.total_count,
        page_total: paging.page_total,
      },
    };
  }

  async createFolder(
    parentId: number,
    name: string,
    description?: string
  ): Promise<OTCSCreateNodeResponse> {
    const formData = new URLSearchParams();
    formData.append('type', NodeTypes.FOLDER.toString());
    formData.append('parent_id', parentId.toString());
    formData.append('name', name);
    if (description) {
      formData.append('description', description);
    }

    const response = await this.request<any>('POST', '/v2/nodes', undefined, formData);

    // Extract from nested response structure
    const props = response?.results?.data?.properties;
    if (props) {
      return {
        id: props.id,
        name: props.name,
        type: props.type,
      };
    }

    // Fallback for direct response
    return response as OTCSCreateNodeResponse;
  }

  async createFolderPath(
    parentId: number,
    path: string
  ): Promise<{ folders: OTCSCreateNodeResponse[]; leafId: number }> {
    const parts = path.split('/').filter(p => p.trim());
    const folders: OTCSCreateNodeResponse[] = [];
    let currentParent = parentId;

    for (const folderName of parts) {
      // Check if folder already exists
      const existing = await this.findChildByName(currentParent, folderName);

      if (existing) {
        folders.push({ id: existing.id, name: existing.name, type: existing.type });
        currentParent = existing.id;
      } else {
        // Create new folder
        const created = await this.createFolder(currentParent, folderName);
        folders.push(created);
        currentParent = created.id;
      }
    }

    return { folders, leafId: currentParent };
  }

  async findChildByName(parentId: number, name: string): Promise<OTCSNode | null> {
    const params = new URLSearchParams();
    params.append('where_name', name);
    params.append('limit', '1');

    const response = await this.request<OTCSNodesResponse>(
      'GET',
      `/v2/nodes/${parentId}/nodes?${params.toString()}`
    );

    const items = response.results || [];
    if (items.length > 0 && items[0].data?.properties) {
      return items[0].data.properties;
    }
    return null;
  }

  async deleteNode(nodeId: number): Promise<void> {
    await this.request<void>('DELETE', `/v2/nodes/${nodeId}`);
  }

  async renameNode(nodeId: number, newName: string): Promise<NodeInfo> {
    const formData = new URLSearchParams();
    formData.append('name', newName);

    const response = await this.request<OTCSNodeResponse>(
      'PUT',
      `/v2/nodes/${nodeId}`,
      undefined,
      formData
    );

    const props = this.extractNodeProperties(response);
    return this.transformNode(props);
  }

  async moveNode(nodeId: number, newParentId: number): Promise<NodeInfo> {
    const formData = new URLSearchParams();
    formData.append('parent_id', newParentId.toString());

    const response = await this.request<OTCSNodeResponse>(
      'PUT',
      `/v2/nodes/${nodeId}`,
      undefined,
      formData
    );

    const props = this.extractNodeProperties(response);
    return this.transformNode(props);
  }

  async copyNode(nodeId: number, destinationId: number, newName?: string): Promise<OTCSCreateNodeResponse> {
    const formData = new URLSearchParams();
    formData.append('original_id', nodeId.toString());
    formData.append('parent_id', destinationId.toString());
    if (newName) {
      formData.append('name', newName);
    }

    const response = await this.request<any>('POST', '/v2/nodes', undefined, formData);

    // Extract from nested response structure
    const props = response?.results?.data?.properties;
    if (props) {
      return {
        id: props.id,
        name: props.name,
        type: props.type,
      };
    }

    return response as OTCSCreateNodeResponse;
  }

  // ============ Document Operations ============

  async uploadDocument(
    parentId: number,
    name: string,
    fileContent: Buffer | Blob,
    mimeType: string,
    description?: string
  ): Promise<OTCSCreateNodeResponse> {
    const formData = new FormData();
    formData.append('type', NodeTypes.DOCUMENT.toString());
    formData.append('parent_id', parentId.toString());
    formData.append('name', name);
    if (description) {
      formData.append('description', description);
    }

    // Create blob from buffer if needed
    let blob: Blob;
    if (fileContent instanceof Blob) {
      blob = fileContent;
    } else {
      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(fileContent);
      blob = new Blob([uint8Array], { type: mimeType });
    }

    formData.append('file', blob, name);

    const url = `${this.baseUrl}/v2/nodes`;
    const headers: Record<string, string> = {};
    if (this.ticket) {
      headers['OTCSTicket'] = this.ticket;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload document: ${error}`);
    }

    const data = await response.json() as any;

    // Extract from nested response structure
    const props = data?.results?.data?.properties;
    if (props) {
      return {
        id: props.id,
        name: props.name,
        type: props.type,
      };
    }

    return data as OTCSCreateNodeResponse;
  }

  async getContent(nodeId: number): Promise<{ content: ArrayBuffer; mimeType: string; fileName: string }> {
    const url = `${this.baseUrl}/v2/nodes/${nodeId}/content`;
    const headers: Record<string, string> = {};
    if (this.ticket) {
      headers['OTCSTicket'] = this.ticket;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get content: ${response.status}`);
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';

    // Extract filename from content-disposition header
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const fileName = filenameMatch ? filenameMatch[1].replace(/['"]/g, '') : 'download';

    const content = await response.arrayBuffer();
    return { content, mimeType, fileName };
  }

  // ============ Version Operations ============

  async getVersions(nodeId: number): Promise<OTCSVersion[]> {
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/versions`);
    return response.data || [];
  }

  async addVersion(
    nodeId: number,
    fileContent: Buffer | Blob,
    mimeType: string,
    fileName: string,
    description?: string
  ): Promise<OTCSVersion> {
    const formData = new FormData();
    if (description) {
      formData.append('description', description);
    }

    let blob: Blob;
    if (fileContent instanceof Blob) {
      blob = fileContent;
    } else {
      const uint8Array = new Uint8Array(fileContent);
      blob = new Blob([uint8Array], { type: mimeType });
    }

    formData.append('file', blob, fileName);

    const url = `${this.baseUrl}/v2/nodes/${nodeId}/versions`;
    const headers: Record<string, string> = {};
    if (this.ticket) {
      headers['OTCSTicket'] = this.ticket;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add version: ${error}`);
    }

    return response.json();
  }

  // ============ Search Operations ============

  async searchNodes(
    query: string,
    options: {
      where_type?: number[];
      location?: number;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<{ results: NodeInfo[]; total_count: number }> {
    // Use browse with filter - searches within a location
    // Default to Enterprise Workspace (2000) if no location specified
    const locationId = options.location || 2000;

    const params = new URLSearchParams();
    params.append('where_name', `contains_${query}`);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.page) params.append('page', options.page.toString());

    const response = await this.request<OTCSNodesResponse>(
      'GET',
      `/v2/nodes/${locationId}/nodes?${params.toString()}`
    );

    const items: NodeInfo[] = (response.results || []).map(item => {
      const props = item.data?.properties;
      if (!props) return null;
      return this.transformNode(props);
    }).filter((item): item is NodeInfo => item !== null);

    return {
      results: items,
      total_count: response.collection?.paging?.total_count || items.length,
    };
  }

  // Deep search using recursive browse (for searches across nested folders)
  async deepSearch(
    query: string,
    rootId: number = 2000,
    maxDepth: number = 3
  ): Promise<NodeInfo[]> {
    const results: NodeInfo[] = [];
    const visited = new Set<number>();

    const searchFolder = async (folderId: number, depth: number) => {
      if (depth > maxDepth || visited.has(folderId)) return;
      visited.add(folderId);

      try {
        const contents = await this.getSubnodes(folderId, { limit: 500 });

        for (const item of contents.items) {
          // Check if name matches query
          if (item.name.toLowerCase().includes(query.toLowerCase())) {
            results.push(item);
          }

          // Recurse into subfolders
          if (item.container && item.type === NodeTypes.FOLDER) {
            await searchFolder(item.id, depth + 1);
          }
        }
      } catch (error) {
        // Skip folders we can't access
      }
    };

    await searchFolder(rootId, 0);
    return results;
  }

  // ============ Business Workspace Operations ============

  async getWorkspaceTypes(): Promise<WorkspaceType[]> {
    // Use expand_templates=true to get template IDs needed for workspace creation
    const response = await this.request<any>('GET', '/v2/businessworkspacetypes?expand_templates=true');

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
  }

  async getWorkspaceForm(templateId: number): Promise<WorkspaceFormSchemaType> {
    // Use template_id to get the form schema for workspace creation
    const response = await this.request<any>(
      'GET',
      `/v2/forms/businessworkspaces/create?template_id=${templateId}`
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
  }

  async createWorkspace(params: WorkspaceCreateParams): Promise<WorkspaceInfo> {
    const formData = new URLSearchParams();

    // template_id is the actual template node ID from the templates array
    formData.append('template_id', params.template_id.toString());
    formData.append('name', params.name);

    if (params.parent_id) {
      formData.append('parent_id', params.parent_id.toString());
    }
    if (params.description) {
      formData.append('description', params.description);
    }

    // Add business properties as JSON if provided
    if (params.business_properties) {
      formData.append('roles', JSON.stringify({
        categories: params.business_properties,
      }));
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

    // Fetch the full workspace details
    return this.getWorkspace(workspaceId);
  }

  async getWorkspace(workspaceId: number): Promise<WorkspaceInfo> {
    const response = await this.request<any>('GET', `/v2/businessworkspaces/${workspaceId}`);

    const props = response?.results?.data?.properties || response?.results;
    if (!props) {
      throw new Error('Workspace not found');
    }

    return this.transformWorkspace(props);
  }

  async searchWorkspaces(options: WorkspaceSearchOptions = {}): Promise<WorkspaceSearchResult> {
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

    const paging = response.paging || response.collection?.paging || {
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
  }

  async getWorkspaceRelations(workspaceId: number): Promise<WorkspaceRelation[]> {
    const response = await this.request<any>(
      'GET',
      `/v2/businessworkspaces/${workspaceId}/relateditems`
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
  }

  async addWorkspaceRelation(
    workspaceId: number,
    relatedWorkspaceId: number,
    relationType?: string
  ): Promise<WorkspaceRelation> {
    const formData = new URLSearchParams();
    formData.append('rel_bw_id', relatedWorkspaceId.toString());
    if (relationType) {
      formData.append('rel_type', relationType);
    }

    const response = await this.request<any>(
      'POST',
      `/v2/businessworkspaces/${workspaceId}/relateditems`,
      undefined,
      formData
    );

    const props = response?.results?.data?.properties || response?.results || response;
    return {
      rel_id: props.rel_id || props.id || relatedWorkspaceId,
      rel_type: relationType || 'related',
      workspace_id: relatedWorkspaceId,
      workspace_name: props.name || '',
      workspace_type_name: props.wksp_type_name,
    };
  }

  async removeWorkspaceRelation(workspaceId: number, relationId: number): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/v2/businessworkspaces/${workspaceId}/relateditems/${relationId}`
    );
  }

  async getWorkspaceRoles(workspaceId: number): Promise<WorkspaceRole[]> {
    const response = await this.request<any>(
      'GET',
      `/v2/businessworkspaces/${workspaceId}/roles`
    );

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
  }

  async getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
    const response = await this.request<any>(
      'GET',
      `/v2/businessworkspaces/${workspaceId}/members`
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
  }

  async getRoleMembers(workspaceId: number, roleId: number): Promise<WorkspaceMember[]> {
    const response = await this.request<any>(
      'GET',
      `/v2/businessworkspaces/${workspaceId}/roles/${roleId}/members`
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
  }

  async addRoleMember(workspaceId: number, roleId: number, memberId: number): Promise<void> {
    const formData = new URLSearchParams();
    formData.append('member_id', memberId.toString());

    await this.request<void>(
      'POST',
      `/v2/businessworkspaces/${workspaceId}/roles/${roleId}/members`,
      undefined,
      formData
    );
  }

  async removeRoleMember(workspaceId: number, roleId: number, memberId: number): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/v2/businessworkspaces/${workspaceId}/roles/${roleId}/members/${memberId}`
    );
  }

  async findWorkspaceRoot(nodeId: number): Promise<WorkspaceInfo | null> {
    try {
      const response = await this.request<any>(
        'GET',
        `/v1/nodes/${nodeId}/businessworkspace`
      );

      const props = response?.results?.data?.properties || response?.data || response;
      if (props && props.id) {
        return this.transformWorkspace(props);
      }
      return null;
    } catch {
      return null;
    }
  }

  // ============ Workflow & Assignment Operations ============

  /**
   * Get current user's workflow assignments (pending tasks)
   */
  async getAssignments(): Promise<WorkflowAssignment[]> {
    const response = await this.request<any>('GET', '/v2/members/assignments');

    // Response structure can vary:
    // - results[].data.assignments (object per item - actual OTCS format)
    // - results[].data.assignments[] (array per item)
    // - results.data.assignments[] (alternative)
    // - data.assignments[] (direct)
    const assignments: WorkflowAssignment[] = [];

    // Try different response structures
    let items: any[] = [];

    if (Array.isArray(response.results)) {
      // Structure: results[].data.assignments (object or array)
      for (const result of response.results) {
        const data = result.data || result;
        const resultAssignments = data.assignments || data.properties?.assignments;
        if (resultAssignments) {
          if (Array.isArray(resultAssignments)) {
            items = items.concat(resultAssignments);
          } else if (typeof resultAssignments === 'object') {
            // Single assignment object per result item
            items.push(resultAssignments);
          }
        }
      }
    } else if (response.results?.data?.assignments) {
      // Structure: results.data.assignments[]
      const a = response.results.data.assignments;
      items = Array.isArray(a) ? a : [a];
    } else if (response.data?.assignments) {
      // Structure: data.assignments[]
      const a = response.data.assignments;
      items = Array.isArray(a) ? a : [a];
    } else if (Array.isArray(response.assignments)) {
      // Direct assignments array
      items = response.assignments;
    }

    for (const item of items) {
      assignments.push({
        id: item.id,
        name: item.name,
        type: item.type,
        type_name: item.type_name,
        description: item.description,
        instructions: item.instructions,
        priority: item.priority,
        priority_name: item.priority_name,
        status: item.status,
        status_name: item.status_name,
        date_due: item.date_due,
        from_user_id: item.from_user_id,
        location_id: item.location_id,
        workflow_id: item.workflow_id,
        workflow_subworkflow_id: item.workflow_subworkflow_id,
        workflow_subworkflow_task_id: item.workflow_subworkflow_task_id,
        maptask_subtype: item.maptask_subtype,
        favorite: item.favorite,
      });
    }

    return assignments;
  }

  /**
   * Get workflows by status (ontime, workflowlate, etc.)
   */
  async getWorkflowStatus(options: {
    status?: string;
    kind?: string;
    sort?: string;
    completed_from?: string;
  } = {}): Promise<WorkflowStatus[]> {
    const params = new URLSearchParams();

    if (options.status) params.append('wfstatusselected', options.status);
    if (options.kind) params.append('kind', options.kind);
    if (options.sort) params.append('sort', options.sort);
    if (options.completed_from) params.append('selectionType', options.completed_from);

    const path = `/v2/workflows/status${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.request<any>('GET', path);

    const data = response.results?.data || [];
    return data.map((item: any) => {
      const props = item.properties || item;
      return this.transformWorkflowStatus(props);
    });
  }

  /**
   * Get active/running workflows with filters
   */
  async getActiveWorkflows(options: ActiveWorkflowsOptions = {}): Promise<WorkflowStatus[]> {
    const params = new URLSearchParams();

    if (options.map_id) params.append('mapid', options.map_id.toString());
    if (options.search_name) params.append('search_name', options.search_name);
    if (options.business_workspace_id) params.append('businessWorkspaceID', options.business_workspace_id.toString());
    if (options.start_date) params.append('startDate', options.start_date);
    if (options.end_date) params.append('endDate', options.end_date);
    if (options.status) params.append('wfstatusselected', options.status);
    if (options.kind) params.append('kind', options.kind);
    if (options.sort) params.append('sort', options.sort);

    const path = `/v2/workflows/status/active${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.request<any>('GET', path);

    const data = response.results?.data || [];
    return data.map((item: any) => {
      const props = item.properties || item;
      return this.transformWorkflowStatus(props);
    });
  }

  /**
   * Get workflow map definition (tasks, data packages)
   */
  async getWorkflowDefinition(mapId: number): Promise<WorkflowDefinition> {
    const response = await this.request<any>('GET', `/v2/processes/${mapId}/definition`);

    const data = response.results?.data || response.results || response;
    return {
      workflow_id: data.workflow_id || mapId,
      data_packages: data.data_packages || [],
      tasks: (data.tasks || []).map((task: any) => ({
        task_id: task.task_id,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        type: task.type,
        sub_type: task.sub_type,
        data: task.data,
      })),
    };
  }

  /**
   * Get task list for a workflow instance (completed, current, next)
   */
  async getWorkflowTasks(processId: number): Promise<WorkflowTaskList> {
    const response = await this.request<any>('GET', `/v2/workflows/status/processes/${processId}`);

    const data = response.results?.data || response.results || response;
    return {
      attachments: data.attachments || [],
      data_packages: data.data_packages || [],
      details: data.details ? {
        date_initiated: data.details.date_initiated,
        date_due: data.details.date_due,
        initiator: data.details.initiator,
        workflow_name: data.details.workflow_name,
        workflow_id: data.details.workflow_id,
      } : undefined,
      tasks: data.tasks ? {
        completed: data.tasks.completed || [],
        current: data.tasks.current || [],
        next: data.tasks.next || [],
      } : undefined,
      permissions: data.permissions,
    };
  }

  /**
   * Get workflow activity history
   */
  async getWorkflowActivities(processId: number, subprocessId: number, limit?: number): Promise<WorkflowActivity[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const path = `/v2/processes/${processId}/subprocesses/${subprocessId}/activities${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.request<any>('GET', path);

    const data = response.results?.data || response.results || response;
    const activities = data.activities || [];

    return activities.map((activity: any) => ({
      action: activity.action,
      comment: activity.comment,
      date: activity.date,
      performer: activity.performer,
      step_name: activity.step_name,
    }));
  }

  /**
   * Create a draft workflow process (before initiation)
   */
  async createDraftWorkflow(workflowId: number, docIds?: string, attachDocuments?: boolean): Promise<{ draftprocess_id: number; workflow_type?: number }> {
    const formData = new URLSearchParams();
    formData.append('workflow_id', workflowId.toString());

    if (docIds) {
      formData.append('doc_ids', docIds);
    }
    if (attachDocuments) {
      formData.append('AttachDocuments', 'TRUE');
    }

    const response = await this.request<any>('POST', '/v2/draftprocesses', undefined, formData);

    const data = response.results?.data || response.results || response;
    return {
      draftprocess_id: data.draftprocess_id || data.id,
      workflow_type: data.workflow_type,
    };
  }

  /**
   * Initiate a workflow (start a new instance)
   */
  async initiateWorkflow(params: WorkflowInitiateParams): Promise<{ work_id: number; workflow_id: number }> {
    // Build the body JSON structure
    const bodyJson = {
      definition: {
        workflow_id: params.workflow_id,
        role_info: params.role_info || {},
      },
    };

    // The API expects a form field called 'body' containing JSON
    const formData = new URLSearchParams();
    formData.append('body', JSON.stringify(bodyJson));

    const response = await this.request<any>('POST', '/v2/processes', undefined, formData);

    const data = response.results?.data || response.results || response;
    return {
      work_id: data.work_id || data.id,
      workflow_id: params.workflow_id,
    };
  }

  /**
   * Start workflow with disabled start step (direct start)
   */
  async startWorkflow(workflowId: number, docIds?: string): Promise<{ work_id: number }> {
    const formData = new URLSearchParams();
    formData.append('workflow_id', workflowId.toString());

    if (docIds) {
      formData.append('doc_ids', docIds);
    }

    const response = await this.request<any>('POST', '/v2/draftprocesses/startwf', undefined, formData);

    const data = response.results?.data || response.results || response;
    return {
      work_id: data.work_id || data.id,
    };
  }

  /**
   * Send a workflow task action (SendOn, Delegate, SendForReview, custom action)
   * Supports workflow form data for tasks that require attribute values
   */
  async sendWorkflowTask(params: WorkflowTaskActionParams): Promise<void> {
    const formData = new URLSearchParams();

    if (params.action) {
      formData.append('action', params.action);
    }
    if (params.custom_action) {
      formData.append('custom_action', params.custom_action);
    }
    if (params.comment) {
      formData.append('comment', params.comment);
    }
    
    // Append workflow form field values (e.g., WorkflowForm_10 for dates)
    if (params.form_data) {
      for (const [key, value] of Object.entries(params.form_data)) {
        formData.append(key, value);
      }
    }

    await this.request<void>(
      'PUT',
      `/v2/processes/${params.process_id}/subprocesses/${params.subprocess_id}/tasks/${params.task_id}`,
      undefined,
      formData
    );
  }

  /**
   * Change workflow status (suspend, resume, stop, archive)
   */
  async updateWorkflowStatus(processId: number, status: 'suspend' | 'resume' | 'stop' | 'archive'): Promise<void> {
    const formData = new URLSearchParams();
    formData.append('status', status);

    await this.request<void>(
      'PUT',
      `/v2/processes/${processId}/status`,
      undefined,
      formData
    );
  }

  /**
   * Delete a workflow instance
   */
  async deleteWorkflow(processId: number): Promise<void> {
    await this.request<void>('DELETE', `/v2/processes/${processId}`);
  }

  /**
   * Get workflow task form schema (for displaying task properties)
   */
  async getWorkflowTaskForm(processId: number, subprocessId: number, taskId: number): Promise<WorkflowFormSchema> {
    const response = await this.request<any>(
      'GET',
      `/v2/forms/workflowproperties?process_id=${processId}&subprocess_id=${subprocessId}&task_id=${taskId}`
    );

    const form = response.forms?.[0]?.data || {};
    return {
      workflow_id: processId,
      subprocess_id: subprocessId,
      task_id: taskId,
      title: form.title,
      instructions: form.instructions,
      priority: form.priority,
      comments_enabled: form.comments_enabled,
      attachments_enabled: form.attachments_enabled,
      actions: form.actions || [],
      custom_actions: form.custom_actions || [],
      data_packages: form.data_packages || [],
    };
  }

  /**
   * Get workflow info by instance ID
   */
  async getWorkflowInfo(workflowInstanceId: number): Promise<WorkflowStatus> {
    const params = new URLSearchParams();
    params.append('workflowInstanceId', workflowInstanceId.toString());

    const response = await this.request<any>('GET', `/v2/workflows/status/info?${params.toString()}`);

    const data = response.results?.data || response.results || response;
    return this.transformWorkflowStatus(data);
  }

  // ============ Utility Methods ============

  private transformWorkflowStatus(props: any): WorkflowStatus {
    return {
      workflow_id: props.workflow_id || props.work_id || props.id,
      workflow_name: props.workflow_name || props.name,
      workflow_status: props.workflow_status || props.status,
      date_initiated: props.date_initiated,
      date_due: props.date_due,
      initiator: props.initiator,
      tasks: props.tasks,
      permissions: props.permissions ? {
        can_archive: props.permissions.archive,
        can_change_attributes: props.permissions.change_attributes,
        can_delete: props.permissions.delete,
        can_modify_route: props.permissions.modify_route,
        can_manage_permissions: props.permissions.manage_permissions,
        can_see_details: props.permissions.see_details,
        can_stop: props.permissions.stop,
        can_suspend: props.permissions.suspend,
      } : undefined,
    };
  }

  private extractNodeProperties(response: OTCSNodeResponse): OTCSNode {
    // Handle different response formats
    if (response.results) {
      if ('data' in response.results && response.results.data?.properties) {
        return response.results.data.properties;
      }
      // Direct properties on results
      return response.results as OTCSNode;
    }
    throw new Error('Unable to extract node properties from response');
  }

  private transformNode(props: OTCSNode): NodeInfo {
    return {
      id: props.id,
      name: props.name,
      type: props.type,
      type_name: props.type_name,
      parent_id: props.parent_id,
      description: props.description,
      create_date: props.create_date,
      modify_date: props.modify_date,
      size: props.size,
      mime_type: props.mime_type,
      container: props.container || props.type === NodeTypes.FOLDER || props.type === NodeTypes.PROJECT,
      container_size: props.container_size,
      permissions: {
        can_see: props.permissions?.perm_see ?? true,
        can_modify: props.permissions?.perm_modify ?? false,
        can_delete: props.permissions?.perm_delete ?? false,
        can_add_items: props.permissions?.perm_create ?? false,
      },
    };
  }

  private transformWorkspace(props: any): WorkspaceInfo {
    const baseNode = this.transformNode(props as OTCSNode);
    return {
      ...baseNode,
      workspace_type_id: props.wksp_type_id || props.workspace_type_id || 0,
      workspace_type_name: props.wksp_type_name || props.workspace_type_name || props.type_name,
      business_properties: props.business_properties || props.categories,
    };
  }
}
