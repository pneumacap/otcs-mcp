import type { OTCSCreateNodeResponse, OTCSVersion } from '../types';
import { OTCSClient, NodeTypes } from './base';

declare module './base.js' {
  interface OTCSClient {
    uploadDocument(
      parentId: number,
      name: string,
      fileContent: Buffer | Blob,
      mimeType: string,
      description?: string,
    ): Promise<OTCSCreateNodeResponse>;
    getContent(
      nodeId: number,
    ): Promise<{ content: ArrayBuffer; mimeType: string; fileName: string }>;
    getVersions(nodeId: number): Promise<OTCSVersion[]>;
    addVersion(
      nodeId: number,
      fileContent: Buffer | Blob,
      mimeType: string,
      fileName: string,
      description?: string,
    ): Promise<OTCSVersion>;
  }
}

OTCSClient.prototype.uploadDocument = async function (
  this: OTCSClient,
  parentId: number,
  name: string,
  fileContent: Buffer | Blob,
  mimeType: string,
  description?: string,
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
    ...this.fetchOptions(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload document: ${error}`);
  }

  const data = (await response.json()) as any;

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
};

OTCSClient.prototype.getContent = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<{ content: ArrayBuffer; mimeType: string; fileName: string }> {
  const url = `${this.baseUrl}/v2/nodes/${nodeId}/content`;
  const headers: Record<string, string> = {};
  if (this.ticket) {
    headers['OTCSTicket'] = this.ticket;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    ...this.fetchOptions(),
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
};

OTCSClient.prototype.getVersions = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<OTCSVersion[]> {
  const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/versions`);
  return response.data || [];
};

OTCSClient.prototype.addVersion = async function (
  this: OTCSClient,
  nodeId: number,
  fileContent: Buffer | Blob,
  mimeType: string,
  fileName: string,
  description?: string,
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
    ...this.fetchOptions(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add version: ${error}`);
  }

  return response.json();
};
