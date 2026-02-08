/**
 * Document handlers — otcs_upload, otcs_upload_folder, otcs_upload_batch,
 * otcs_upload_with_metadata, otcs_download_content, otcs_versions
 */

import type { OTCSClient } from '../../client/otcs-client';
import * as fs from 'fs';
import * as path from 'path';
import { getMimeType } from '../utils';
import { extractText } from '../text-extract';
import type { HandlerFn } from './index';

export const documentHandlers: Record<string, HandlerFn> = {
  otcs_upload: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      parent_id,
      file_path: filePath,
      content_base64,
      name,
      mime_type,
      description,
    } = args as {
      parent_id: number;
      file_path?: string;
      content_base64?: string;
      name?: string;
      mime_type?: string;
      description?: string;
    };

    let buffer: Buffer;
    let fileName: string;
    let mimeType: string;

    if (filePath) {
      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
      buffer = fs.readFileSync(filePath);
      fileName = name || path.basename(filePath);
      mimeType = mime_type || getMimeType(filePath);
    } else if (content_base64) {
      if (!name) throw new Error('name required when using content_base64');
      buffer = Buffer.from(content_base64, 'base64');
      fileName = name;
      mimeType = mime_type || 'application/octet-stream';
    } else {
      throw new Error('Either file_path or content_base64 is required');
    }

    const result = await client.uploadDocument(parent_id, fileName, buffer, mimeType, description);
    return {
      success: true,
      document: result,
      message: `"${fileName}" uploaded with ID ${result.id}`,
      size_bytes: buffer.length,
    };
  },

  otcs_download_content: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { node_id } = args as { node_id: number };
    const { content, mimeType, fileName } = await client.getContent(node_id);
    const buf = Buffer.from(content);

    // Extract readable text when possible
    const extracted = await extractText(buf, mimeType, fileName);

    const result: Record<string, unknown> = {
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: buf.byteLength,
    };

    if (extracted) {
      result.text_content = extracted.text;
      result.extraction_method = extracted.method;
      result.text_length = extracted.text.length;
    } else {
      // For non-text formats, still return base64 but note it's binary
      result.content_base64 = buf.toString('base64');
      result.note = 'Binary content — text extraction not available for this format.';
    }

    return result;
  },

  otcs_upload_folder: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      parent_id,
      folder_path,
      extensions,
      recursive,
      concurrency,
      category_id,
      category_values,
    } = args as {
      parent_id: number;
      folder_path: string;
      extensions?: string[];
      recursive?: boolean;
      concurrency?: number;
      category_id?: number;
      category_values?: Record<string, unknown>;
    };

    if (!fs.existsSync(folder_path)) throw new Error(`Folder not found: ${folder_path}`);
    if (!fs.statSync(folder_path).isDirectory())
      throw new Error(`Path is not a directory: ${folder_path}`);

    const baseFolderPath = path.resolve(folder_path);
    const sourceFolderName = path.basename(baseFolderPath);

    let rootFolderId: number;
    try {
      const existingFolder = await client.findChildByName(parent_id, sourceFolderName);
      if (existingFolder) {
        rootFolderId = existingFolder.id;
      } else {
        const createdFolder = await client.createFolder(parent_id, sourceFolderName);
        rootFolderId = createdFolder.id;
      }
    } catch (error) {
      throw new Error(`Failed to create root folder "${sourceFolderName}": ${error}`);
    }

    const filesToUpload: { fullPath: string; relativePath: string }[] = [];
    const collectFiles = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (recursive) collectFiles(fullPath);
        } else if (entry.isFile()) {
          if (extensions && extensions.length > 0) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!extensions.map((e) => e.toLowerCase()).includes(ext)) continue;
          }
          if (!entry.name.startsWith('.')) {
            const relativePath = path.relative(baseFolderPath, fullPath);
            filesToUpload.push({ fullPath, relativePath });
          }
        }
      }
    };
    collectFiles(folder_path);

    if (filesToUpload.length === 0) {
      return {
        success: true,
        uploaded: 0,
        message: 'No files found to upload',
        folder_path,
        root_folder: { name: sourceFolderName, id: rootFolderId },
        extensions,
      };
    }

    const folderCache: Map<string, number> = new Map();
    folderCache.set('', rootFolderId);

    const ensureFolderPath = async (relativeFolderPath: string): Promise<number> => {
      if (relativeFolderPath === '' || relativeFolderPath === '.') return rootFolderId;
      if (folderCache.has(relativeFolderPath)) return folderCache.get(relativeFolderPath)!;
      const result = await client.createFolderPath(rootFolderId, relativeFolderPath);
      const pathParts = relativeFolderPath.split(path.sep);
      let cumulativePath = '';
      for (let i = 0; i < pathParts.length; i++) {
        cumulativePath = i === 0 ? pathParts[i] : path.join(cumulativePath, pathParts[i]);
        if (result.folders[i]) {
          folderCache.set(cumulativePath, result.folders[i].id);
        }
      }
      return result.leafId;
    };

    const uniqueFolderPaths = new Set<string>();
    for (const file of filesToUpload) {
      const fp = path.dirname(file.relativePath);
      if (fp !== '' && fp !== '.') uniqueFolderPaths.add(fp);
    }
    const sortedFolderPaths = Array.from(uniqueFolderPaths).sort(
      (a, b) => a.split(path.sep).length - b.split(path.sep).length,
    );
    const foldersCreated: string[] = [];
    for (const fp of sortedFolderPaths) {
      try {
        await ensureFolderPath(fp);
        foldersCreated.push(fp);
      } catch {
        // folder may already exist
      }
    }

    const maxConcurrency = Math.min(concurrency || 5, 10);
    const results: {
      file: string;
      relativePath: string;
      success: boolean;
      node_id?: number;
      folder_id?: number;
      error?: string;
    }[] = [];
    const startTime = Date.now();

    for (let i = 0; i < filesToUpload.length; i += maxConcurrency) {
      const batch = filesToUpload.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async ({ fullPath, relativePath }) => {
        try {
          const relativeFolderPath = path.dirname(relativePath);
          const targetFolderId =
            folderCache.get(relativeFolderPath === '.' ? '' : relativeFolderPath) || rootFolderId;
          const buffer = fs.readFileSync(fullPath);
          const fileName = path.basename(fullPath);
          const mimeType = getMimeType(fullPath);
          const result = await client.uploadDocument(targetFolderId, fileName, buffer, mimeType);
          if (category_id && result.id) {
            try {
              await client.addCategory(result.id, category_id, category_values);
            } catch (catError) {
              return {
                file: fileName,
                relativePath,
                success: true,
                node_id: result.id,
                folder_id: targetFolderId,
                category_error: String(catError),
              };
            }
          }
          return {
            file: fileName,
            relativePath,
            success: true,
            node_id: result.id,
            folder_id: targetFolderId,
          };
        } catch (error) {
          return {
            file: path.basename(fullPath),
            relativePath,
            success: false,
            error: String(error),
          };
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const elapsed = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    return {
      success: true,
      uploaded: successful,
      failed: failed.length,
      total_files: filesToUpload.length,
      root_folder: { name: sourceFolderName, id: rootFolderId },
      subfolders_created: foldersCreated.length,
      elapsed_ms: elapsed,
      files_per_second: (successful / (elapsed / 1000)).toFixed(2),
      message: `Created "${sourceFolderName}" folder (ID: ${rootFolderId}) and uploaded ${successful}/${filesToUpload.length} files`,
      structure_preserved: true,
      folder_structure: [
        sourceFolderName,
        ...foldersCreated.map((f) => `${sourceFolderName}/${f}`),
      ],
      results: results.slice(0, 50),
      errors: failed.length > 0 ? failed.slice(0, 10) : undefined,
    };
  },

  otcs_upload_batch: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { parent_id, file_paths, concurrency, category_id, category_values } = args as {
      parent_id: number;
      file_paths: string[];
      concurrency?: number;
      category_id?: number;
      category_values?: Record<string, unknown>;
    };

    if (!file_paths || file_paths.length === 0) throw new Error('file_paths array is required');
    const missingFiles = file_paths.filter((fp) => !fs.existsSync(fp));
    if (missingFiles.length > 0) {
      throw new Error(
        `Files not found: ${missingFiles.slice(0, 5).join(', ')}${missingFiles.length > 5 ? ` and ${missingFiles.length - 5} more` : ''}`,
      );
    }

    const maxConcurrency = Math.min(concurrency || 5, 10);
    const results: {
      file: string;
      success: boolean;
      node_id?: number;
      error?: string;
    }[] = [];
    const startTime = Date.now();

    for (let i = 0; i < file_paths.length; i += maxConcurrency) {
      const batch = file_paths.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async (filePath) => {
        try {
          const buffer = fs.readFileSync(filePath);
          const fileName = path.basename(filePath);
          const mimeType = getMimeType(filePath);
          const result = await client.uploadDocument(parent_id, fileName, buffer, mimeType);
          if (category_id && result.id) {
            try {
              await client.addCategory(result.id, category_id, category_values);
            } catch (catError) {
              return {
                file: fileName,
                success: true,
                node_id: result.id,
                category_error: String(catError),
              };
            }
          }
          return { file: fileName, success: true, node_id: result.id };
        } catch (error) {
          return {
            file: path.basename(filePath),
            success: false,
            error: String(error),
          };
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const elapsed = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    return {
      success: true,
      uploaded: successful,
      failed: failed.length,
      total_files: file_paths.length,
      elapsed_ms: elapsed,
      files_per_second: (successful / (elapsed / 1000)).toFixed(2),
      message: `Uploaded ${successful}/${file_paths.length} files`,
      results,
      errors: failed.length > 0 ? failed : undefined,
    };
  },

  otcs_upload_with_metadata: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      parent_id,
      file_path: filePath,
      content_base64,
      name,
      mime_type,
      description,
      category_id,
      category_values,
      classification_id,
      workflow_id,
    } = args as {
      parent_id: number;
      file_path?: string;
      content_base64?: string;
      name?: string;
      mime_type?: string;
      description?: string;
      category_id?: number;
      category_values?: Record<string, unknown>;
      classification_id?: number;
      workflow_id?: number;
    };

    let buffer: Buffer;
    let fileName: string;
    let mimeType: string;

    if (filePath) {
      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
      buffer = fs.readFileSync(filePath);
      fileName = name || path.basename(filePath);
      mimeType = mime_type || getMimeType(filePath);
    } else if (content_base64) {
      if (!name) throw new Error('name required when using content_base64');
      buffer = Buffer.from(content_base64, 'base64');
      fileName = name;
      mimeType = mime_type || 'application/octet-stream';
    } else {
      throw new Error('Either file_path or content_base64 is required');
    }

    const uploadResult = await client.uploadDocument(
      parent_id,
      fileName,
      buffer,
      mimeType,
      description,
    );
    const nodeId = uploadResult.id;

    const operations: {
      operation: string;
      success: boolean;
      error?: string;
    }[] = [];
    operations.push({ operation: 'upload', success: true });

    if (category_id) {
      try {
        await client.addCategory(nodeId, category_id, category_values);
        operations.push({ operation: 'add_category', success: true });
      } catch (error) {
        operations.push({
          operation: 'add_category',
          success: false,
          error: String(error),
        });
      }
    }

    if (classification_id) {
      try {
        await client.applyRMClassification({
          node_id: nodeId,
          class_id: classification_id,
        });
        operations.push({ operation: 'rm_classification', success: true });
      } catch (error) {
        operations.push({
          operation: 'rm_classification',
          success: false,
          error: String(error),
        });
      }
    }

    let workflowResult: { work_id?: number } | undefined;
    if (workflow_id) {
      try {
        workflowResult = await client.startWorkflow(workflow_id, nodeId.toString());
        operations.push({ operation: 'start_workflow', success: true });
      } catch (error) {
        operations.push({
          operation: 'start_workflow',
          success: false,
          error: String(error),
        });
      }
    }

    return {
      success: true,
      document: uploadResult,
      node_id: nodeId,
      size_bytes: buffer.length,
      operations,
      workflow_instance_id: workflowResult?.work_id,
      message: `"${fileName}" uploaded with ID ${nodeId}. ${operations.length} operation(s) completed.`,
    };
  },

  otcs_versions: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      node_id,
      file_path: filePath,
      content_base64,
      mime_type,
      file_name,
      description,
    } = args as {
      action: string;
      node_id: number;
      file_path?: string;
      content_base64?: string;
      mime_type?: string;
      file_name?: string;
      description?: string;
    };
    if (action === 'list') {
      const versions = await client.getVersions(node_id);
      return { node_id, versions, version_count: versions.length };
    } else if (action === 'add') {
      let buffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (filePath) {
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        buffer = fs.readFileSync(filePath);
        fileName = file_name || path.basename(filePath);
        mimeType = mime_type || getMimeType(filePath);
      } else if (content_base64) {
        if (!file_name) throw new Error('file_name required when using content_base64');
        buffer = Buffer.from(content_base64, 'base64');
        fileName = file_name;
        mimeType = mime_type || 'application/octet-stream';
      } else {
        throw new Error('Either file_path or content_base64 is required for add');
      }

      const result = await client.addVersion(node_id, buffer, mimeType, fileName, description);
      return {
        success: true,
        version: result,
        message: `New version added to ${node_id}`,
        size_bytes: buffer.length,
      };
    }
    throw new Error(`Unknown action: ${action}`);
  },
};
