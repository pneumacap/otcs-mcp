/**
 * Folder handlers — otcs_create_folder, otcs_create_folder_structure
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const folderHandlers: Record<string, HandlerFn> = {
  otcs_create_folder: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      parent_id,
      name,
      path: folderPath,
      description,
    } = args as {
      parent_id: number;
      name?: string;
      path?: string;
      description?: string;
    };
    if (folderPath) {
      const result = await client.createFolderPath(parent_id, folderPath);
      return {
        success: true,
        folders_created: result.folders,
        leaf_folder_id: result.leafId,
        message: `Folder path "${folderPath}" created. Leaf ID: ${result.leafId}`,
      };
    }
    if (!name) throw new Error('Either "name" or "path" is required');
    const result = await client.createFolder(parent_id, name, description);
    return {
      success: true,
      folder: result,
      message: `Folder "${name}" created with ID ${result.id}`,
    };
  },

  otcs_create_folder_structure: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { parent_id, folders } = args as {
      parent_id: number;
      folders: Array<{ name: string; children?: Array<any> }>;
    };
    const result = await client.createFolderTree(parent_id, folders);
    return { success: true, folders: result };
  },
};
