import { Agent, type Dispatcher } from 'undici';
import {
  type OTCSConfig,
  type OTCSNode,
  type OTCSNodeResponse,
  type NodeInfo,
  type WorkspaceInfo,
  NodeTypes,
} from '../types';

export { NodeTypes };

export class OTCSClient {
  public baseUrl: string;
  public ticket: string | null = null;
  public config: OTCSConfig;
  /** Per-client undici dispatcher that skips TLS verification when configured. */
  private dispatcher: Dispatcher | undefined;

  constructor(config: OTCSConfig) {
    // Normalize base URL - remove trailing slash and ensure /api path
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    if (!this.baseUrl.includes('/api')) {
      this.baseUrl = this.baseUrl + '/api';
    }
    this.config = config;

    if (config.tlsSkipVerify) {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
      console.warn(
        '[OTCSClient] WARNING: TLS certificate verification is disabled for OTCS connections to',
        this.baseUrl,
      );
    }
  }

  /**
   * Returns extra fetch options (e.g. `{ dispatcher }`) for per-request TLS
   * bypass. Spread this into every `fetch()` call made by the client.
   */
  public fetchOptions(): Record<string, unknown> {
    return this.dispatcher ? { dispatcher: this.dispatcher } : {};
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

  public getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.ticket) {
      headers['OTCSTicket'] = this.ticket;
    }
    return headers;
  }

  public async request<T>(
    method: string,
    path: string,
    body?: unknown,
    formData?: FormData | URLSearchParams,
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

    const response = await fetch(url, { ...options, ...this.fetchOptions() });

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

  public extractNodeProperties(response: OTCSNodeResponse): OTCSNode {
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

  public transformNode(props: OTCSNode): NodeInfo {
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
      container:
        props.container || props.type === NodeTypes.FOLDER || props.type === NodeTypes.PROJECT,
      container_size: props.container_size,
      permissions: {
        can_see: props.permissions?.perm_see ?? true,
        can_modify: props.permissions?.perm_modify ?? false,
        can_delete: props.permissions?.perm_delete ?? false,
        can_add_items: props.permissions?.perm_create ?? false,
      },
    };
  }

  public transformWorkspace(props: any): WorkspaceInfo {
    const baseNode = this.transformNode(props as OTCSNode);
    return {
      ...baseNode,
      workspace_type_id: props.wksp_type_id || props.workspace_type_id || 0,
      workspace_type_name: props.wksp_type_name || props.workspace_type_name || props.type_name,
      business_properties: props.business_properties || props.categories,
    };
  }
}
