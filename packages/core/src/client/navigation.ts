import type {
  OTCSNodeResponse,
  OTCSNodesResponse,
  OTCSAncestor,
  NodeInfo,
  FolderContents,
  FolderTreeNode,
} from '../types';
import { OTCSClient, NodeTypes } from './base';

declare module './base.js' {
  interface OTCSClient {
    getNode(nodeId: number): Promise<NodeInfo>;
    getNodeWithAncestors(nodeId: number): Promise<{ node: NodeInfo; ancestors: OTCSAncestor[] }>;
    getSubnodes(
      nodeId: number,
      options?: {
        page?: number;
        limit?: number;
        sort?: string;
        where_type?: number[];
      },
    ): Promise<FolderContents>;
    getTree(nodeId: number, maxDepth?: number, foldersOnly?: boolean): Promise<FolderTreeNode>;
    browseFolderTree(
      nodeId: number,
      maxDepth?: number,
      foldersOnly?: boolean,
    ): Promise<FolderTreeNode>;
  }
}

OTCSClient.prototype.getNode = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<NodeInfo> {
  const response = await this.request<OTCSNodeResponse>('GET', `/v2/nodes/${nodeId}`);

  const props = this.extractNodeProperties(response);
  return this.transformNode(props);
};

OTCSClient.prototype.getNodeWithAncestors = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<{ node: NodeInfo; ancestors: OTCSAncestor[] }> {
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}?expand=properties{original_id}&actions=open&actions=download`,
  );

  const props = this.extractNodeProperties(response);
  const ancestors: OTCSAncestor[] = response.results?.data?.properties?.ancestors || [];

  const node = this.transformNode(props);
  node.path = ancestors.map((a) => a.name);

  return { node, ancestors };
};

OTCSClient.prototype.getSubnodes = async function (
  this: OTCSClient,
  nodeId: number,
  options: {
    page?: number;
    limit?: number;
    sort?: string;
    where_type?: number[];
  } = {},
): Promise<FolderContents> {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.sort) params.append('sort', options.sort);
  if (options.where_type && options.where_type.length > 0) {
    options.where_type.forEach((t) => params.append('where_type', t.toString()));
  }

  const queryString = params.toString();
  const path = `/v2/nodes/${nodeId}/nodes${queryString ? '?' + queryString : ''}`;

  const response = await this.request<OTCSNodesResponse>('GET', path);

  // Get folder info
  const folderInfo = await this.getNode(nodeId);

  // Transform items
  const items: NodeInfo[] = (response.results || [])
    .map((item) => {
      const props = item.data?.properties;
      if (!props) return null;
      return this.transformNode(props);
    })
    .filter((item): item is NodeInfo => item !== null);

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
};

OTCSClient.prototype.getTree = async function (
  this: OTCSClient,
  nodeId: number,
  maxDepth: number = 5,
  foldersOnly: boolean = true,
): Promise<FolderTreeNode> {
  const rootInfo = await this.getNode(nodeId);

  const buildTree = async (
    id: number,
    name: string,
    type: number,
    typeName: string,
    depth: number,
  ): Promise<FolderTreeNode> => {
    const node: FolderTreeNode = { id, name, type, type_name: typeName };

    if (depth >= maxDepth || type !== NodeTypes.FOLDER) {
      return node;
    }

    const options: { limit: number; where_type?: number[] } = { limit: 100 };
    if (foldersOnly) {
      options.where_type = [NodeTypes.FOLDER];
    }

    const contents = await this.getSubnodes(id, options);
    if (contents.items.length > 0) {
      node.children = await Promise.all(
        contents.items.map((child) =>
          buildTree(child.id, child.name, child.type, child.type_name, depth + 1),
        ),
      );
    }

    return node;
  };

  return buildTree(rootInfo.id, rootInfo.name, rootInfo.type, rootInfo.type_name, 0);
};

// browseFolderTree is an alias for getTree
OTCSClient.prototype.browseFolderTree = OTCSClient.prototype.getTree;
