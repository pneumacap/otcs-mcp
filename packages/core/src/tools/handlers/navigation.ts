/**
 * Navigation handlers — otcs_get_node, otcs_browse, otcs_search, otcs_browse_tree
 */

import type { OTCSClient } from '../../client/otcs-client';
import { NodeTypes } from '../../types';
import type { HandlerFn } from './index';

export const navigationHandlers: Record<string, HandlerFn> = {
  otcs_get_node: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { node_id, include_path } = args as {
      node_id: number;
      include_path?: boolean;
    };
    if (include_path) {
      const { node, ancestors } = await client.getNodeWithAncestors(node_id);
      return {
        ...node,
        path: ancestors.map((a) => a.name),
        ancestors: ancestors.map((a) => ({ id: a.id, name: a.name })),
      };
    }
    return await client.getNode(node_id);
  },

  otcs_browse: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { folder_id, page, page_size, filter_type, sort } = args as {
      folder_id: number;
      page?: number;
      page_size?: number;
      filter_type?: string;
      sort?: string;
    };
    let where_type: number[] | undefined;
    if (filter_type === 'folders') where_type = [NodeTypes.FOLDER];
    else if (filter_type === 'documents') where_type = [NodeTypes.DOCUMENT];
    return await client.getSubnodes(folder_id, {
      page: page || 1,
      limit: page_size || 100,
      sort,
      where_type,
    });
  },

  otcs_search: async (client: OTCSClient, args: Record<string, unknown>) => {
    const params = args as {
      query: string;
      filter_type?: 'all' | 'documents' | 'folders' | 'workspaces' | 'workflows';
      location_id?: number;
      mode?: 'allwords' | 'anywords' | 'exactphrase' | 'complexquery';
      search_in?: 'all' | 'content' | 'metadata';
      modifier?: 'synonymsof' | 'relatedto' | 'soundslike' | 'wordbeginswith' | 'wordendswith';
      sort?: string;
      include_facets?: boolean;
      include_highlights?: boolean;
      limit?: number;
      page?: number;
    };
    return await client.search({
      query: params.query,
      filter_type: params.filter_type,
      location_id: params.location_id,
      lookfor: params.mode,
      within: params.search_in,
      modifier: params.modifier,
      sort: params.sort as any,
      include_facets: params.include_facets,
      include_highlights: params.include_highlights,
      limit: params.limit || 50,
      page: params.page,
    });
  },

  otcs_browse_tree: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { folder_id, max_depth, folders_only } = args as {
      folder_id: number;
      max_depth?: number;
      folders_only?: boolean;
    };
    const tree = await client.getTree(folder_id, max_depth ?? 5, folders_only ?? true);
    return { tree };
  },
};
