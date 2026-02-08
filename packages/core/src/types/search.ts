import type { NodeInfo } from './core';

// ============ Enterprise Search Types ============

/**
 * Search mode options
 */
export const SearchModes = {
  ALL_WORDS: 'allwords',
  ANY_WORDS: 'anywords',
  EXACT_PHRASE: 'exactphrase',
  COMPLEX_QUERY: 'complexquery',
} as const;

export type SearchMode = (typeof SearchModes)[keyof typeof SearchModes];

/**
 * Search scope options
 */
export const SearchWithin = {
  ALL: 'all',
  CONTENT: 'content',
  METADATA: 'metadata',
} as const;

export type SearchWithinType = (typeof SearchWithin)[keyof typeof SearchWithin];

/**
 * Search sort options
 */
export const SearchSort = {
  RELEVANCE: 'relevance',
  DATE_DESC: 'desc_OTObjectDate',
  DATE_ASC: 'asc_OTObjectDate',
  SIZE_DESC: 'desc_OTObjectSize',
  SIZE_ASC: 'asc_OTObjectSize',
  NAME_ASC: 'asc_OTName',
  NAME_DESC: 'desc_OTName',
} as const;

export type SearchSortType = (typeof SearchSort)[keyof typeof SearchSort];

/**
 * Options for enterprise search
 */
/**
 * Filter type for restricting search results by object type
 */
export type SearchFilterType = 'all' | 'documents' | 'folders' | 'workspaces' | 'workflows';

export interface EnterpriseSearchOptions {
  query: string;
  lookfor?: SearchMode;
  within?: SearchWithinType;
  modifier?: 'synonymsof' | 'relatedto' | 'soundslike' | 'wordbeginswith' | 'wordendswith';
  sort?: SearchSortType;
  filter_type?: SearchFilterType;
  location_id?: number;
  include_facets?: boolean;
  include_highlights?: boolean;
  limit?: number;
  page?: number;
}

/**
 * Search result item from API
 */
export interface SearchResultItem {
  data: {
    properties: {
      id: number;
      parent_id: number;
      name: string;
      type: number;
      type_name: string;
      description?: string;
      create_date: string;
      modify_date: string;
      size?: number;
      mime_type?: string;
      container: boolean;
      container_size?: number;
      owner_user_id?: number;
      create_user_id?: number;
      favorite?: boolean;
      summary?: unknown[];
      short_summary?: string[];
    };
    versions?: {
      file_name?: string;
      file_size?: number;
      mime_type?: string;
      version_number?: number;
    };
    regions?: Record<string, unknown>;
  };
  search_result_metadata?: {
    current_version?: boolean;
    object_href?: string;
    object_id?: string;
    result_type?: number;
    source_id?: number;
    version_type?: string;
  };
}

/**
 * Search facet value
 */
export interface SearchFacetValue {
  value: string;
  display_name?: string;
  count: number;
  percentage?: number;
}

/**
 * Search facet
 */
export interface SearchFacet {
  name: string;
  display_name: string;
  count: number;
  values: SearchFacetValue[];
}

/**
 * Highlight snippet from search
 */
export interface SearchHighlight {
  field: string;
  snippets: string[];
}

/**
 * API response for enterprise search
 */
export interface OTCSSearchResponse {
  collection?: {
    paging?: {
      limit: number;
      page: number;
      page_total: number;
      range_max: number;
      range_min: number;
      total_count: number;
    };
    searching?: {
      cache_id?: number;
      facets?: SearchFacet[];
      result_title?: string;
    };
    sorting?: {
      sort?: string[];
    };
  };
  results?: SearchResultItem[];
  featured?: unknown[];
}

/**
 * Enterprise search result returned to the agent
 */
export interface EnterpriseSearchResult {
  results: SearchResultNodeInfo[];
  total_count: number;
  page: number;
  page_size: number;
  facets?: SearchFacet[];
  cache_id?: number;
}

/**
 * Node info with search-specific metadata
 */
export interface SearchResultNodeInfo extends NodeInfo {
  relevance_score?: number;
  highlight_summary?: string;
  version_info?: {
    file_name?: string;
    version_number?: number;
  };
}
