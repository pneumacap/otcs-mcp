/**
 * Category handlers — otcs_categories, otcs_workspace_metadata
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const categoryHandlers: Record<string, HandlerFn> = {
  otcs_categories: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, node_id, category_id, values, include_metadata, form_mode } = args as {
      action: string;
      node_id: number;
      category_id?: number;
      values?: Record<string, unknown>;
      include_metadata?: boolean;
      form_mode?: string;
    };

    switch (action) {
      case 'list': {
        const result = await client.getCategories(node_id, include_metadata);
        return {
          ...result,
          category_count: result.categories.length,
          message:
            result.categories.length > 0
              ? `Found ${result.categories.length} category(ies)`
              : 'No categories applied',
        };
      }
      case 'get': {
        if (!category_id) throw new Error('category_id required');
        const cat = await client.getCategory(node_id, category_id, include_metadata);
        return cat
          ? {
              found: true,
              category: cat,
              attribute_count: cat.attributes.length,
            }
          : {
              found: false,
              message: `Category ${category_id} not found`,
            };
      }
      case 'add': {
        if (!category_id) throw new Error('category_id required');
        const added = await client.addCategory(node_id, category_id, values);
        return {
          ...added,
          message: `Category ${category_id} added`,
          values_set: values ? Object.keys(values) : [],
        };
      }
      case 'update': {
        if (!category_id || !values) throw new Error('category_id and values required');
        const updated = await client.updateCategory(node_id, category_id, values);
        return {
          ...updated,
          message: `Category ${category_id} updated`,
          values_updated: Object.keys(values),
        };
      }
      case 'remove': {
        if (!category_id) throw new Error('category_id required');
        const removed = await client.removeCategory(node_id, category_id);
        return {
          ...removed,
          message: `Category ${category_id} removed`,
        };
      }
      case 'get_form': {
        if (!category_id) throw new Error('category_id required');
        const form =
          form_mode === 'update'
            ? await client.getCategoryUpdateForm(node_id, category_id)
            : await client.getCategoryCreateForm(node_id, category_id);
        return {
          form,
          attribute_count: form.attributes.length,
          required_attributes: form.attributes
            .filter((a: any) => a.required)
            .map((a: any) => a.key),
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  otcs_workspace_metadata: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, workspace_id, values } = args as {
      action: string;
      workspace_id: number;
      values?: Record<string, unknown>;
    };

    if (action === 'get_values' || action === 'get') {
      // Get the actual current values of workspace business properties
      const categoriesResult = await client.getCategories(workspace_id, true);

      // Transform into a more user-friendly format
      const businessProperties: Record<string, any> = {};
      for (const cat of categoriesResult.categories) {
        const catValues: Record<string, any> = {};
        for (const attr of cat.attributes) {
          // Use attribute name as key, store value
          catValues[attr.name] = attr.value;
        }
        businessProperties[cat.name] = catValues;
      }

      return {
        workspace_id,
        categories: categoriesResult.categories,
        business_properties: businessProperties,
        category_count: categoriesResult.categories.length,
        message: `Retrieved ${categoriesResult.categories.length} business property category(ies)`,
      };
    }

    if (action === 'get_form') {
      const form = await client.getWorkspaceMetadataForm(workspace_id);
      const totalAttributes = form.categories.reduce(
        (sum: number, cat: any) => sum + cat.attributes.length,
        0,
      );
      return {
        form,
        category_count: form.categories.length,
        total_attributes: totalAttributes,
        categories_summary: form.categories.map((c: any) => ({
          id: c.category_id,
          name: c.category_name,
          attribute_count: c.attributes.length,
        })),
      };
    }

    if (action === 'update') {
      if (!values) throw new Error('values required for update');
      const result = await client.updateWorkspaceMetadata(workspace_id, values);
      return {
        ...result,
        message: `Workspace ${workspace_id} metadata updated`,
        values_updated: Object.keys(values),
      };
    }

    throw new Error(`Unknown action: ${action}`);
  },
};
