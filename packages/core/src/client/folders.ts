import type { OTCSNode, OTCSNodesResponse, OTCSCreateNodeResponse } from '../types';
import { OTCSClient, NodeTypes } from './base';

declare module './base.js' {
  interface OTCSClient {
    createFolder(
      parentId: number,
      name: string,
      description?: string,
    ): Promise<OTCSCreateNodeResponse>;
    createFolderPath(
      parentId: number,
      path: string,
    ): Promise<{ folders: OTCSCreateNodeResponse[]; leafId: number }>;
    findChildByName(parentId: number, name: string): Promise<OTCSNode | null>;
    createFolderTree(
      parentId: number,
      folders: Array<{ name: string; children?: Array<any> }>,
    ): Promise<
      Array<{ name: string; id: number; path: string; created: boolean; children: any[] }>
    >;
  }
}

OTCSClient.prototype.createFolder = async function (
  this: OTCSClient,
  parentId: number,
  name: string,
  description?: string,
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
};

OTCSClient.prototype.createFolderPath = async function (
  this: OTCSClient,
  parentId: number,
  path: string,
): Promise<{ folders: OTCSCreateNodeResponse[]; leafId: number }> {
  const parts = path.split('/').filter((p) => p.trim());
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
};

OTCSClient.prototype.findChildByName = async function (
  this: OTCSClient,
  parentId: number,
  name: string,
): Promise<OTCSNode | null> {
  const params = new URLSearchParams();
  params.append('where_name', name);
  params.append('limit', '1');

  const response = await this.request<OTCSNodesResponse>(
    'GET',
    `/v2/nodes/${parentId}/nodes?${params.toString()}`,
  );

  const items = response.results || [];
  if (items.length > 0 && items[0].data?.properties) {
    return items[0].data.properties;
  }
  return null;
};

OTCSClient.prototype.createFolderTree = async function (
  this: OTCSClient,
  parentId: number,
  folders: Array<{ name: string; children?: Array<any> }>,
): Promise<Array<{ name: string; id: number; path: string; created: boolean; children: any[] }>> {
  const self = this;
  const processLevel = async (
    currentParentId: number,
    items: Array<{ name: string; children?: Array<any> }>,
    parentPath: string,
  ): Promise<
    Array<{ name: string; id: number; path: string; created: boolean; children: any[] }>
  > => {
    const results: Array<{
      name: string;
      id: number;
      path: string;
      created: boolean;
      children: any[];
    }> = [];

    for (const item of items) {
      const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      let folderId: number;
      let created = false;

      const existing = await self.findChildByName(currentParentId, item.name);
      if (existing) {
        folderId = existing.id;
      } else {
        const newFolder = await self.createFolder(currentParentId, item.name);
        folderId = newFolder.id;
        created = true;
      }

      let childResults: any[] = [];
      if (item.children && item.children.length > 0) {
        childResults = await processLevel(folderId, item.children, folderPath);
      }

      results.push({
        name: item.name,
        id: folderId,
        path: folderPath,
        created,
        children: childResults,
      });
    }

    return results;
  };

  return processLevel(parentId, folders, '');
};
