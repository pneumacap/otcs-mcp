import type {
  RMCrossRefType,
  RMCrossRef,
  RMNodeCrossRefsResponse,
  RMCrossRefTypesResponse,
  RMCrossRefApplyParams,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    listRMCrossRefTypes(): Promise<RMCrossRefTypesResponse>;
    getRMCrossRefType(xrefType: string): Promise<RMCrossRefType>;
    createRMCrossRefType(name: string, description?: string): Promise<RMCrossRefType>;
    deleteRMCrossRefType(xrefType: string): Promise<{ success: boolean }>;
    getNodeRMCrossRefs(nodeId: number): Promise<RMNodeCrossRefsResponse>;
    applyRMCrossRef(params: RMCrossRefApplyParams): Promise<{ success: boolean }>;
    removeRMCrossRef(
      nodeId: number,
      xrefType: string,
      refNodeId: number,
    ): Promise<{ success: boolean }>;
    applyRMCrossRefBatch(
      nodeIds: number[],
      xrefType: string,
      refNodeId: number,
    ): Promise<{ success: boolean; count: number }>;
    removeRMCrossRefBatch(
      nodeIds: number[],
      xrefType: string,
      refNodeId: number,
    ): Promise<{ success: boolean; count: number }>;
    /** @internal */ parseRMCrossRef(data: any): RMCrossRef;
  }
}

OTCSClient.prototype.listRMCrossRefTypes = async function (
  this: OTCSClient,
): Promise<RMCrossRefTypesResponse> {
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
};

OTCSClient.prototype.getRMCrossRefType = async function (
  this: OTCSClient,
  xrefType: string,
): Promise<RMCrossRefType> {
  const response = await this.request<any>('GET', `/v1/xrefs/${encodeURIComponent(xrefType)}`);
  const data = response.data || response.results || response;

  return {
    name: data.name || data.xref_type || xrefType,
    description: data.description,
    in_use: data.in_use,
  };
};

OTCSClient.prototype.createRMCrossRefType = async function (
  this: OTCSClient,
  name: string,
  description?: string,
): Promise<RMCrossRefType> {
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
};

OTCSClient.prototype.deleteRMCrossRefType = async function (
  this: OTCSClient,
  xrefType: string,
): Promise<{ success: boolean }> {
  await this.request<any>('DELETE', `/v1/xrefs/${encodeURIComponent(xrefType)}`);
  return { success: true };
};

OTCSClient.prototype.getNodeRMCrossRefs = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<RMNodeCrossRefsResponse> {
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
};

OTCSClient.prototype.applyRMCrossRef = async function (
  this: OTCSClient,
  params: RMCrossRefApplyParams,
): Promise<{ success: boolean }> {
  const formData = new URLSearchParams();
  formData.append('xref_type', params.xref_type);
  formData.append('xref_id', params.ref_node_id.toString());
  formData.append('comment', params.comment || '');

  await this.request<any>('POST', `/v1/nodes/${params.node_id}/xrefs`, undefined, formData);
  return { success: true };
};

OTCSClient.prototype.removeRMCrossRef = async function (
  this: OTCSClient,
  nodeId: number,
  xrefType: string,
  refNodeId: number,
): Promise<{ success: boolean }> {
  await this.request<any>(
    'DELETE',
    `/v1/nodes/${nodeId}/xrefs/${encodeURIComponent(xrefType)}/refnodes/${refNodeId}`,
  );
  return { success: true };
};

OTCSClient.prototype.applyRMCrossRefBatch = async function (
  this: OTCSClient,
  nodeIds: number[],
  xrefType: string,
  refNodeId: number,
): Promise<{ success: boolean; count: number }> {
  const formData = new URLSearchParams();
  formData.append('xref_type', xrefType);
  formData.append('ref_node_id', refNodeId.toString());
  formData.append('ids', nodeIds.join(','));

  await this.request<any>('POST', `/v1/rmclassifications/assignxref`, undefined, formData);
  return { success: true, count: nodeIds.length };
};

OTCSClient.prototype.removeRMCrossRefBatch = async function (
  this: OTCSClient,
  nodeIds: number[],
  xrefType: string,
  refNodeId: number,
): Promise<{ success: boolean; count: number }> {
  const formData = new URLSearchParams();
  formData.append('xref_type', xrefType);
  formData.append('ref_node_id', refNodeId.toString());
  formData.append('ids', nodeIds.join(','));

  await this.request<any>('POST', `/v1/rmclassifications/removexref`, undefined, formData);
  return { success: true, count: nodeIds.length };
};

OTCSClient.prototype.parseRMCrossRef = function (this: OTCSClient, data: any): RMCrossRef {
  return {
    xref_type: data.xref_type || data.type,
    xref_type_name: data.xref_type_name || data.type_name,
    ref_node_id: data.ref_node_id || data.node_id,
    ref_node_name: data.ref_node_name || data.name,
    ref_node_type: data.ref_node_type,
    ref_node_type_name: data.ref_node_type_name,
  };
};
