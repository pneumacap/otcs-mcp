import type { OTCSNodeResponse, OTCSCreateNodeResponse, NodeInfo } from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    deleteNode(nodeId: number): Promise<void>;
    deleteNodes(
      nodeIds: number[],
    ): Promise<Array<{ id: number; success: boolean; error?: string }>>;
    renameNode(nodeId: number, newName: string): Promise<NodeInfo>;
    updateNodeDescription(nodeId: number, description: string): Promise<NodeInfo>;
    moveNode(nodeId: number, newParentId: number): Promise<NodeInfo>;
    copyNode(
      nodeId: number,
      destinationId: number,
      newName?: string,
    ): Promise<OTCSCreateNodeResponse>;
  }
}

OTCSClient.prototype.deleteNode = async function (this: OTCSClient, nodeId: number): Promise<void> {
  await this.request<void>('DELETE', `/v2/nodes/${nodeId}`);
};

OTCSClient.prototype.deleteNodes = async function (
  this: OTCSClient,
  nodeIds: number[],
): Promise<Array<{ id: number; success: boolean; error?: string }>> {
  const results: Array<{ id: number; success: boolean; error?: string }> = [];
  for (const nodeId of nodeIds) {
    try {
      await this.deleteNode(nodeId);
      results.push({ id: nodeId, success: true });
    } catch (error: any) {
      results.push({ id: nodeId, success: false, error: error.message });
    }
  }
  return results;
};

OTCSClient.prototype.renameNode = async function (
  this: OTCSClient,
  nodeId: number,
  newName: string,
): Promise<NodeInfo> {
  const formData = new URLSearchParams();
  formData.append('name', newName);

  const response = await this.request<OTCSNodeResponse>(
    'PUT',
    `/v2/nodes/${nodeId}`,
    undefined,
    formData,
  );

  const props = this.extractNodeProperties(response);
  return this.transformNode(props);
};

OTCSClient.prototype.updateNodeDescription = async function (
  this: OTCSClient,
  nodeId: number,
  description: string,
): Promise<NodeInfo> {
  const formData = new URLSearchParams();
  formData.append('description', description);

  const response = await this.request<OTCSNodeResponse>(
    'PUT',
    `/v2/nodes/${nodeId}`,
    undefined,
    formData,
  );

  const props = this.extractNodeProperties(response);
  return this.transformNode(props);
};

OTCSClient.prototype.moveNode = async function (
  this: OTCSClient,
  nodeId: number,
  newParentId: number,
): Promise<NodeInfo> {
  const formData = new URLSearchParams();
  formData.append('parent_id', newParentId.toString());

  const response = await this.request<OTCSNodeResponse>(
    'PUT',
    `/v2/nodes/${nodeId}`,
    undefined,
    formData,
  );

  const props = this.extractNodeProperties(response);
  return this.transformNode(props);
};

OTCSClient.prototype.copyNode = async function (
  this: OTCSClient,
  nodeId: number,
  destinationId: number,
  newName?: string,
): Promise<OTCSCreateNodeResponse> {
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
};
