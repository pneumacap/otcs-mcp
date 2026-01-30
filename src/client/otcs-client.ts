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
  // Workflow forms types
  WorkflowPropertiesFormInfo,
  UpdateDraftFormParams,
  WorkflowInfo,
  AcceptTaskResponse,
  // Category types
  CategoryInfo,
  CategoryAttribute,
  CategoryWithValues,
  CategoryValues,
  CategoryFormSchema,
  NodeCategoriesResponse,
  WorkspaceMetadataFormSchema,
  // Member types
  MemberInfo,
  MemberSearchResult,
  MemberSearchOptions,
  GroupMembershipInfo,
  GroupMembersResponse,
  // Permission types
  PermissionString,
  PermissionEntry,
  NodePermissions,
  PermissionUpdateParams,
  PermissionOperationResponse,
  EffectivePermissions,
  ApplyToScopeValue,
  // RM types
  RMClassification,
  RMClassificationsResponse,
  RMClassificationApplyParams,
  RMRecordUpdateParams,
  RMHold,
  RMHoldsResponse,
  RMNodeHoldsResponse,
  RMHoldItemsResponse,
  RMHoldUsersResponse,
  RMHoldParams,
  RMCrossRefType,
  RMCrossRef,
  RMNodeCrossRefsResponse,
  RMCrossRefTypesResponse,
  RMCrossRefApplyParams,
  // RSI types
  RMRSI,
  RMRSISchedule,
  RMRSIListResponse,
  RMRSIItemsResponse,
  RMNodeRSIsResponse,
  RMRSICreateParams,
  RMRSIUpdateParams,
  RMRSIScheduleCreateParams,
  RMRSIAssignParams,
  // Sharing types
  ShareCreateParams,
  ShareInfo,
  ShareOperationResponse,
  SharedItem,
  ShareListResponse,
  // Search types
  EnterpriseSearchOptions,
  EnterpriseSearchResult,
  OTCSSearchResponse,
  SearchResultNodeInfo,
  SearchFacet,
  SearchMode,
  SearchWithinType,
  SearchSortType,
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
    
    // Disable SSL certificate validation for development environments
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
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

  async updateNodeDescription(nodeId: number, description: string): Promise<NodeInfo> {
    const formData = new URLSearchParams();
    formData.append('description', description);

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

  /**
   * Enterprise search using POST /v2/search
   * Searches across the entire repository including document content, names, and metadata
   */
  async search(options: EnterpriseSearchOptions): Promise<EnterpriseSearchResult> {
    const params = new URLSearchParams();

    // Type filtering via OTSubType in complexquery mode
    // The slice parameter is unreliable, so we append OTSubType to the query
    let query = options.query;
    let lookfor = options.lookfor || 'allwords';
    let within = options.within || 'all';

    if (options.filter_type && options.filter_type !== 'all') {
      const typeMap: Record<string, number[]> = {
        documents: [NodeTypes.DOCUMENT],  // 144
        folders: [NodeTypes.FOLDER],       // 0
        workspaces: [NodeTypes.BUSINESS_WORKSPACE],  // 848
        workflows: [NodeTypes.WORKFLOW_MAP],  // 128
      };
      const subtypes = typeMap[options.filter_type];
      if (subtypes && subtypes.length > 0) {
        const subtypeFilter = subtypes.length === 1
          ? `OTSubType:${subtypes[0]}`
          : `(${subtypes.map(s => `OTSubType:${s}`).join(' OR ')})`;

        if (lookfor === 'complexquery') {
          // Already in LQL mode - just append the type constraint
          query = `(${query}) AND ${subtypeFilter}`;
        } else {
          // Wrap the original query as a quoted/grouped term and switch to complexquery
          query = `${query} ${subtypeFilter}`;
          lookfor = 'complexquery';
        }

        // OTSubType is a metadata field, so we must search 'all' (content + metadata)
        // to ensure the type filter matches, even if the user requested content-only
        if (within === 'content') {
          within = 'all';
        }
      }
    }

    // The query goes in the 'where' parameter
    params.append('where', query);

    // Search mode
    params.append('lookfor', lookfor);

    // Search scope - defaults to 'all' (content + metadata)
    params.append('within', within);

    // Related terms modifier (optional, only applies to non-complexquery modes)
    if (options.modifier && lookfor !== 'complexquery') {
      params.append('modifier', options.modifier);
    }

    // Sort order - defaults to relevance
    if (options.sort) {
      params.append('sort', options.sort);
    }

    // Build options array for extra data
    const extraOptions: string[] = [];
    if (options.include_facets) {
      extraOptions.push('"facets"');
    }
    if (options.include_highlights) {
      extraOptions.push('"highlight_summaries"');
    }
    if (extraOptions.length > 0) {
      params.append('options', `{${extraOptions.join(',')}}`);
    }

    // Pagination
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options.page) {
      params.append('page', options.page.toString());
    }

    // Include metadata for field definitions
    params.append('metadata', 'true');

    const response = await this.request<OTCSSearchResponse>(
      'POST',
      '/v2/search',
      undefined,
      params
    );

    // Transform results
    const items: SearchResultNodeInfo[] = (response.results || []).map(item => {
      const props = item.data?.properties;
      if (!props) return null;

      const baseNode = this.transformNode(props as OTCSNode);
      const searchNode: SearchResultNodeInfo = {
        ...baseNode,
      };

      // Add version info if available
      if (item.data?.versions) {
        searchNode.version_info = {
          file_name: item.data.versions.file_name,
          version_number: item.data.versions.version_number,
        };
      }

      // Extract highlight summary from properties.summary
      // The API returns summary as an array of strings and highlight objects
      // e.g. ["text before ", {"text":"match","type":"highlighted"}, " text after"]
      if (options.include_highlights && props.summary) {
        const summaryArr = Array.isArray(props.summary) ? props.summary : [props.summary];
        const summaryText = summaryArr.map((part: unknown) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part) return `**${(part as { text: string }).text}**`;
          return '';
        }).join('');
        if (summaryText.trim()) {
          searchNode.highlight_summary = summaryText;
        }
      }

      return searchNode;
    }).filter((item): item is SearchResultNodeInfo => item !== null);

    const paging = response.collection?.paging;
    const searching = response.collection?.searching;

    // Extract facets from the nested available array
    const facets = searching?.facets;
    const facetArray = facets && typeof facets === 'object' && 'available' in facets
      ? (facets as { available: SearchFacet[] }).available
      : Array.isArray(facets) ? facets : undefined;

    return {
      results: items,
      total_count: paging?.total_count || items.length,
      page: paging?.page || 1,
      page_size: paging?.limit || items.length,
      facets: facetArray,
      cache_id: searching?.cache_id,
    };
  }

  /**
   * Backward-compatible search method that calls the new enterprise search
   * @deprecated Use search() instead
   */
  async searchNodes(
    query: string,
    options: {
      where_type?: number[];
      location?: number;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<{ results: NodeInfo[]; total_count: number }> {
    const result = await this.search({
      query: query,
      limit: options.limit || 50,
      page: options.page,
    });

    return {
      results: result.results,
      total_count: result.total_count,
    };
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

  async resolveTemplateId(id: number): Promise<number> {
    // If the ID is likely a wksp_type_id (small number), look up the actual template node ID
    // First try using it directly; if it fails, look it up from workspace types
    const types = await this.getWorkspaceTypes();
    const matchByType = types.find(t => t.wksp_type_id === id);
    if (matchByType?.template_id) {
      return matchByType.template_id;
    }
    // Check if it's already a valid template_id
    const matchByTemplate = types.find(t => t.template_id === id);
    if (matchByTemplate) {
      return id;
    }
    // Not found in either - return as-is and let the API error naturally
    return id;
  }

  async getWorkspaceForm(templateId: number): Promise<WorkspaceFormSchemaType> {
    // Resolve in case caller passed wksp_type_id instead of template node ID
    const resolvedId = await this.resolveTemplateId(templateId);

    const response = await this.request<any>(
      'GET',
      `/v2/forms/businessworkspaces/create?template_id=${resolvedId}`
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

    // Note: business_properties are applied AFTER workspace creation via category update
    // The workspace template already has categories attached with empty values

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
      propertyResults = await this.applyWorkspaceBusinessProperties(workspaceId, params.business_properties);
    }

    // Fetch the full workspace details
    const workspace = await this.getWorkspace(workspaceId);

    // Attach property update results so the caller can see what happened
    if (propertyResults) {
      (workspace as any)._propertyResults = propertyResults;
    }

    return workspace;
  }

  /**
   * Apply business properties to a workspace by updating its categories.
   *
   * Accepts multiple input formats:
   *   1. Flat keys: { "11150_28": "val", "10588_2": "val" }
   *   2. Nested by category: { "11150": { "28": "val" }, "10588": { "2": "val" } }
   *   3. Nested with full keys: { "11150": { "11150_28": "val" } }
   *   4. Mixed: any combination of the above
   *
   * All formats are normalised to flat {category_id}_{attribute_id} keys before
   * being grouped by category and sent to updateCategory().
   */
  private async applyWorkspaceBusinessProperties(
    workspaceId: number,
    properties: Record<string, unknown>
  ): Promise<{ updated: number[]; failed: number[] }> {
    // Group properties by category ID
    const categorizedValues: Record<number, CategoryValues> = {};

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

      // Unrecognised key format — skip with warning
      console.warn(`applyWorkspaceBusinessProperties: skipping unrecognised key "${key}"`);
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
        `Failed to apply business properties: all ${failed.length} category update(s) failed (categories: ${failed.join(', ')})`
      );
    }

    return { updated, failed };
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

    // API returns: {"results":{"custom_message":null,"process_id":176344}}
    const processId = response.results?.process_id || response.process_id;

    if (!processId) {
      throw new Error('Failed to get workflow instance ID from API response');
    }

    return {
      work_id: processId,
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

    // Append workflow form field values
    // Try multiple formats to see which one works
    if (params.form_data) {
      console.error('DEBUG sendWorkflowTask form_data input:', JSON.stringify(params.form_data, null, 2));

      for (const [key, value] of Object.entries(params.form_data)) {
        // Try the direct WorkflowForm_X format first
        formData.append(key, String(value));
        console.error(`DEBUG appending form field: ${key} = ${value}`);
      }
    }

    console.error('DEBUG sendWorkflowTask formData:', formData.toString());
    console.error('DEBUG sendWorkflowTask URL:', `/v2/processes/${params.process_id}/subprocesses/${params.subprocess_id}/tasks/${params.task_id}`);

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
   * Uses /v1/forms/processes/tasks/update for Alpaca form schema
   */
  async getWorkflowTaskForm(processId: number, subprocessId: number, taskId: number): Promise<WorkflowFormSchema> {
    const response = await this.request<any>(
      'GET',
      `/v1/forms/processes/tasks/update?process_id=${processId}&subprocess_id=${subprocessId}&task_id=${taskId}`
    );

    const data = response.data || {};
    return {
      workflow_id: processId,
      subprocess_id: subprocessId,
      task_id: taskId,
      title: data.title,
      instructions: data.instructions,
      priority: data.priority,
      comments_enabled: data.comments_on,
      attachments_enabled: data.attachments_on,
      actions: data.actions || [],
      custom_actions: data.custom_actions || [],
      data_packages: data.data_packages || [],
    };
  }

  /**
   * Get full workflow task form with Alpaca forms (comprehensive form schema)
   * Returns the complete form structure including field definitions
   */
  async getWorkflowTaskFormFull(processId: number, subprocessId: number, taskId: number): Promise<WorkflowPropertiesFormInfo> {
    const response = await this.request<any>(
      'GET',
      `/v1/forms/processes/tasks/update?process_id=${processId}&subprocess_id=${subprocessId}&task_id=${taskId}`
    );

    return {
      data: {
        title: response.data?.title,
        instructions: response.data?.instructions,
        priority: response.data?.priority,
        comments_on: response.data?.comments_on,
        attachments_on: response.data?.attachments_on,
        data_packages: response.data?.data_packages || [],
        actions: response.data?.actions || [],
        custom_actions: response.data?.custom_actions || [],
        message: response.data?.message,
        member_accept: response.data?.member_accept,
        reply_performer_id: response.data?.reply_performer_id,
        task: response.data?.task,
        authentication: response.data?.authentication,
      },
      forms: response.forms || [],
    };
  }

  /**
   * Get draft workflow form schema
   * Uses /v1/forms/draftprocesses for Alpaca form schema
   */
  async getDraftWorkflowForm(draftprocessId: number): Promise<WorkflowPropertiesFormInfo> {
    const response = await this.request<any>(
      'GET',
      `/v1/forms/draftprocesses?draftprocess_id=${draftprocessId}`
    );

    return {
      data: {
        title: response.data?.title,
        instructions: response.data?.instructions,
        priority: response.data?.priority,
        comments_on: response.data?.comments_on,
        attachments_on: response.data?.attachments_on,
        data_packages: response.data?.data_packages || [],
        actions: response.data?.actions || [],
        custom_actions: response.data?.custom_actions || [],
        message: response.data?.message,
        member_accept: response.data?.member_accept,
        reply_performer_id: response.data?.reply_performer_id,
        task: response.data?.task,
        authentication: response.data?.authentication,
      },
      forms: response.forms || [],
    };
  }

  /**
   * Update draft workflow form values or initiate the workflow
   * action: 'formUpdate' to update form values, 'Initiate' to start the workflow
   */
  async updateDraftWorkflowForm(params: UpdateDraftFormParams): Promise<void> {
    const formData = new URLSearchParams();
    formData.append('action', params.action);

    if (params.comment) {
      formData.append('comment', params.comment);
    }

    if (params.values && params.action === 'formUpdate') {
      formData.append('values', JSON.stringify(params.values));
    }

    await this.request<void>(
      'PUT',
      `/v2/draftprocesses/${params.draftprocess_id}`,
      undefined,
      formData
    );
  }

  /**
   * Get comprehensive workflow info by instance ID
   * Returns forms, attributes, comments, and step history
   */
  async getWorkflowInfoFull(workId: number): Promise<WorkflowInfo> {
    const response = await this.request<any>('GET', `/v2/workflows/status/info?workid=${workId}`);

    const results = response.results || {};
    const generalInfo = Array.isArray(results.generalInfo) ? results.generalInfo[0] : results.generalInfo || {};
    const managers = Array.isArray(results.ManagerList) ? results.ManagerList : [];
    const stepList = Array.isArray(results.stepList) ? results.stepList : [];
    const comments = Array.isArray(results.comments) ? results.comments : [];
    const attributes = Array.isArray(results.Attributes) ? results.Attributes : [];

    // Extract attribute values into a flat object
    const attributeValues: Record<string, unknown> = {};
    for (const attr of attributes) {
      const children = Array.isArray(attr?.Content?.Rootset?.Children)
        ? attr.Content.Rootset.Children
        : [];
      for (const child of children) {
        if (child.Name && child.Value !== undefined) {
          attributeValues[child.Name] = child.Value;
        }
      }
    }

    return {
      work_id: workId,
      title: generalInfo.title || generalInfo.wf_name || '',
      status: generalInfo.status || '',
      date_initiated: generalInfo.date_initiated,
      date_due: generalInfo.date_due,
      initiator: generalInfo.initiator_id ? {
        id: generalInfo.initiator_id,
        name: generalInfo.initiator_name || '',
      } : undefined,
      managers: managers.map((m: any) => ({
        id: m.id,
        name: m.name,
      })),
      steps: stepList.map((s: any) => ({
        step_name: s.step_name || '',
        status: s.status || '',
        performer: s.performer,
        disposition: s.disposition,
        start_date: s.start_date,
      })),
      comments: comments.map((c: any) => ({
        comment: c.comment || '',
        date: c.date || '',
        user_name: c.user_name || '',
      })),
      attributes: attributeValues,
      attachment_count: results.Attachments,
    };
  }

  /**
   * Get workflow info by instance ID (simplified)
   */
  async getWorkflowInfo(workflowInstanceId: number): Promise<WorkflowStatus> {
    const params = new URLSearchParams();
    params.append('workid', workflowInstanceId.toString());

    const response = await this.request<any>('GET', `/v2/workflows/status/info?${params.toString()}`);

    const results = response.results || {};
    const generalInfo = results.generalInfo?.[0] || {};

    return {
      workflow_id: workflowInstanceId,
      workflow_name: generalInfo.wf_name || generalInfo.title || '',
      workflow_status: generalInfo.status || '',
      date_initiated: generalInfo.date_initiated,
      date_due: generalInfo.date_due,
      initiator: generalInfo.initiator_id ? {
        id: generalInfo.initiator_id,
        name: generalInfo.initiator_name || '',
      } : undefined,
    };
  }

  /**
   * Accept a group-assigned workflow task
   */
  async acceptWorkflowTask(processId: number, subprocessId: number, taskId: number): Promise<AcceptTaskResponse> {
    const response = await this.request<any>(
      'POST',
      `/v2/mobilegroupassignment/accept/taskid/${taskId}/processid/${processId}/subprocessid/${subprocessId}`
    );

    return {
      success: true,
      message: response.results?.data?.message || 'Task accepted successfully',
    };
  }

  /**
   * Check if a workflow task is assigned to a group
   */
  async checkGroupAssignment(processId: number, subprocessId: number, taskId: number): Promise<boolean> {
    try {
      const response = await this.request<any>(
        'GET',
        `/v2/mobilegroupassignment/check/taskid/${taskId}/processid/${processId}/subprocessid/${subprocessId}`
      );
      return response.results?.data?.isGroupAssignment === true;
    } catch {
      return false;
    }
  }

  // ============ Category & Metadata Operations ============

  /**
   * Get all categories applied to a node
   */
  async getCategories(nodeId: number, includeMetadata: boolean = false): Promise<NodeCategoriesResponse> {
    const params = includeMetadata ? '?metadata' : '';
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/categories${params}`);

    const categories: CategoryWithValues[] = [];
    const results = response.results || [];

    // Response structure: results[].data.categories - each category has attribute keys and values
    for (const result of results) {
      const data = result.data || result;
      if (data.categories) {
        // Categories is an object keyed by category ID
        for (const [catIdStr, catData] of Object.entries(data.categories as Record<string, any>)) {
          if (catData == null || typeof catData !== 'object') continue;
          const catId = parseInt(catIdStr, 10);
          const attributes: CategoryWithValues['attributes'] = [];

          // Extract attributes from the category data
          for (const [attrKey, attrValue] of Object.entries(catData)) {
            if (attrKey !== 'name' && !attrKey.endsWith('_name')) {
              attributes.push({
                key: attrKey,
                name: attrKey, // Will be populated from metadata if available
                type: typeof attrValue === 'object' ? 'object' : typeof attrValue,
                value: attrValue,
              });
            }
          }

          categories.push({
            id: catId,
            name: catData.name || `Category ${catId}`,
            attributes,
          });
        }
      }
    }

    return {
      node_id: nodeId,
      categories,
    };
  }

  /**
   * Get a specific category applied to a node
   */
  async getCategory(nodeId: number, categoryId: number, includeMetadata: boolean = false): Promise<CategoryWithValues | null> {
    const params = includeMetadata ? '?metadata' : '';
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/categories/${categoryId}/${params}`);

    const results = response.results || [];
    if (results.length === 0) return null;

    const data = results[0]?.data || results[0];
    const catData = data.categories?.[categoryId] || data;

    const attributes: CategoryWithValues['attributes'] = [];

    // Extract attributes
    for (const [attrKey, attrValue] of Object.entries(catData)) {
      if (attrKey !== 'name' && !attrKey.endsWith('_name')) {
        attributes.push({
          key: attrKey,
          name: attrKey,
          type: typeof attrValue === 'object' ? 'object' : typeof attrValue,
          value: attrValue,
        });
      }
    }

    return {
      id: categoryId,
      name: catData.name || `Category ${categoryId}`,
      attributes,
    };
  }

  /**
   * Add a category to a node with optional attribute values
   * Values can be keyed as:
   * - Simple: {category_id}_{attribute_id}
   * - Set row: {category_id}_{set_id}_{row}_{attribute_id}
   * - Nested object: { set_id: { row: { attr_id: value } } } (will be flattened)
   */
  async addCategory(nodeId: number, categoryId: number, values?: CategoryValues): Promise<{ success: boolean; category_id: number }> {
    const formData = new URLSearchParams();
    formData.append('category_id', categoryId.toString());

    // Add attribute values if provided
    if (values) {
      this.appendCategoryValues(formData, values, categoryId);
    }

    await this.request<any>('POST', `/v2/nodes/${nodeId}/categories`, undefined, formData);

    return {
      success: true,
      category_id: categoryId,
    };
  }

  /**
   * Update category values on a node
   * Values can be keyed as:
   * - Simple: {category_id}_{attribute_id}
   * - Set row: {category_id}_{set_id}_{row}_{attribute_id}
   * - Nested object: { set_id: { row: { attr_id: value } } } (will be flattened)
   */
  async updateCategory(nodeId: number, categoryId: number, values: CategoryValues): Promise<{ success: boolean }> {
    const formData = new URLSearchParams();

    // Add attribute values
    this.appendCategoryValues(formData, values, categoryId);

    await this.request<any>('PUT', `/v2/nodes/${nodeId}/categories/${categoryId}/`, undefined, formData);

    return { success: true };
  }

  /**
   * Helper to append category values to form data
   * Handles both flat keys and nested object structures
   *
   * Supports formats:
   * 1. Flat keys: { "9830_2": "value", "9830_4_1_5": ["a", "b"] }
   * 2. Nested objects: { "9830_4": { "1": { "5": ["a", "b"] } } }
   * 3. Row arrays: { "9830_4": [{ "5": "val1" }, { "5": "val2" }] }
   */
  private appendCategoryValues(formData: URLSearchParams, values: CategoryValues, categoryId: number): void {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue;

      // Check if this is already a properly formatted key (contains category ID prefix)
      const isFormattedKey = /^\d+_\d+/.test(key);

      if (isFormattedKey) {
        // Key is already in correct format: {category_id}_{...}
        this.appendSingleValue(formData, key, value);
      } else {
        // Key might be just the attribute/set ID - prefix with category ID
        const fullKey = `${categoryId}_${key}`;

        // Check if value is a nested object (set rows)
        if (this.isSetRowObject(value)) {
          // Value is an object with row indices as keys: { "1": { attr: val }, "2": { attr: val } }
          this.flattenSetRows(formData, fullKey, value as Record<string, unknown>);
        } else if (Array.isArray(value) && value.length > 0 && this.isRowObjectArray(value)) {
          // Value is an array of row objects: [{ attr: val }, { attr: val }]
          this.flattenRowArray(formData, fullKey, value as Record<string, unknown>[]);
        } else {
          // Simple value or multi-value array
          this.appendSingleValue(formData, fullKey, value);
        }
      }
    }
  }

  /**
   * Check if value is an object representing set rows (keys are row indices)
   */
  private isSetRowObject(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    // Row objects have numeric keys representing row indices
    return keys.length > 0 && keys.every(k => /^\d+$/.test(k));
  }

  /**
   * Check if array contains row objects (each element is an object with attribute keys)
   */
  private isRowObjectArray(arr: unknown[]): boolean {
    return arr.every(item =>
      item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  /**
   * Flatten set row object: { "1": { "5": "val", "6": "val2" } } → "key_1_5", "key_1_6"
   */
  private flattenSetRows(formData: URLSearchParams, baseKey: string, rows: Record<string, unknown>): void {
    for (const [rowIndex, rowData] of Object.entries(rows)) {
      if (rowData && typeof rowData === 'object' && !Array.isArray(rowData)) {
        // Row data is an object with attribute IDs as keys
        for (const [attrKey, attrValue] of Object.entries(rowData as Record<string, unknown>)) {
          const fullKey = `${baseKey}_${rowIndex}_${attrKey}`;
          this.appendSingleValue(formData, fullKey, attrValue);
        }
      } else {
        // Row data is a direct value (unusual but handle it)
        const fullKey = `${baseKey}_${rowIndex}`;
        this.appendSingleValue(formData, fullKey, rowData);
      }
    }
  }

  /**
   * Flatten row array: [{ "5": "val1" }, { "5": "val2" }] → "key_1_5", "key_2_5"
   */
  private flattenRowArray(formData: URLSearchParams, baseKey: string, rows: Record<string, unknown>[]): void {
    rows.forEach((rowData, index) => {
      const rowIndex = index + 1; // Content Server uses 1-based row indices
      for (const [attrKey, attrValue] of Object.entries(rowData)) {
        const fullKey = `${baseKey}_${rowIndex}_${attrKey}`;
        this.appendSingleValue(formData, fullKey, attrValue);
      }
    });
  }

  /**
   * Append a single value to form data with proper serialization
   * Multi-value arrays are sent as repeated form fields with the same key
   */
  private appendSingleValue(formData: URLSearchParams, key: string, value: unknown): void {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      // Multi-value attribute - send each value as separate field
      // Content Server expects repeated keys for multi-value: key=val1&key=val2
      for (const item of value) {
        if (item !== undefined && item !== null) {
          if (typeof item === 'object') {
            // Multilingual or complex item within array
            formData.append(key, JSON.stringify(item));
          } else {
            formData.append(key, String(item));
          }
        }
      }
    } else if (typeof value === 'object') {
      // Object value (e.g., multilingual) - send as JSON
      formData.append(key, JSON.stringify(value));
    } else {
      // Scalar value
      formData.append(key, String(value));
    }
  }

  /**
   * Remove a category from a node
   */
  async removeCategory(nodeId: number, categoryId: number): Promise<{ success: boolean }> {
    await this.request<void>('DELETE', `/v2/nodes/${nodeId}/categories/${categoryId}/`);
    return { success: true };
  }

  /**
   * Get the form schema for adding a category to a node
   * Returns the Alpaca form with field definitions
   */
  async getCategoryCreateForm(nodeId: number, categoryId: number): Promise<CategoryFormSchema> {
    const response = await this.request<any>(
      'GET',
      `/v1/forms/nodes/categories/create?id=${nodeId}&category_id=${categoryId}`
    );

    const attributes = this.extractCategoryAttributes(response);

    return {
      category_id: categoryId,
      category_name: response.data?.name || `Category ${categoryId}`,
      attributes,
    };
  }

  /**
   * Get the form schema for updating a category on a node
   * Returns the Alpaca form with current values and field definitions
   */
  async getCategoryUpdateForm(nodeId: number, categoryId: number): Promise<CategoryFormSchema> {
    const response = await this.request<any>(
      'GET',
      `/v1/forms/nodes/categories/update?id=${nodeId}&category_id=${categoryId}`
    );

    const attributes = this.extractCategoryAttributes(response);

    return {
      category_id: categoryId,
      category_name: response.data?.name || `Category ${categoryId}`,
      attributes,
    };
  }

  /**
   * Get the metadata update form for a business workspace
   * Returns form schema for all workspace categories
   */
  async getWorkspaceMetadataForm(workspaceId: number): Promise<WorkspaceMetadataFormSchema> {
    const response = await this.request<any>(
      'GET',
      `/v2/forms/businessworkspaces/${workspaceId}/metadata/update`
    );

    const categories: CategoryFormSchema[] = [];
    const forms = response.forms || [];

    for (const form of forms) {
      if (form.schema?.properties) {
        // Each form represents a category
        const catId = form.data?.id || 0;
        const catName = form.data?.name || form.options?.form?.attributes?.name || 'Unknown';
        const attributes = this.extractCategoryAttributes({ forms: [form] });

        categories.push({
          category_id: catId,
          category_name: catName,
          attributes,
        });
      }
    }

    return {
      workspace_id: workspaceId,
      categories,
    };
  }

  /**
   * Update workspace metadata (business properties)
   * Combines getting the form schema and updating values
   */
  async updateWorkspaceMetadata(workspaceId: number, values: Record<string, unknown>): Promise<{ success: boolean }> {
    // For workspace metadata updates, we use the node categories API
    // The workspace node itself has categories that represent business properties

    // Get current categories to find which ones need updating
    const categoriesResponse = await this.getCategories(workspaceId);

    // Update each category that has matching keys in values
    for (const category of categoriesResponse.categories) {
      const categoryPrefix = `${category.id}_`;
      const categoryValues: CategoryValues = {};
      let hasValues = false;

      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith(categoryPrefix)) {
          categoryValues[key] = value;
          hasValues = true;
        }
      }

      if (hasValues) {
        await this.updateCategory(workspaceId, category.id, categoryValues);
      }
    }

    return { success: true };
  }

  /**
   * Helper to extract category attributes from Alpaca form response
   * Handles nested set structures recursively
   */
  private extractCategoryAttributes(response: any): CategoryAttribute[] {
    const attributes: CategoryAttribute[] = [];
    const forms = response.forms || [];
    const formData = response.data || {};

    for (const form of forms) {
      if (form.schema?.properties) {
        const props = form.schema.properties;
        const fieldOptions = form.options?.fields || {};
        const requiredFields = form.schema.required || [];

        for (const [key, prop] of Object.entries(props as Record<string, any>)) {
          const attr = this.extractSingleAttribute(
            key,
            prop,
            fieldOptions[key] || {},
            requiredFields.includes(key),
            fieldOptions,
            formData[key]
          );
          attributes.push(attr);
        }
      }
    }

    return attributes;
  }

  /**
   * Extract a single attribute, handling nested set structures
   */
  private extractSingleAttribute(
    key: string,
    prop: any,
    fieldOpts: any,
    required: boolean,
    allFieldOptions: any,
    dataValue: unknown
  ): CategoryAttribute {
    const attr: CategoryAttribute = {
      key,
      name: fieldOpts.label || prop.title || key,
      type: prop.type || 'string',
      type_name: prop.format || prop.type,
      required,
      multi_value: prop.type === 'array',
      read_only: prop.readonly || fieldOpts.readonly,
      hidden: fieldOpts.hidden,
      description: fieldOpts.helper || prop.description,
    };

    if (prop.maxLength) attr.max_length = prop.maxLength;
    if (prop.minimum !== undefined) attr.min_value = prop.minimum;
    if (prop.maximum !== undefined) attr.max_value = prop.maximum;
    if (prop.default !== undefined) attr.default_value = prop.default;

    // Handle enum/select options
    if (prop.enum || fieldOpts.optionLabels) {
      attr.valid_values = (prop.enum || []).map((val: string, idx: number) => ({
        key: val,
        value: fieldOpts.optionLabels?.[idx] || val,
      }));
    }

    // Handle set/group attributes with nested properties
    // Sets in Alpaca forms have type 'array' with items.type 'object' and items.properties
    if (prop.type === 'array' && prop.items?.type === 'object' && prop.items?.properties) {
      attr.is_set = true;
      attr.type = 'set';
      attr.type_name = 'set';
      attr.multi_value = false; // Sets themselves aren't multi-value, their children might be

      // Extract nested attributes from the set's item schema
      const setProps = prop.items.properties;
      const setFieldOptions = fieldOpts.fields?.item?.fields || fieldOpts.items?.fields || {};
      const setRequiredFields = prop.items.required || [];

      attr.children = [];
      for (const [childKey, childProp] of Object.entries(setProps as Record<string, any>)) {
        const childOpts = setFieldOptions[childKey] || {};
        const childAttr = this.extractSingleAttribute(
          childKey,
          childProp,
          childOpts,
          setRequiredFields.includes(childKey),
          setFieldOptions,
          undefined
        );
        attr.children.push(childAttr);
      }

      // Determine row count from the data value if available
      if (Array.isArray(dataValue)) {
        attr.set_rows = dataValue.length;
      }
    }
    // Handle object type with properties (inline set definition)
    else if (prop.type === 'object' && prop.properties) {
      attr.is_set = true;
      attr.type = 'set';
      attr.type_name = 'set';

      const setProps = prop.properties;
      const setFieldOptions = fieldOpts.fields || {};
      const setRequiredFields = prop.required || [];

      attr.children = [];
      for (const [childKey, childProp] of Object.entries(setProps as Record<string, any>)) {
        const childOpts = setFieldOptions[childKey] || {};
        const childAttr = this.extractSingleAttribute(
          childKey,
          childProp,
          childOpts,
          setRequiredFields.includes(childKey),
          setFieldOptions,
          undefined
        );
        attr.children.push(childAttr);
      }

      // For object type, check if data has rows
      if (dataValue && typeof dataValue === 'object') {
        const rowKeys = Object.keys(dataValue).filter(k => /^\d+$/.test(k));
        attr.set_rows = rowKeys.length;
      }
    }

    return attr;
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

  // ============ Member (Users & Groups) Operations ============

  /**
   * Search for users and/or groups
   * @param options Search options including type (0=user, 1=group), query, etc.
   */
  async searchMembers(options: MemberSearchOptions = {}): Promise<MemberSearchResult> {
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
      // Members API returns results[].data.properties
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
  }

  /**
   * Get a member (user or group) by ID
   */
  async getMember(memberId: number): Promise<MemberInfo> {
    const response = await this.request<any>('GET', `/v2/members/${memberId}`);

    // Single member response: results.data.properties or variations
    const data = response.results?.data?.properties || response.results?.data || response.results || response;
    return this.transformMember(data);
  }

  /**
   * Get groups that a user belongs to
   */
  async getUserGroups(userId: number, options: { limit?: number; page?: number } = {}): Promise<GroupMembershipInfo> {
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
  }

  /**
   * Get members of a group
   */
  async getGroupMembers(groupId: number, options: { limit?: number; page?: number; sort?: string } = {}): Promise<GroupMembersResponse> {
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
  }

  /**
   * Add a member to a group
   */
  async addMemberToGroup(groupId: number, memberId: number): Promise<{ success: boolean }> {
    const formData = new URLSearchParams();
    formData.append('member_id', memberId.toString());

    await this.request<void>(
      'POST',
      `/v2/members/${groupId}/members`,
      undefined,
      formData
    );

    return { success: true };
  }

  /**
   * Remove a member from a group
   */
  async removeMemberFromGroup(groupId: number, memberId: number): Promise<{ success: boolean }> {
    await this.request<void>(
      'DELETE',
      `/v2/members/${groupId}/members/${memberId}`
    );

    return { success: true };
  }

  /**
   * Transform raw member data to MemberInfo
   */
  private transformMember(data: any): MemberInfo {
    // Handle privileges from OTCS API naming convention
    const hasPrivileges = data.privilege_login !== undefined ||
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
      privileges: hasPrivileges ? {
        create_users: data.privilege_modify_users,
        create_groups: data.privilege_modify_groups,
        login_enabled: data.privilege_login,
        admin: data.privilege_user_admin_rights,
        system_admin: data.privilege_system_admin_rights,
      } : undefined,
    };
  }

  // ============ Permission Operations ============

  /**
   * Get all permissions on a node (owner, group, public, custom)
   */
  async getNodePermissions(nodeId: number): Promise<NodePermissions> {
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/permissions?expand=member`);

    // Parse permissions from response
    const permissions: NodePermissions = {
      node_id: nodeId,
      custom_permissions: [],
    };

    // The API returns results as an array of {data: {permissions: {permissions, right_id, type}}}
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

    // Fallback: object-based response structure (e.g. {results: {data: {owner, group, ...}}})
    const data = (results && results.data) || results || {};

    // Owner permissions
    if (data.owner) {
      permissions.owner = this.transformPermissionEntry(data.owner, 'owner');
    }

    // Owner group permissions
    if (data.group) {
      permissions.group = this.transformPermissionEntry(data.group, 'group');
    }

    // Public access permissions
    if (data.public_access) {
      permissions.public_access = this.transformPermissionEntry(data.public_access, 'public');
    }

    // Custom (assigned access) permissions
    if (Array.isArray(data.custom_permissions)) {
      permissions.custom_permissions = data.custom_permissions.map((p: any) =>
        this.transformPermissionEntry(p, 'custom')
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
  }

  /**
   * Get owner permissions for a node
   */
  async getOwnerPermissions(nodeId: number): Promise<PermissionEntry | null> {
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/permissions/owner?expand=member`);

    const data = response.results?.data || response.results || response;
    if (!data) return null;

    return this.transformPermissionEntry(data, 'owner');
  }

  /**
   * Update owner permissions for a node
   */
  async updateOwnerPermissions(
    nodeId: number,
    permissions: PermissionString[],
    options: { right_id?: number; apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {}
  ): Promise<PermissionOperationResponse> {
    const bodyData: any = {
      permissions,
    };
    if (options.right_id) bodyData.right_id = options.right_id;
    if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
    if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

    const formData = new URLSearchParams();
    formData.append('body', JSON.stringify(bodyData));

    await this.request<void>(
      'PUT',
      `/v2/nodes/${nodeId}/permissions/owner`,
      undefined,
      formData
    );

    return { success: true };
  }

  /**
   * Get owner group permissions for a node
   */
  async getGroupPermissions(nodeId: number): Promise<PermissionEntry | null> {
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/permissions/group?expand=member`);

    const data = response.results?.data || response.results || response;
    if (!data) return null;

    return this.transformPermissionEntry(data, 'group');
  }

  /**
   * Update owner group permissions for a node
   */
  async updateGroupPermissions(
    nodeId: number,
    permissions: PermissionString[],
    options: { right_id?: number; apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {}
  ): Promise<PermissionOperationResponse> {
    const bodyData: any = {
      permissions,
    };
    if (options.right_id) bodyData.right_id = options.right_id;
    if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
    if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

    const formData = new URLSearchParams();
    formData.append('body', JSON.stringify(bodyData));

    await this.request<void>(
      'PUT',
      `/v2/nodes/${nodeId}/permissions/group`,
      undefined,
      formData
    );

    return { success: true };
  }

  /**
   * Get public access permissions for a node
   */
  async getPublicPermissions(nodeId: number): Promise<PermissionEntry | null> {
    const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/permissions/public?expand=member`);

    const data = response.results?.data || response.results || response;
    if (!data) return null;

    return this.transformPermissionEntry(data, 'public');
  }

  /**
   * Update public access permissions for a node
   */
  async updatePublicPermissions(
    nodeId: number,
    permissions: PermissionString[],
    options: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {}
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
      `/v2/nodes/${nodeId}/permissions/public`,
      undefined,
      formData
    );

    return { success: true };
  }

  /**
   * Add custom (assigned access) permission for a user/group on a node
   */
  async addCustomPermission(
    nodeId: number,
    rightId: number,
    permissions: PermissionString[],
    options: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {}
  ): Promise<PermissionOperationResponse> {
    const bodyData: any = {
      permissions,
      right_id: rightId,
    };
    if (options.apply_to !== undefined) bodyData.apply_to = options.apply_to;
    if (options.include_sub_types) bodyData.include_sub_types = options.include_sub_types;

    const formData = new URLSearchParams();
    formData.append('body', JSON.stringify(bodyData));

    await this.request<void>(
      'POST',
      `/v2/nodes/${nodeId}/permissions/custom`,
      undefined,
      formData
    );

    return { success: true };
  }

  /**
   * Get custom (assigned access) permission for a specific user/group on a node
   */
  async getCustomPermission(nodeId: number, rightId: number): Promise<PermissionEntry | null> {
    const response = await this.request<any>(
      'GET',
      `/v2/nodes/${nodeId}/permissions/custom/${rightId}?expand=member`
    );

    const data = response.results?.data || response.results || response;
    if (!data) return null;

    return this.transformPermissionEntry(data, 'custom');
  }

  /**
   * Update custom (assigned access) permission for a user/group on a node
   */
  async updateCustomPermission(
    nodeId: number,
    rightId: number,
    permissions: PermissionString[],
    options: { apply_to?: ApplyToScopeValue; include_sub_types?: number[] } = {}
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
      formData
    );

    return { success: true };
  }

  /**
   * Remove custom (assigned access) permission for a user/group from a node
   */
  async removeCustomPermission(
    nodeId: number,
    rightId: number,
    options: { apply_to?: ApplyToScopeValue } = {}
  ): Promise<PermissionOperationResponse> {
    const params = new URLSearchParams();
    if (options.apply_to !== undefined) {
      params.append('apply_to', options.apply_to.toString());
    }

    const queryString = params.toString();
    const path = `/v2/nodes/${nodeId}/permissions/custom/${rightId}${queryString ? '?' + queryString : ''}`;

    await this.request<void>('DELETE', path);

    return { success: true };
  }

  /**
   * Get effective permissions for a user on a node
   */
  async getEffectivePermissions(nodeId: number, memberId: number): Promise<EffectivePermissions> {
    const response = await this.request<any>(
      'GET',
      `/v2/nodes/${nodeId}/permissions/effective/${memberId}`
    );

    const data = response.results?.data || response.results || response;
    const permissions = this.extractPermissionStrings(data.permissions || data);

    return {
      node_id: nodeId,
      member_id: memberId,
      permissions,
    };
  }

  /**
   * Transform permission data to PermissionEntry
   */
  private transformPermissionEntry(data: any, type: 'owner' | 'group' | 'public' | 'custom'): PermissionEntry {
    return {
      right_id: data.right_id || data.id,
      right_name: data.right_name || data.name,
      right_type: data.right_type || data.type,
      right_type_name: data.right_type_name || data.type_name,
      permissions: this.extractPermissionStrings(data.permissions || data),
      permission_type: type,
    };
  }

  /**
   * Extract permission strings from various formats
   */
  private extractPermissionStrings(data: any): PermissionString[] {
    // If it's already an array of strings, return as-is
    if (Array.isArray(data)) {
      return data.filter(p => typeof p === 'string') as PermissionString[];
    }

    // If it's an object with boolean flags
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
  }

  // ============ Records Management: Classifications ============

  /**
   * Get RM classifications on a node
   */
  async getRMClassifications(nodeId: number): Promise<RMClassificationsResponse> {
    const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/rmclassifications`);

    const classifications: RMClassification[] = [];
    // The response has the data array and metadata token at root level
    const dataArray = response.data || [];
    const metadataToken = response.rm_metadataToken;

    if (Array.isArray(dataArray)) {
      for (const item of dataArray) {
        classifications.push(this.parseRMClassification(item));
      }
    } else if (dataArray && typeof dataArray === 'object') {
      // Single classification or nested structure
      if (dataArray.rmclassifications) {
        for (const item of dataArray.rmclassifications) {
          classifications.push(this.parseRMClassification(item));
        }
      } else if (dataArray.id || dataArray.class_id) {
        classifications.push(this.parseRMClassification(dataArray));
      }
    }

    return {
      node_id: nodeId,
      classifications,
      rm_metadataToken: metadataToken,
    };
  }

  /**
   * Apply RM classification to a node (declare as record)
   */
  async applyRMClassification(params: RMClassificationApplyParams): Promise<{ success: boolean; classification?: RMClassification }> {
    // First get the metadataToken (may be empty for unclassified nodes)
    const current = await this.getRMClassifications(params.node_id);

    const formData = new URLSearchParams();
    formData.append('class_id', params.class_id.toString());
    if (current.rm_metadataToken) {
      formData.append('rm_metadataToken', current.rm_metadataToken);
    }
    if (params.official !== undefined) formData.append('official', params.official.toString());
    if (params.vital_record !== undefined) formData.append('vital_record', params.vital_record.toString());
    if (params.essential !== undefined) formData.append('essential', params.essential.toString());

    const response = await this.request<any>('POST', `/v1/nodes/${params.node_id}/rmclassifications`, undefined, formData);

    return {
      success: true,
      classification: response.data ? this.parseRMClassification(response.data) : undefined,
    };
  }

  /**
   * Remove RM classification from a node
   */
  async removeRMClassification(nodeId: number, classId: number): Promise<{ success: boolean }> {
    // First get the metadataToken required for DELETE
    const current = await this.getRMClassifications(nodeId);
    let url = `/v1/nodes/${nodeId}/rmclassifications/${classId}`;
    if (current.rm_metadataToken) {
      url += `?rm_metadataToken=${encodeURIComponent(current.rm_metadataToken)}`;
    }
    await this.request<any>('DELETE', url);
    return { success: true };
  }

  /**
   * Update record details
   */
  async updateRMRecordDetails(params: RMRecordUpdateParams): Promise<{ success: boolean }> {
    // First get the current classification to retrieve the metadataToken
    const current = await this.getRMClassifications(params.node_id);

    const formData = new URLSearchParams();
    // Include the metadataToken to prevent edit conflicts
    if (current.rm_metadataToken) {
      formData.append('rm_metadataToken', current.rm_metadataToken);
    }
    if (params.official !== undefined) formData.append('official', params.official.toString());
    if (params.vital_record !== undefined) formData.append('vital_record', params.vital_record.toString());
    if (params.essential !== undefined) formData.append('essential', params.essential.toString());
    if (params.accession_code) formData.append('accession_code', params.accession_code);
    if (params.alt_retention) formData.append('alt_retention', params.alt_retention);
    if (params.comments) formData.append('comments', params.comments);

    await this.request<any>('PUT', `/v1/nodes/${params.node_id}/rmclassifications`, undefined, formData);
    return { success: true };
  }

  /**
   * Make record confidential
   */
  async makeRMConfidential(nodeId: number): Promise<{ success: boolean }> {
    await this.request<any>('PUT', `/v1/nodes/${nodeId}/rmclassifications/makeConfidential`);
    return { success: true };
  }

  /**
   * Remove confidential marking from record
   */
  async removeRMConfidential(nodeId: number): Promise<{ success: boolean }> {
    await this.request<any>('PUT', `/v1/nodes/${nodeId}/rmclassifications/removeConfidential`);
    return { success: true };
  }

  /**
   * Finalize records
   */
  async finalizeRMRecords(nodeIds: number[]): Promise<{ success: boolean; finalized_count: number }> {
    const formData = new URLSearchParams();
    formData.append('ids', nodeIds.join(','));

    await this.request<any>('PUT', `/v1/rmclassifications/finalizerecords`, undefined, formData);
    return { success: true, finalized_count: nodeIds.length };
  }

  private parseRMClassification(data: any): RMClassification {
    return {
      // The API returns rmclassification_id as the primary identifier
      id: data.rmclassification_id || data.id || data.class_id || 0,
      name: data.name || data.classification_name || '',
      class_id: data.rmclassification_id || data.class_id,
      classification_id: data.rmclassification_id || data.classification_id,
      classification_name: data.classification_name,
      official: data.official,
      vital_record: data.vital_record,
      confidential: data.confidential,
      finalized: data.finalized,
      essential: data.essential,
      rsi_id: data.rsi_id,
      rsi_name: data.rsi_name,
      status: data.file_status || data.status,
      create_date: data.record_date || data.create_date,
      modify_date: data.status_date || data.modify_date,
    };
  }

  // ============ Records Management: Holds ============

  /**
   * List all holds
   */
  async listRMHolds(): Promise<RMHoldsResponse> {
    const response = await this.request<any>('GET', `/v1/holds`);

    const holds: RMHold[] = [];
    const data = response.data || response.results || response;

    if (Array.isArray(data)) {
      for (const item of data) {
        holds.push(this.parseRMHold(item));
      }
    } else if (data && data.holds) {
      for (const item of data.holds) {
        holds.push(this.parseRMHold(item));
      }
    }

    return {
      holds,
      total_count: holds.length,
    };
  }

  /**
   * Get hold details
   */
  async getRMHold(holdId: number): Promise<RMHold> {
    const response = await this.request<any>('GET', `/v2/hold?id=${holdId}`);
    // Response structure: { results: { data: { hold: { HoldID, HoldName, ... } } } }
    const data = response.results?.data?.hold || response.data?.hold || response.data || response;
    return this.parseRMHold(data);
  }

  /**
   * Create a new hold
   * API uses form data with lowercase field names, type value should be uppercase (LEGAL, AUDIT, etc.)
   */
  async createRMHold(params: RMHoldParams): Promise<RMHold> {
    const formData = new URLSearchParams();
    formData.append('name', params.name);
    formData.append('type', (params.type || 'LEGAL').toUpperCase());
    formData.append('date_applied', params.date_applied || new Date().toISOString().split('T')[0]);
    if (params.comment) formData.append('comment', params.comment);
    if (params.parent_id) formData.append('parent_id', params.parent_id.toString());
    if (params.alternate_hold_id) formData.append('alternate_id', params.alternate_hold_id);

    const response = await this.request<any>('POST', `/v1/holds`, undefined, formData);
    // Response returns { holdID: number }
    const holdId = response.holdID || response.hold_id || response.id;
    // Fetch the created hold to return full details
    return this.getRMHold(holdId);
  }

  /**
   * Update a hold
   * API uses form data with lowercase field names
   */
  async updateRMHold(holdId: number, params: Partial<RMHoldParams>): Promise<RMHold> {
    const formData = new URLSearchParams();
    formData.append('id', holdId.toString());
    if (params.name) formData.append('name', params.name);
    if (params.type) formData.append('type', params.type.toUpperCase());
    if (params.comment) formData.append('comment', params.comment);
    if (params.alternate_hold_id) formData.append('alternate_id', params.alternate_hold_id);

    const response = await this.request<any>('PUT', `/v1/holds`, undefined, formData);
    // Fetch updated hold to return full details
    return this.getRMHold(holdId);
  }

  /**
   * Delete a hold
   * API uses DELETE /v2/hold with query param id or holdname
   */
  async deleteRMHold(holdId: number): Promise<{ success: boolean }> {
    await this.request<any>('DELETE', `/v2/hold?id=${holdId}`);
    return { success: true };
  }

  /**
   * Get holds on a node
   */
  async getNodeRMHolds(nodeId: number): Promise<RMNodeHoldsResponse> {
    const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/holds`);

    const holds: RMHold[] = [];
    const data = response.data || response.results || response;

    if (Array.isArray(data)) {
      for (const item of data) {
        holds.push(this.parseRMHold(item));
      }
    } else if (data && data.holds) {
      for (const item of data.holds) {
        holds.push(this.parseRMHold(item));
      }
    }

    return {
      node_id: nodeId,
      holds,
    };
  }

  /**
   * Apply hold to a node
   */
  async applyRMHold(nodeId: number, holdId: number): Promise<{ success: boolean }> {
    const formData = new URLSearchParams();
    formData.append('hold_id', holdId.toString());

    await this.request<any>('POST', `/v1/nodes/${nodeId}/holds`, undefined, formData);
    return { success: true };
  }

  /**
   * Remove hold from a node
   */
  async removeRMHold(nodeId: number, holdId: number): Promise<{ success: boolean }> {
    await this.request<any>('DELETE', `/v1/nodes/${nodeId}/holds/${holdId}`);
    return { success: true };
  }

  /**
   * Apply hold to multiple nodes
   */
  async applyRMHoldBatch(nodeIds: number[], holdId: number): Promise<{ success: boolean; count: number }> {
    const formData = new URLSearchParams();
    formData.append('holdID', holdId.toString());
    // API expects array format - send each id as separate parameter
    for (const id of nodeIds) {
      formData.append('ids', id.toString());
    }

    await this.request<any>('POST', `/v1/rmclassifications/applyhold`, undefined, formData);
    return { success: true, count: nodeIds.length };
  }

  /**
   * Remove hold from multiple nodes
   */
  async removeRMHoldBatch(nodeIds: number[], holdId: number): Promise<{ success: boolean; count: number }> {
    const formData = new URLSearchParams();
    formData.append('holdID', holdId.toString());
    // API expects array format - send each id as separate parameter
    for (const id of nodeIds) {
      formData.append('ids', id.toString());
    }

    await this.request<any>('POST', `/v1/rmclassifications/removehold`, undefined, formData);
    return { success: true, count: nodeIds.length };
  }

  /**
   * Get items under a hold
   * Note: The /v2/holditems endpoint only returns items directly managed via hold item management,
   * not items with holds applied via /v1/nodes/{id}/holds. This method tries the v2 endpoint first,
   * then falls back to search if available.
   */
  async getRMHoldItems(holdId: number, options?: { page?: number; limit?: number }): Promise<RMHoldItemsResponse> {
    let path = `/v2/holditems/${holdId}`;
    if (options?.page && options.page > 1) {
      path = `/v2/holditems/${holdId}/page?page=${options.page}`;
      if (options.limit) path += `&limit=${options.limit}`;
    } else if (options?.limit) {
      path += `?limit=${options.limit}`;
    }

    const response = await this.request<any>('GET', path);

    // Parse response - API returns { collection: {...}, results: [...] }
    const items: Array<{ id: number; name: string; type: number; type_name: string }> = [];

    // Try multiple response formats
    let itemsArray: any[] = [];
    if (response.results && Array.isArray(response.results)) {
      itemsArray = response.results;
    } else if (response.data && Array.isArray(response.data)) {
      itemsArray = response.data;
    } else if (Array.isArray(response)) {
      itemsArray = response;
    } else if (response.data?.items) {
      itemsArray = response.data.items;
    } else if (response.items) {
      itemsArray = response.items;
    }

    for (const item of itemsArray) {
      if (item && item.id) {
        items.push({
          id: item.id,
          name: item.name || '',
          type: item.type || 0,
          type_name: item.type_name || '',
        });
      }
    }

    return {
      hold_id: holdId,
      items,
      total_count: response.collection?.paging?.total_count || items.length,
      page: options?.page || 1,
      limit: options?.limit,
    };
  }

  /**
   * Get users assigned to a hold
   */
  async getRMHoldUsers(holdId: number): Promise<RMHoldUsersResponse> {
    const response = await this.request<any>('GET', `/v2/userholds/getusers/${holdId}`);
    const data = response.data || response.results || response;

    const users: Array<{ id: number; name: string; display_name?: string }> = [];
    const usersArray = Array.isArray(data) ? data : (data.users || []);

    for (const user of usersArray) {
      users.push({
        id: user.id,
        name: user.name,
        display_name: user.display_name,
      });
    }

    return {
      hold_id: holdId,
      users,
    };
  }

  /**
   * Add users to a hold
   */
  async addRMHoldUsers(holdId: number, userIds: number[]): Promise<{ success: boolean }> {
    const body = {
      hold_id: holdId,
      user_ids: userIds,
    };

    await this.request<any>('POST', `/v2/userholds/addusers`, body);
    return { success: true };
  }

  /**
   * Remove users from a hold
   */
  async removeRMHoldUsers(holdId: number, userIds: number[]): Promise<{ success: boolean }> {
    const body = {
      hold_id: holdId,
      user_ids: userIds,
    };

    await this.request<any>('POST', `/v2/userholds/removeusers`, body);
    return { success: true };
  }

  private parseRMHold(data: any): RMHold {
    return {
      // ID field: HoldID (from v2/hold), id (from v1/holds list), hold_id (from node holds)
      id: data.HoldID || data.hold_id || data.id || 0,
      // Name field: HoldName (from v2/hold), hold_name (from node holds), name (fallback)
      name: data.HoldName || data.hold_name || data.name || '',
      comment: data.HoldComment || data.hold_comment || data.comment,
      type: data.HoldType || data.hold_type || data.type,
      type_name: data.HoldType || data.hold_type || data.type_name,
      parent_id: data.ParentID || data.parent_id,
      create_date: data.DateApplied || data.date_applied || data.create_date,
      modify_date: data.EditDate || data.modify_date,
      create_user_id: data.ApplyPatron || data.applied_by || data.create_user_id,
      items_count: data.items_count,
      alternate_hold_id: data.AlternateHoldID || data.alternate_hold_id,
    };
  }

  // ============ Records Management: Cross-References ============

  /**
   * List all cross-reference types
   */
  async listRMCrossRefTypes(): Promise<RMCrossRefTypesResponse> {
    const response = await this.request<any>('GET', `/v1/xrefs`);

    const types: RMCrossRefType[] = [];
    const data = response.data || response.results || response;

    if (Array.isArray(data)) {
      for (const item of data) {
        types.push({
          name: item.name || item.xref_type,
          description: item.description,
          in_use: item.in_use,
        });
      }
    } else if (data && data.xrefs) {
      for (const item of data.xrefs) {
        types.push({
          name: item.name || item.xref_type,
          description: item.description,
          in_use: item.in_use,
        });
      }
    }

    return { types };
  }

  /**
   * Get cross-reference type details
   */
  async getRMCrossRefType(xrefType: string): Promise<RMCrossRefType> {
    const response = await this.request<any>('GET', `/v1/xrefs/${encodeURIComponent(xrefType)}`);
    const data = response.data || response.results || response;

    return {
      name: data.name || data.xref_type || xrefType,
      description: data.description,
      in_use: data.in_use,
    };
  }

  /**
   * Create a new cross-reference type
   */
  async createRMCrossRefType(name: string, description?: string): Promise<RMCrossRefType> {
    const formData = new URLSearchParams();
    formData.append('name', name);
    if (description) formData.append('description', description);

    const response = await this.request<any>('POST', `/v1/xrefs`, undefined, formData);
    const data = response.data || response.results || response;

    return {
      name: data.name || name,
      description: data.description || description,
      in_use: false,
    };
  }

  /**
   * Delete a cross-reference type (only if not in use)
   */
  async deleteRMCrossRefType(xrefType: string): Promise<{ success: boolean }> {
    await this.request<any>('DELETE', `/v1/xrefs/${encodeURIComponent(xrefType)}`);
    return { success: true };
  }

  /**
   * Get cross-references on a node
   */
  async getNodeRMCrossRefs(nodeId: number): Promise<RMNodeCrossRefsResponse> {
    const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/xrefs`);

    const crossRefs: RMCrossRef[] = [];
    const data = response.data || response.results || response;

    if (Array.isArray(data)) {
      for (const item of data) {
        crossRefs.push(this.parseRMCrossRef(item));
      }
    } else if (data && data.xrefs) {
      for (const item of data.xrefs) {
        crossRefs.push(this.parseRMCrossRef(item));
      }
    }

    return {
      node_id: nodeId,
      cross_references: crossRefs,
    };
  }

  /**
   * Apply cross-reference to a node
   */
  async applyRMCrossRef(params: RMCrossRefApplyParams): Promise<{ success: boolean }> {
    // Use form data with correct parameter names
    const formData = new URLSearchParams();
    formData.append('xref_type', params.xref_type);
    formData.append('xref_id', params.ref_node_id.toString());
    formData.append('comment', params.comment || '');

    await this.request<any>('POST', `/v1/nodes/${params.node_id}/xrefs`, undefined, formData);
    return { success: true };
  }

  /**
   * Remove cross-reference from a node
   */
  async removeRMCrossRef(nodeId: number, xrefType: string, refNodeId: number): Promise<{ success: boolean }> {
    await this.request<any>('DELETE', `/v1/nodes/${nodeId}/xrefs/${encodeURIComponent(xrefType)}/refnodes/${refNodeId}`);
    return { success: true };
  }

  /**
   * Apply cross-reference to multiple nodes
   */
  async applyRMCrossRefBatch(nodeIds: number[], xrefType: string, refNodeId: number): Promise<{ success: boolean; count: number }> {
    const formData = new URLSearchParams();
    formData.append('xref_type', xrefType);
    formData.append('ref_node_id', refNodeId.toString());
    formData.append('ids', nodeIds.join(','));

    await this.request<any>('POST', `/v1/rmclassifications/assignxref`, undefined, formData);
    return { success: true, count: nodeIds.length };
  }

  /**
   * Remove cross-reference from multiple nodes
   */
  async removeRMCrossRefBatch(nodeIds: number[], xrefType: string, refNodeId: number): Promise<{ success: boolean; count: number }> {
    const formData = new URLSearchParams();
    formData.append('xref_type', xrefType);
    formData.append('ref_node_id', refNodeId.toString());
    formData.append('ids', nodeIds.join(','));

    await this.request<any>('POST', `/v1/rmclassifications/removexref`, undefined, formData);
    return { success: true, count: nodeIds.length };
  }

  private parseRMCrossRef(data: any): RMCrossRef {
    return {
      xref_type: data.xref_type || data.type,
      xref_type_name: data.xref_type_name || data.type_name,
      ref_node_id: data.ref_node_id || data.node_id,
      ref_node_name: data.ref_node_name || data.name,
      ref_node_type: data.ref_node_type,
      ref_node_type_name: data.ref_node_type_name,
    };
  }

  // ============ Records Management: RSI (Record Series Identifiers) ============

  /**
   * Get available RM codes by type
   * Valid types: file_status, storage, accession, essential, hold_type, xref_type, rsi_status, stage, rule_code
   */
  async getRMCodes(codeType: string): Promise<Array<{ code: string; description: string }>> {
    const response = await this.request<any>('GET', `/v2/recordsmanagement/rmcodes`);
    const data = response.results || response.data || response;

    // Find the requested code type
    const codes: Array<{ code: string; description: string }> = [];
    const codesData = data[codeType] || data.codes?.[codeType] || [];

    if (Array.isArray(codesData)) {
      for (const item of codesData) {
        codes.push({
          code: item.code || item.Code || item,
          description: item.desc || item.description || item.Description || '',
        });
      }
    }

    return codes;
  }

  /**
   * List all RSIs with their schedules
   */
  async listRMRSIs(options?: { page?: number; limit?: number }): Promise<RMRSIListResponse> {
    let path = '/v2/rsis';
    const params: string[] = [];
    if (options?.page) params.push(`page=${options.page}`);
    if (options?.limit) params.push(`limit=${options.limit}`);
    if (params.length > 0) path += '?' + params.join('&');

    const response = await this.request<any>('GET', path);
    // API returns { results: { data: { rsis: [...] } } }
    const rsisArray = response.results?.data?.rsis || response.data?.rsis || response.rsis || [];

    const rsis: RMRSI[] = [];
    for (const item of rsisArray) {
      rsis.push(this.parseRMRSI(item));
    }

    return {
      rsis,
      total_count: response.collection?.paging?.total_count || rsis.length,
      page: options?.page || 1,
      limit: options?.limit,
    };
  }

  /**
   * Get RSI details with schedules
   */
  async getRMRSI(rsiId: number): Promise<RMRSI> {
    const response = await this.request<any>('GET', `/v2/rsis/${rsiId}`);
    // API returns { results: { data: { rsi: [...] } } } - array with single item
    const rsiArray = response.results?.data?.rsi || response.data?.rsi || [];
    if (rsiArray.length > 0) {
      return this.parseRMRSI(rsiArray[0]);
    }
    // Fallback to direct parsing
    const data = response.results?.data || response.data || response;
    return this.parseRMRSI(data);
  }

  /**
   * Create a new RSI
   */
  async createRMRSI(params: RMRSICreateParams): Promise<RMRSI> {
    const formData = new URLSearchParams();
    formData.append('name', params.name);
    formData.append('status', params.status);
    if (params.status_date) formData.append('statusDate', params.status_date);
    if (params.description) formData.append('description', params.description);
    if (params.subject) formData.append('subject', params.subject);
    if (params.title) formData.append('title', params.title);
    if (params.disp_control !== undefined) formData.append('dispcontrol', params.disp_control.toString());
    if (params.source_app) formData.append('sourceApp', params.source_app);
    if (params.editing_app) formData.append('editingApp', params.editing_app);

    const response = await this.request<any>('POST', '/v2/rsischedules', undefined, formData);
    // Response may contain RSI ID or RSI object
    const rsiId = response.id || response.rsi_id || response.results?.id;
    if (rsiId) {
      return this.getRMRSI(rsiId);
    }
    // Try to find and return the RSI
    return this.parseRMRSI(response.results || response.data || response);
  }

  /**
   * Update RSI metadata
   */
  async updateRMRSI(rsiId: number, params: RMRSIUpdateParams): Promise<RMRSI> {
    const formData = new URLSearchParams();
    if (params.new_name) formData.append('newName', params.new_name);
    if (params.status) formData.append('status', params.status);
    if (params.status_date) formData.append('statusDate', params.status_date);
    if (params.description) formData.append('description', params.description);
    if (params.subject) formData.append('subject', params.subject);
    if (params.title) formData.append('title', params.title);
    if (params.discontinue !== undefined) formData.append('discontinue', params.discontinue.toString());
    if (params.discontinue_date) formData.append('discontinueDate', params.discontinue_date);
    if (params.discontinue_comment) formData.append('discontinueComment', params.discontinue_comment);
    if (params.disp_control !== undefined) formData.append('dispcontrol', params.disp_control.toString());
    if (params.editing_app) formData.append('editingApp', params.editing_app);

    await this.request<any>('PUT', `/v2/rsischedules/${rsiId}`, undefined, formData);
    return this.getRMRSI(rsiId);
  }

  /**
   * Delete an RSI
   */
  async deleteRMRSI(rsiId: number): Promise<{ success: boolean }> {
    await this.request<any>('DELETE', `/v2/rsischedules/${rsiId}`);
    return { success: true };
  }

  /**
   * Get RSIs assigned to a node
   */
  async getNodeRMRSIs(nodeId: number): Promise<RMNodeRSIsResponse> {
    const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/rsis`);
    const data = response.data || response.results || response;

    const rsis: Array<{ rsi_id: number; rsi_name: string; class_id?: number; class_name?: string }> = [];
    const rsisArray = Array.isArray(data) ? data : (data.rsis || []);

    for (const item of rsisArray) {
      rsis.push({
        rsi_id: item.rsi_id || item.RSID || item.id,
        rsi_name: item.rsi_name || item.RSIName || item.name,
        class_id: item.class_id || item.ClassID,
        class_name: item.class_name || item.ClassName,
      });
    }

    return {
      node_id: nodeId,
      rsis,
    };
  }

  /**
   * Assign RSI to a classified node
   */
  async assignRMRSI(params: RMRSIAssignParams): Promise<{ success: boolean }> {
    const formData = new URLSearchParams();
    formData.append('rsi', params.rsi_id.toString());
    if (params.status_date) formData.append('status_date', params.status_date);

    await this.request<any>('POST', `/v1/nodes/${params.node_id}/rmclassifications/${params.class_id}/rsis`, undefined, formData);
    return { success: true };
  }

  /**
   * Remove RSI from a classified node
   */
  async removeRMRSI(nodeId: number, classId: number): Promise<{ success: boolean }> {
    await this.request<any>('DELETE', `/v1/nodes/${nodeId}/rmclassifications/${classId}/rsis`);
    return { success: true };
  }

  /**
   * Get items assigned to an RSI
   */
  async getRMRSIItems(rsiId: number, options?: { page?: number; limit?: number; sort?: string }): Promise<RMRSIItemsResponse> {
    let path = `/v2/rsiitems/${rsiId}`;
    const params: string[] = [];
    if (options?.limit) params.push(`limit=${options.limit}`);
    if (options?.sort) params.push(`sort=${options.sort}`);
    if (params.length > 0) path += '?' + params.join('&');

    // Use /page endpoint for pagination
    if (options?.page && options.page > 1) {
      path = `/v2/rsiitems/${rsiId}/page?page=${options.page}`;
      if (options.limit) path += `&limit=${options.limit}`;
      if (options.sort) path += `&sort=${options.sort}`;
    }

    const response = await this.request<any>('GET', path);
    const data = response.data || response.results || response;

    const items: Array<{ id: number; name: string; type: number; type_name: string }> = [];
    const itemsArray = Array.isArray(data) ? data : (data.items || []);

    for (const item of itemsArray) {
      items.push({
        id: item.id,
        name: item.name,
        type: item.type,
        type_name: item.type_name,
      });
    }

    return {
      rsi_id: rsiId,
      items,
      total_count: response.collection?.paging?.total_count || items.length,
      page: options?.page || 1,
      limit: options?.limit,
    };
  }

  /**
   * Create an RSI schedule stage
   */
  async createRMRSISchedule(params: RMRSIScheduleCreateParams): Promise<RMRSISchedule> {
    const formData = new URLSearchParams();
    formData.append('stage', params.stage);
    formData.append('objectType', params.object_type);
    formData.append('eventType', params.event_type.toString());

    if (params.date_to_use !== undefined) formData.append('dateToUse', params.date_to_use.toString());
    if (params.retention_years !== undefined) formData.append('retentionYears', params.retention_years.toString());
    if (params.retention_months !== undefined) formData.append('retentionMonths', params.retention_months.toString());
    if (params.retention_days !== undefined) formData.append('retentionDays', params.retention_days.toString());
    if (params.action_code !== undefined) formData.append('actionCode', params.action_code.toString());
    if (params.disposition) formData.append('disposition', params.disposition);
    if (params.description) formData.append('description', params.description);
    if (params.new_status) formData.append('newStatus', params.new_status);
    if (params.rule_code) formData.append('ruleCode', params.rule_code);
    if (params.rule_comment) formData.append('ruleComment', params.rule_comment);
    if (params.fixed_date) formData.append('fixedDate', params.fixed_date);
    if (params.event_condition) formData.append('eventCondition', params.event_condition);
    if (params.year_end_month !== undefined) formData.append('yearEndMonth', params.year_end_month.toString());
    if (params.year_end_day !== undefined) formData.append('yearEndDay', params.year_end_day.toString());
    if (params.category_id !== undefined) formData.append('categoryId', params.category_id.toString());
    if (params.category_attribute_id !== undefined) formData.append('categoryAttributeId', params.category_attribute_id.toString());
    if (params.fixed_retention !== undefined) formData.append('fixedRetention', params.fixed_retention.toString());
    if (params.maximum_retention !== undefined) formData.append('maximumRetention', params.maximum_retention.toString());
    if (params.retention_intervals !== undefined) formData.append('retentionIntervals', params.retention_intervals.toString());
    if (params.min_num_versions_to_keep !== undefined) formData.append('minNumVersionsToKeep', params.min_num_versions_to_keep.toString());
    if (params.purge_superseded !== undefined) formData.append('purgeSuperseded', params.purge_superseded.toString());
    if (params.purge_majors !== undefined) formData.append('purgeMajors', params.purge_majors.toString());
    if (params.mark_official_rendition !== undefined) formData.append('markOfficialRendition', params.mark_official_rendition.toString());

    const response = await this.request<any>('POST', `/v2/rsischedules/${params.rsi_id}/stages`, undefined, formData);
    return this.parseRMRSISchedule(response.results || response.data || response);
  }

  /**
   * Get RSI schedule stages
   */
  async getRMRSISchedules(rsiId: number): Promise<RMRSISchedule[]> {
    // Use /v2/rsischedule/{id} which returns the schedule maintenance view
    const response = await this.request<any>('GET', `/v2/rsischedule/${rsiId}`);
    const data = response.results?.data || response.data || [];

    const schedules: RMRSISchedule[] = [];
    const schedulesArray = Array.isArray(data) ? data : [];

    for (const item of schedulesArray) {
      // Parse from maintenance view format
      const props = item.data?.properties || item.properties || item;
      schedules.push({
        id: props.id,
        rsi_id: rsiId,
        stage: props.name || props.stage,
        object_type: props.object_type === 'Classified Objects' ? 'LIV' : 'LRM',
        event_type: props.rule_type || props.event_type,
        date_to_use: props.date_to_use,
        retention_years: props.retyears,
        retention_months: props.retmonths,
        retention_days: props.retdays,
        action_code: props.action_code ? parseInt(props.action_code) : undefined,
        disposition: props.disposition,
        description: props.actiondesc_e,
        rule_code: props.rsirulecode,
        event_condition: props.eventrule,
        year_end_month: props.yearendmonth,
        year_end_day: props.yearendday,
        approved: props.approval_flag === true || props.approval_flag === 1,
      });
    }

    return schedules;
  }

  /**
   * Approve an RSI schedule stage
   */
  async approveRMRSISchedule(rsiId: number, stageId: number, comment?: string): Promise<{ success: boolean }> {
    const formData = new URLSearchParams();
    if (comment) formData.append('comment', comment);

    await this.request<any>('PUT', `/v2/rsischedules/${rsiId}/approve/${stageId}`, undefined, formData);
    return { success: true };
  }

  /**
   * Get RSI schedule approval history
   */
  async getRMRSIApprovalHistory(rsiId: number): Promise<Array<{ stage_id: number; approved_by: number; approved_date: string; comment?: string }>> {
    const response = await this.request<any>('GET', `/v2/rsischedules/${rsiId}/approvalhistory`);
    const data = response.results || response.data || response;

    const history: Array<{ stage_id: number; approved_by: number; approved_date: string; comment?: string }> = [];
    const historyArray = Array.isArray(data) ? data : (data.history || []);

    for (const item of historyArray) {
      history.push({
        stage_id: item.stage_id || item.StageID,
        approved_by: item.approved_by || item.ApprovedBy,
        approved_date: item.approved_date || item.ApprovedDate,
        comment: item.comment || item.Comment,
      });
    }

    return history;
  }

  private parseRMRSI(data: any): RMRSI {
    const rsi: RMRSI = {
      // Handle both snake_case and PascalCase from API
      id: data.id || data.RSIID || data.rsi_id,
      name: data.name || data.RSI || data.Name || data.RSIName,
      status: data.status || data.RSIStatus || data.rsistatus || data.Status,
      status_date: data.status_date || data.StatusDate || data.statusDate || data.statusdate,
      description: data.description || data.Description,
      subject: data.subject || data.Subject,
      title: data.title || data.Title,
      disp_control: data.disp_control ?? data.DispControl ?? data.dispcontrol ?? data.disp_control,
      discontinued: data.discontinued ?? data.DiscontFlag ?? data.discont_flag,
      discontinue_date: data.discontinue_date || data.DiscontDate || data.DiscontinueDate || data.discontinueDate,
      discontinue_comment: data.discontinue_comment || data.DiscontComment || data.DiscontinueComment || data.discontinueComment,
      source_app: data.source_app || data.sourceApp || data.SourceApp,
      editing_app: data.editing_app || data.editingApp || data.EditingApp,
    };

    // Parse schedules if present (for single RSI response that includes schedule data)
    if (data.RSIScheduleID || data.RetStage) {
      // API embeds schedule info in RSI record
      rsi.schedules = [{
        id: data.RSIScheduleID,
        rsi_id: rsi.id,
        stage: data.RetStage,
        object_type: data.ObjectType === 1 ? 'LIV' : 'LRM',
        event_type: data.EventType,
        date_to_use: data.DateToUse,
        retention_years: data.RetYears,
        retention_months: data.RetMonths,
        retention_days: data.RetDays,
        action_code: data.ActionCode,
        disposition: data.Disposition,
        description: data.ActionDescription,
        rule_code: data.RSIRuleCode,
        event_condition: data.EventRule,
        year_end_month: data.YearEndMonth,
        year_end_day: data.YearEndDay,
        approved: data.ApprovalFlag === 1,
      }];
    } else if (data.schedules || data.Schedules) {
      const schedulesArray = data.schedules || data.Schedules;
      rsi.schedules = [];
      if (Array.isArray(schedulesArray)) {
        for (const sched of schedulesArray) {
          rsi.schedules.push(this.parseRMRSISchedule(sched, rsi.id));
        }
      }
    }

    return rsi;
  }

  private parseRMRSISchedule(data: any, rsiId?: number): RMRSISchedule {
    return {
      id: data.id || data.ID || data.ScheduleID || data.stage_id,
      rsi_id: data.rsi_id || data.RSID || rsiId || 0,
      stage: data.stage || data.Stage,
      object_type: data.object_type || data.objectType || data.ObjectType,
      event_type: data.event_type ?? data.eventType ?? data.EventType,
      date_to_use: data.date_to_use ?? data.dateToUse ?? data.DateToUse,
      retention_years: data.retention_years ?? data.retentionYears ?? data.RetentionYears,
      retention_months: data.retention_months ?? data.retentionMonths ?? data.RetentionMonths,
      retention_days: data.retention_days ?? data.retentionDays ?? data.RetentionDays,
      action_code: data.action_code ?? data.actionCode ?? data.ActionCode,
      disposition: data.disposition || data.Disposition,
      description: data.description || data.Description,
      new_status: data.new_status || data.newStatus || data.NewStatus,
      rule_code: data.rule_code || data.ruleCode || data.RuleCode,
      rule_comment: data.rule_comment || data.ruleComment || data.RuleComment,
      fixed_date: data.fixed_date || data.fixedDate || data.FixedDate,
      event_condition: data.event_condition || data.eventCondition || data.EventCondition,
      year_end_month: data.year_end_month ?? data.yearEndMonth ?? data.YearEndMonth,
      year_end_day: data.year_end_day ?? data.yearEndDay ?? data.YearEndDay,
      approved: data.approved ?? data.Approved,
      approval_date: data.approval_date || data.approvalDate || data.ApprovalDate,
      approved_by: data.approved_by || data.approvedBy || data.ApprovedBy,
    };
  }

  // ============ Sharing ============

  /**
   * Share Content Server items with a share provider (e.g., CORE for Core Share)
   * @param params Share parameters including node IDs, invitees, and options
   * @returns Share result with success status and any messages
   */
  async createShare(params: ShareCreateParams): Promise<ShareInfo> {
    // The web UI uses multipart/form-data for the shares endpoint
    const formData = new FormData();

    // Add node IDs - lowercase 'ids', JSON array
    formData.append('ids', JSON.stringify(params.node_ids));

    // Share provider (CORE for Core Share)
    formData.append('shareProvider', params.share_provider || 'CORE');

    // Share options as stringified JSON
    const shareOptions: Record<string, unknown> = {};
    if (params.expire_date) {
      shareOptions.expire_date = params.expire_date;
    }
    if (params.share_initiator_role) {
      shareOptions.shareInitiatorRole = params.share_initiator_role;
    }
    // Always include shareOptions even if minimal
    formData.append('shareOptions', JSON.stringify(shareOptions));

    // Provider-specific params (invitees, message) as stringified JSON
    const providerParams: Record<string, unknown> = {};
    if (params.invitees && params.invitees.length > 0) {
      providerParams.invitees = params.invitees.map(invitee => ({
        id: invitee.id || invitee.business_email,
        business_email: invitee.business_email,
        name: invitee.name || invitee.business_email.split('@')[0],
        perm: String(invitee.perm),  // Must be string, not number
        identityType: invitee.identityType || 1,
        providerId: invitee.providerId || '',  // Include providerId if available
      }));
    }
    if (params.sharing_message) {
      providerParams.sharing_message = params.sharing_message;
    }
    formData.append('providerParams', JSON.stringify(providerParams));

    // Coordinators - include current user if not specified
    const coordinators = params.coordinators && params.coordinators.length > 0
      ? params.coordinators
      : [];
    if (coordinators.length > 0) {
      formData.append('coordinators', JSON.stringify(coordinators));
    }

    const response = await this.request<any>('POST', '/v2/shares', undefined, formData);

    const result = response.results?.data || response.data || response;
    const isPartial = result.partial === true;
    const message = result.msg || (isPartial ? 'Share operation completed with partial success' : 'Share created successfully');

    return {
      node_ids: params.node_ids,
      success: !isPartial,  // Only true success if not partial
      partial: isPartial,
      message: message,
    };
  }

  /**
   * Stop sharing an item (remove from share provider)
   * @param nodeId The node ID to stop sharing
   * @returns Operation result
   */
  async stopShare(nodeId: number): Promise<ShareOperationResponse> {
    await this.request<any>('DELETE', `/v2/shares/${nodeId}`);
    return {
      success: true,
      message: `Sharing stopped for node ${nodeId}`,
    };
  }

  /**
   * Stop sharing multiple items in batch
   * @param nodeIds Array of node IDs to stop sharing
   * @returns Operation result with count
   */
  async stopShareBatch(nodeIds: number[]): Promise<{ success: boolean; count: number; failed: number[] }> {
    const failed: number[] = [];
    let successCount = 0;

    // Process in parallel batches
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
        })
      );
      successCount += batchResults.filter(r => r.success).length;
    }

    return {
      success: failed.length === 0,
      count: successCount,
      failed,
    };
  }

  /**
   * List all shares for the current user
   * @returns List of shared items
   */
  async listShares(): Promise<ShareListResponse> {
    const response = await this.request<any>('GET', '/v2/shares');

    // Parse the response - the format varies by CS version
    const data = response.results?.data || response.data || response.results || response;

    // Handle array of shared items
    const items = Array.isArray(data) ? data : (data.shares || data.items || []);

    const shares: SharedItem[] = items.map((item: any) => {
      // Extract node info - it may be nested under different keys
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
          permission: typeof inv.perm === 'string' ? parseInt(inv.perm) : (inv.perm || inv.permission),
          permission_name: inv.perm_name || inv.permission_name || this.getPermissionName(inv.perm || inv.permission),
        })),
      };
    });

    return {
      shares,
      total_count: shares.length,
    };
  }

  /**
   * Helper to get permission name from permission level
   */
  private getPermissionName(perm: number | string): string {
    const permNum = typeof perm === 'string' ? parseInt(perm) : perm;
    switch (permNum) {
      case 1: return 'Viewer';
      case 2: return 'Collaborator';
      case 3: return 'Manager';
      case 4: return 'Owner';
      default: return 'Unknown';
    }
  }
}
