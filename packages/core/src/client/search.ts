import type {
  OTCSNode,
  OTCSSearchResponse,
  NodeInfo,
  EnterpriseSearchOptions,
  EnterpriseSearchResult,
  SearchResultNodeInfo,
  SearchFacet,
} from '../types';
import { OTCSClient, NodeTypes } from './base';

declare module './base.js' {
  interface OTCSClient {
    search(options: EnterpriseSearchOptions): Promise<EnterpriseSearchResult>;
    searchNodes(
      query: string,
      options?: {
        where_type?: number[];
        location?: number;
        limit?: number;
        page?: number;
      },
    ): Promise<{ results: NodeInfo[]; total_count: number }>;
  }
}

OTCSClient.prototype.search = async function (
  this: OTCSClient,
  options: EnterpriseSearchOptions,
): Promise<EnterpriseSearchResult> {
  const params = new URLSearchParams();

  // Type filtering via OTSubType in complexquery mode
  // The slice parameter is unreliable, so we append OTSubType to the query
  let query = options.query;
  let lookfor = options.lookfor || 'allwords';
  let within = options.within || 'all';

  if (options.filter_type && options.filter_type !== 'all') {
    const typeMap: Record<string, number[]> = {
      documents: [NodeTypes.DOCUMENT], // 144
      folders: [NodeTypes.FOLDER], // 0
      workspaces: [NodeTypes.BUSINESS_WORKSPACE], // 848
      workflows: [NodeTypes.WORKFLOW_MAP], // 128
    };
    const subtypes = typeMap[options.filter_type];
    if (subtypes && subtypes.length > 0) {
      const subtypeFilter =
        subtypes.length === 1
          ? `OTSubType:${subtypes[0]}`
          : `(${subtypes.map((s) => `OTSubType:${s}`).join(' OR ')})`;

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

  // Location scoping via OTLocation in complexquery mode
  if (options.location_id) {
    const locationFilter = `OTLocation:${options.location_id}`;
    const isWildcardOnly = query.trim() === '*' || query.trim() === '';

    if (isWildcardOnly) {
      // Wildcard-only + location: use location as the sole query term
      query = locationFilter;
      lookfor = 'complexquery';
    } else if (lookfor === 'complexquery') {
      query = `(${query}) AND ${locationFilter}`;
    } else {
      query = `${query} ${locationFilter}`;
      lookfor = 'complexquery';
    }

    // OTLocation is a metadata field, so we must search 'all'
    if (within === 'content') {
      within = 'all';
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

  const response = await this.request<OTCSSearchResponse>('POST', '/v2/search', undefined, params);

  // Transform results
  const items: SearchResultNodeInfo[] = (response.results || [])
    .map((item) => {
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
        const summaryText = summaryArr
          .map((part: unknown) => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object' && 'text' in part)
              return `**${(part as { text: string }).text}**`;
            return '';
          })
          .join('');
        if (summaryText.trim()) {
          searchNode.highlight_summary = summaryText;
        }
      }

      return searchNode;
    })
    .filter((item): item is SearchResultNodeInfo => item !== null);

  const paging = response.collection?.paging;
  const searching = response.collection?.searching;

  // Extract facets from the nested available array
  const facets = searching?.facets;
  const facetArray =
    facets && typeof facets === 'object' && 'available' in facets
      ? (facets as { available: SearchFacet[] }).available
      : Array.isArray(facets)
        ? facets
        : undefined;

  return {
    results: items,
    total_count: paging?.total_count || items.length,
    page: paging?.page || 1,
    page_size: paging?.limit || items.length,
    facets: facetArray,
    cache_id: searching?.cache_id,
  };
};

OTCSClient.prototype.searchNodes = async function (
  this: OTCSClient,
  query: string,
  options: {
    where_type?: number[];
    location?: number;
    limit?: number;
    page?: number;
  } = {},
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
};
