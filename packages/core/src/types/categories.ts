// ============ Category & Metadata Types ============

/**
 * Category applied to a node
 */
export interface CategoryInfo {
  id: number;
  name: string;
  display_name?: string;
}

/**
 * Category attribute definition
 * Supports both simple attributes and nested set structures
 */
export interface CategoryAttribute {
  key: string;
  name: string;
  type: string;
  type_name?: string;
  required?: boolean;
  multi_value?: boolean;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  default_value?: unknown;
  read_only?: boolean;
  hidden?: boolean;
  valid_values?: Array<{ key: string; value: string }>;
  description?: string;
  /** True if this is a set/group that contains nested attributes */
  is_set?: boolean;
  /** Number of rows in the set (if is_set is true) */
  set_rows?: number;
  /** Nested attributes within a set (if is_set is true) */
  children?: CategoryAttribute[];
}

/**
 * Category with its attributes and values
 */
export interface CategoryWithValues {
  id: number;
  name: string;
  display_name?: string;
  attributes: Array<{
    key: string;
    name: string;
    type: string;
    value?: unknown;
    values?: unknown[];
    display_value?: string;
  }>;
}

/**
 * Category values to set/update
 *
 * Supported key formats:
 * 1. Simple: "{category_id}_{attribute_id}" → "9830_2"
 * 2. Set row: "{category_id}_{set_id}_{row}_{attribute_id}" → "9830_4_1_5"
 * 3. Just attribute ID (prefixed automatically): "2" → becomes "9830_2"
 *
 * Supported value formats for sets:
 * 1. Flat keys: { "9830_4_1_5": "value", "9830_4_2_5": "value2" }
 * 2. Nested object: { "4": { "1": { "5": "value" }, "2": { "5": "value2" } } }
 * 3. Row array: { "4": [{ "5": "value" }, { "5": "value2" }] }
 *
 * Multi-value attributes use arrays: { "9830_4_1_5": ["val1", "val2", "val3"] }
 * Multilingual values use objects: { "9830_3_multilingual": { "en": "English", "fr": "French" } }
 */
export interface CategoryValues {
  [key: string]: unknown;
}

/**
 * Response from adding a category
 */
export interface AddCategoryResponse {
  success: boolean;
  category_id: number;
  message?: string;
}

/**
 * Category form schema for creating/updating categories
 */
export interface CategoryFormSchema {
  category_id: number;
  category_name: string;
  attributes: CategoryAttribute[];
}

/**
 * Response containing categories on a node
 */
export interface NodeCategoriesResponse {
  node_id: number;
  categories: CategoryWithValues[];
}
