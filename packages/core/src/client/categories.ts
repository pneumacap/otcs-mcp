import type {
  CategoryInfo,
  CategoryAttribute,
  CategoryWithValues,
  CategoryValues,
  CategoryFormSchema,
  NodeCategoriesResponse,
  WorkspaceMetadataFormSchema,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    getCategories(nodeId: number, includeMetadata?: boolean): Promise<NodeCategoriesResponse>;
    getCategory(
      nodeId: number,
      categoryId: number,
      includeMetadata?: boolean,
    ): Promise<CategoryWithValues | null>;
    addCategory(
      nodeId: number,
      categoryId: number,
      values?: CategoryValues,
    ): Promise<{ success: boolean; category_id: number }>;
    updateCategory(
      nodeId: number,
      categoryId: number,
      values: CategoryValues,
    ): Promise<{ success: boolean }>;
    removeCategory(nodeId: number, categoryId: number): Promise<{ success: boolean }>;
    getCategoryCreateForm(nodeId: number, categoryId: number): Promise<CategoryFormSchema>;
    getCategoryUpdateForm(nodeId: number, categoryId: number): Promise<CategoryFormSchema>;
    getWorkspaceMetadataForm(workspaceId: number): Promise<WorkspaceMetadataFormSchema>;
    updateWorkspaceMetadata(
      workspaceId: number,
      values: Record<string, unknown>,
    ): Promise<{ success: boolean }>;
    /** @internal */ appendCategoryValues(
      formData: URLSearchParams,
      values: CategoryValues,
      categoryId: number,
    ): void;
    /** @internal */ isSetRowObject(value: unknown): boolean;
    /** @internal */ isRowObjectArray(arr: unknown[]): boolean;
    /** @internal */ flattenSetRows(
      formData: URLSearchParams,
      baseKey: string,
      rows: Record<string, unknown>,
    ): void;
    /** @internal */ flattenRowArray(
      formData: URLSearchParams,
      baseKey: string,
      rows: Record<string, unknown>[],
    ): void;
    /** @internal */ appendSingleValue(
      formData: URLSearchParams,
      key: string,
      value: unknown,
    ): void;
    /** @internal */ extractCategoryAttributes(response: any): CategoryAttribute[];
    /** @internal */ extractSingleAttribute(
      key: string,
      prop: any,
      fieldOpts: any,
      required: boolean,
      allFieldOptions: any,
      dataValue: unknown,
    ): CategoryAttribute;
  }
}

OTCSClient.prototype.getCategories = async function (
  this: OTCSClient,
  nodeId: number,
  includeMetadata: boolean = false,
): Promise<NodeCategoriesResponse> {
  const params = includeMetadata ? '?metadata' : '';
  const response = await this.request<any>('GET', `/v2/nodes/${nodeId}/categories${params}`);

  const categories: CategoryWithValues[] = [];
  const results = response.results || [];

  for (const result of results) {
    const data = result.data || result;
    if (data.categories) {
      for (const [catIdStr, catData] of Object.entries(data.categories as Record<string, any>)) {
        if (catData == null || typeof catData !== 'object') continue;
        const catId = parseInt(catIdStr, 10);
        const attributes: CategoryWithValues['attributes'] = [];

        for (const [attrKey, attrValue] of Object.entries(catData)) {
          if (attrKey !== 'name' && !attrKey.endsWith('_name')) {
            attributes.push({
              key: attrKey,
              name: attrKey,
              type: typeof attrValue === 'object' ? 'object' : typeof attrValue,
              value: attrValue,
            });
          }
        }

        categories.push({
          id: catId,
          name: catData.name || `Category ${catId}`,
          attributes,
        });
      }
    }
  }

  return {
    node_id: nodeId,
    categories,
  };
};

OTCSClient.prototype.getCategory = async function (
  this: OTCSClient,
  nodeId: number,
  categoryId: number,
  includeMetadata: boolean = false,
): Promise<CategoryWithValues | null> {
  const params = includeMetadata ? '?metadata' : '';
  const response = await this.request<any>(
    'GET',
    `/v2/nodes/${nodeId}/categories/${categoryId}/${params}`,
  );

  const results = response.results || [];
  if (results.length === 0) return null;

  const data = results[0]?.data || results[0];
  const catData = data.categories?.[categoryId] || data;

  const attributes: CategoryWithValues['attributes'] = [];

  for (const [attrKey, attrValue] of Object.entries(catData)) {
    if (attrKey !== 'name' && !attrKey.endsWith('_name')) {
      attributes.push({
        key: attrKey,
        name: attrKey,
        type: typeof attrValue === 'object' ? 'object' : typeof attrValue,
        value: attrValue,
      });
    }
  }

  return {
    id: categoryId,
    name: catData.name || `Category ${categoryId}`,
    attributes,
  };
};

OTCSClient.prototype.addCategory = async function (
  this: OTCSClient,
  nodeId: number,
  categoryId: number,
  values?: CategoryValues,
): Promise<{ success: boolean; category_id: number }> {
  const formData = new URLSearchParams();
  formData.append('category_id', categoryId.toString());

  if (values) {
    this.appendCategoryValues(formData, values, categoryId);
  }

  await this.request<any>('POST', `/v2/nodes/${nodeId}/categories`, undefined, formData);

  return {
    success: true,
    category_id: categoryId,
  };
};

OTCSClient.prototype.updateCategory = async function (
  this: OTCSClient,
  nodeId: number,
  categoryId: number,
  values: CategoryValues,
): Promise<{ success: boolean }> {
  const formData = new URLSearchParams();

  this.appendCategoryValues(formData, values, categoryId);

  await this.request<any>(
    'PUT',
    `/v2/nodes/${nodeId}/categories/${categoryId}/`,
    undefined,
    formData,
  );

  return { success: true };
};

OTCSClient.prototype.appendCategoryValues = function (
  this: OTCSClient,
  formData: URLSearchParams,
  values: CategoryValues,
  categoryId: number,
): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;

    const isFormattedKey = /^\d+_\d+/.test(key);

    if (isFormattedKey) {
      this.appendSingleValue(formData, key, value);
    } else {
      const fullKey = `${categoryId}_${key}`;

      if (this.isSetRowObject(value)) {
        this.flattenSetRows(formData, fullKey, value as Record<string, unknown>);
      } else if (Array.isArray(value) && value.length > 0 && this.isRowObjectArray(value)) {
        this.flattenRowArray(formData, fullKey, value as Record<string, unknown>[]);
      } else {
        this.appendSingleValue(formData, fullKey, value);
      }
    }
  }
};

OTCSClient.prototype.isSetRowObject = function (this: OTCSClient, value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
};

OTCSClient.prototype.isRowObjectArray = function (this: OTCSClient, arr: unknown[]): boolean {
  return arr.every((item) => item && typeof item === 'object' && !Array.isArray(item));
};

OTCSClient.prototype.flattenSetRows = function (
  this: OTCSClient,
  formData: URLSearchParams,
  baseKey: string,
  rows: Record<string, unknown>,
): void {
  for (const [rowIndex, rowData] of Object.entries(rows)) {
    if (rowData && typeof rowData === 'object' && !Array.isArray(rowData)) {
      for (const [attrKey, attrValue] of Object.entries(rowData as Record<string, unknown>)) {
        const fullKey = `${baseKey}_${rowIndex}_${attrKey}`;
        this.appendSingleValue(formData, fullKey, attrValue);
      }
    } else {
      const fullKey = `${baseKey}_${rowIndex}`;
      this.appendSingleValue(formData, fullKey, rowData);
    }
  }
};

OTCSClient.prototype.flattenRowArray = function (
  this: OTCSClient,
  formData: URLSearchParams,
  baseKey: string,
  rows: Record<string, unknown>[],
): void {
  rows.forEach((rowData, index) => {
    const rowIndex = index + 1;
    for (const [attrKey, attrValue] of Object.entries(rowData)) {
      const fullKey = `${baseKey}_${rowIndex}_${attrKey}`;
      this.appendSingleValue(formData, fullKey, attrValue);
    }
  });
};

OTCSClient.prototype.appendSingleValue = function (
  this: OTCSClient,
  formData: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item !== undefined && item !== null) {
        if (typeof item === 'object') {
          formData.append(key, JSON.stringify(item));
        } else {
          formData.append(key, String(item));
        }
      }
    }
  } else if (typeof value === 'object') {
    formData.append(key, JSON.stringify(value));
  } else {
    formData.append(key, String(value));
  }
};

OTCSClient.prototype.removeCategory = async function (
  this: OTCSClient,
  nodeId: number,
  categoryId: number,
): Promise<{ success: boolean }> {
  await this.request<void>('DELETE', `/v2/nodes/${nodeId}/categories/${categoryId}/`);
  return { success: true };
};

OTCSClient.prototype.getCategoryCreateForm = async function (
  this: OTCSClient,
  nodeId: number,
  categoryId: number,
): Promise<CategoryFormSchema> {
  const response = await this.request<any>(
    'GET',
    `/v1/forms/nodes/categories/create?id=${nodeId}&category_id=${categoryId}`,
  );

  const attributes = this.extractCategoryAttributes(response);

  return {
    category_id: categoryId,
    category_name: response.data?.name || `Category ${categoryId}`,
    attributes,
  };
};

OTCSClient.prototype.getCategoryUpdateForm = async function (
  this: OTCSClient,
  nodeId: number,
  categoryId: number,
): Promise<CategoryFormSchema> {
  const response = await this.request<any>(
    'GET',
    `/v1/forms/nodes/categories/update?id=${nodeId}&category_id=${categoryId}`,
  );

  const attributes = this.extractCategoryAttributes(response);

  return {
    category_id: categoryId,
    category_name: response.data?.name || `Category ${categoryId}`,
    attributes,
  };
};

OTCSClient.prototype.getWorkspaceMetadataForm = async function (
  this: OTCSClient,
  workspaceId: number,
): Promise<WorkspaceMetadataFormSchema> {
  const response = await this.request<any>(
    'GET',
    `/v2/forms/businessworkspaces/${workspaceId}/metadata/update`,
  );

  const categories: CategoryFormSchema[] = [];
  const forms = response.forms || [];

  for (const form of forms) {
    if (form.schema?.properties) {
      const catId = form.data?.id || 0;
      const catName = form.data?.name || form.options?.form?.attributes?.name || 'Unknown';
      const attributes = this.extractCategoryAttributes({ forms: [form] });

      categories.push({
        category_id: catId,
        category_name: catName,
        attributes,
      });
    }
  }

  return {
    workspace_id: workspaceId,
    categories,
  };
};

OTCSClient.prototype.updateWorkspaceMetadata = async function (
  this: OTCSClient,
  workspaceId: number,
  values: Record<string, unknown>,
): Promise<{ success: boolean }> {
  const categoriesResponse = await this.getCategories(workspaceId);

  for (const category of categoriesResponse.categories) {
    const categoryPrefix = `${category.id}_`;
    const categoryValues: CategoryValues = {};
    let hasValues = false;

    for (const [key, value] of Object.entries(values)) {
      if (key.startsWith(categoryPrefix)) {
        categoryValues[key] = value;
        hasValues = true;
      }
    }

    if (hasValues) {
      await this.updateCategory(workspaceId, category.id, categoryValues);
    }
  }

  return { success: true };
};

OTCSClient.prototype.extractCategoryAttributes = function (
  this: OTCSClient,
  response: any,
): CategoryAttribute[] {
  const attributes: CategoryAttribute[] = [];
  const forms = response.forms || [];
  const formData = response.data || {};

  for (const form of forms) {
    if (form.schema?.properties) {
      const props = form.schema.properties;
      const fieldOptions = form.options?.fields || {};
      const requiredFields = form.schema.required || [];

      for (const [key, prop] of Object.entries(props as Record<string, any>)) {
        const attr = this.extractSingleAttribute(
          key,
          prop,
          fieldOptions[key] || {},
          requiredFields.includes(key),
          fieldOptions,
          formData[key],
        );
        attributes.push(attr);
      }
    }
  }

  return attributes;
};

OTCSClient.prototype.extractSingleAttribute = function (
  this: OTCSClient,
  key: string,
  prop: any,
  fieldOpts: any,
  required: boolean,
  allFieldOptions: any,
  dataValue: unknown,
): CategoryAttribute {
  const attr: CategoryAttribute = {
    key,
    name: fieldOpts.label || prop.title || key,
    type: prop.type || 'string',
    type_name: prop.format || prop.type,
    required,
    multi_value: prop.type === 'array',
    read_only: prop.readonly || fieldOpts.readonly,
    hidden: fieldOpts.hidden,
    description: fieldOpts.helper || prop.description,
  };

  if (prop.maxLength) attr.max_length = prop.maxLength;
  if (prop.minimum !== undefined) attr.min_value = prop.minimum;
  if (prop.maximum !== undefined) attr.max_value = prop.maximum;
  if (prop.default !== undefined) attr.default_value = prop.default;

  // Handle enum/select options
  if (prop.enum || fieldOpts.optionLabels) {
    attr.valid_values = (prop.enum || []).map((val: string, idx: number) => ({
      key: val,
      value: fieldOpts.optionLabels?.[idx] || val,
    }));
  }

  // Handle set/group attributes with nested properties
  if (prop.type === 'array' && prop.items?.type === 'object' && prop.items?.properties) {
    attr.is_set = true;
    attr.type = 'set';
    attr.type_name = 'set';
    attr.multi_value = false;

    const setProps = prop.items.properties;
    const setFieldOptions = fieldOpts.fields?.item?.fields || fieldOpts.items?.fields || {};
    const setRequiredFields = prop.items.required || [];

    attr.children = [];
    for (const [childKey, childProp] of Object.entries(setProps as Record<string, any>)) {
      const childOpts = setFieldOptions[childKey] || {};
      const childAttr = this.extractSingleAttribute(
        childKey,
        childProp,
        childOpts,
        setRequiredFields.includes(childKey),
        setFieldOptions,
        undefined,
      );
      attr.children.push(childAttr);
    }

    if (Array.isArray(dataValue)) {
      attr.set_rows = dataValue.length;
    }
  }
  // Handle object type with properties (inline set definition)
  else if (prop.type === 'object' && prop.properties) {
    attr.is_set = true;
    attr.type = 'set';
    attr.type_name = 'set';

    const setProps = prop.properties;
    const setFieldOptions = fieldOpts.fields || {};
    const setRequiredFields = prop.required || [];

    attr.children = [];
    for (const [childKey, childProp] of Object.entries(setProps as Record<string, any>)) {
      const childOpts = setFieldOptions[childKey] || {};
      const childAttr = this.extractSingleAttribute(
        childKey,
        childProp,
        childOpts,
        setRequiredFields.includes(childKey),
        setFieldOptions,
        undefined,
      );
      attr.children.push(childAttr);
    }

    if (dataValue && typeof dataValue === 'object') {
      const rowKeys = Object.keys(dataValue).filter((k) => /^\d+$/.test(k));
      attr.set_rows = rowKeys.length;
    }
  }

  return attr;
};
