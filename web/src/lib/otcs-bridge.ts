/**
 * Bridge to OTCS tools — parameterized handleToolCall.
 * Copied from src/index.ts:809-1993 with auth cases removed
 * and client passed as parameter instead of module-level singleton.
 */

import { OTCSClient } from "@otcs/client";
import { NodeTypes } from "@otcs/types";
import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");
import { execFile } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execFileAsync = promisify(execFile);

// MIME type detection (from index.ts:2024-2036)
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".html": "text/html",
    ".xml": "application/xml",
    ".json": "application/json",
    ".md": "text/markdown",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".zip": "application/zip",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// Error suggestions (from index.ts:2039-2045)
export function getSuggestion(error: string): string {
  if (error.includes("401") || error.includes("Authentication"))
    return "Session may have expired. Try re-authenticating.";
  if (error.includes("404") || error.includes("not found"))
    return "Node may have been deleted or moved.";
  if (error.includes("403") || error.includes("permission"))
    return "Insufficient permissions for this operation.";
  if (error.includes("already exists"))
    return "An item with this name already exists.";
  return "Check the error message for details.";
}

// Text content extraction for common document types
const TEXT_MIME_TYPES = new Set([
  "text/plain", "text/csv", "text/html", "text/xml", "text/markdown",
  "application/json", "application/xml", "application/javascript",
  "application/x-yaml", "text/yaml",
]);

async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ text: string; method: string } | null> {
  const MAX_TEXT_LENGTH = 100_000; // ~100k chars to keep context manageable

  try {
    // Plain text formats — decode directly
    if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith("text/")) {
      const text = buffer.toString("utf-8").slice(0, MAX_TEXT_LENGTH);
      return { text, method: "direct" };
    }

    // PDF
    if (mimeType === "application/pdf") {
      const result = await pdfParse(buffer);
      return { text: result.text.slice(0, MAX_TEXT_LENGTH), method: "pdf-parse" };
    }

    // Word .docx
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value.slice(0, MAX_TEXT_LENGTH), method: "mammoth" };
    }

    // Legacy .doc — mammoth can sometimes handle these too
    if (mimeType === "application/msword" || fileName.endsWith(".doc")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        if (result.value.length > 0) {
          return { text: result.value.slice(0, MAX_TEXT_LENGTH), method: "mammoth" };
        }
      } catch {
        // Fall through — .doc not always supported
      }
    }

    // TIFF / TIF images — OCR via native tesseract CLI
    if (
      mimeType === "image/tiff" ||
      fileName.endsWith(".tif") ||
      fileName.endsWith(".tiff")
    ) {
      const tmpFile = path.join(os.tmpdir(), `ocr-${Date.now()}.tif`);
      try {
        fs.writeFileSync(tmpFile, buffer);
        // tesseract <input> stdout  →  prints OCR text to stdout
        const { stdout } = await execFileAsync("tesseract", [tmpFile, "stdout"], {
          timeout: 120_000,
        });
        const text = stdout.trim();
        if (text.length > 0) {
          return { text: text.slice(0, MAX_TEXT_LENGTH), method: "tesseract-ocr" };
        }
        return { text: "[OCR completed but no text detected in image]", method: "tesseract-ocr" };
      } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
      }
    }
  } catch (err: any) {
    return { text: `[Text extraction failed: ${err.message}]`, method: "error" };
  }

  return null; // Unsupported format
}

/**
 * Execute an OTCS tool call using the provided client.
 * Copied from index.ts handleToolCall, minus auth cases.
 */
export async function handleToolCall(
  client: OTCSClient,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    // ==================== Navigation ====================
    case "otcs_get_node": {
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
    }

    case "otcs_browse": {
      const { folder_id, page, page_size, filter_type, sort } = args as {
        folder_id: number;
        page?: number;
        page_size?: number;
        filter_type?: string;
        sort?: string;
      };
      let where_type: number[] | undefined;
      if (filter_type === "folders") where_type = [NodeTypes.FOLDER];
      else if (filter_type === "documents") where_type = [NodeTypes.DOCUMENT];
      return await client.getSubnodes(folder_id, {
        page: page || 1,
        limit: page_size || 100,
        sort,
        where_type,
      });
    }

    case "otcs_search": {
      const params = args as {
        query: string;
        filter_type?:
          | "all"
          | "documents"
          | "folders"
          | "workspaces"
          | "workflows";
        location_id?: number;
        mode?: "allwords" | "anywords" | "exactphrase" | "complexquery";
        search_in?: "all" | "content" | "metadata";
        modifier?:
          | "synonymsof"
          | "relatedto"
          | "soundslike"
          | "wordbeginswith"
          | "wordendswith";
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
    }

    // ==================== Folders ====================
    case "otcs_create_folder": {
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
    }

    // ==================== Node Operations ====================
    case "otcs_node_action": {
      const { action, node_id, destination_id, new_name, description } = args as {
        action: string;
        node_id: number;
        destination_id?: number;
        new_name?: string;
        description?: string;
      };
      switch (action) {
        case "copy":
          if (!destination_id)
            throw new Error("destination_id required for copy");
          const copied = await client.copyNode(
            node_id,
            destination_id,
            new_name
          );
          return {
            success: true,
            new_node: copied,
            message: `Node copied. New ID: ${copied.id}`,
          };
        case "move":
          if (!destination_id)
            throw new Error("destination_id required for move");
          const moved = await client.moveNode(node_id, destination_id);
          return {
            success: true,
            node: moved,
            message: `Node ${node_id} moved to ${destination_id}`,
          };
        case "rename":
          if (!new_name) throw new Error("new_name required for rename");
          const renamed = await client.renameNode(node_id, new_name);
          return {
            success: true,
            node: renamed,
            message: `Node renamed to "${new_name}"`,
          };
        case "delete":
          await client.deleteNode(node_id);
          return { success: true, message: `Node ${node_id} deleted` };
        case "update_description":
          if (description === undefined)
            throw new Error("description required for update_description");
          const updated = await client.updateNodeDescription(node_id, description);
          return {
            success: true,
            node: updated,
            message: `Description updated for node ${node_id}`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Documents ====================
    case "otcs_upload": {
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
        if (!fs.existsSync(filePath))
          throw new Error(`File not found: ${filePath}`);
        buffer = fs.readFileSync(filePath);
        fileName = name || path.basename(filePath);
        mimeType = mime_type || getMimeType(filePath);
      } else if (content_base64) {
        if (!name) throw new Error("name required when using content_base64");
        buffer = Buffer.from(content_base64, "base64");
        fileName = name;
        mimeType = mime_type || "application/octet-stream";
      } else {
        throw new Error("Either file_path or content_base64 is required");
      }

      const result = await client.uploadDocument(
        parent_id,
        fileName,
        buffer,
        mimeType,
        description
      );
      return {
        success: true,
        document: result,
        message: `"${fileName}" uploaded with ID ${result.id}`,
        size_bytes: buffer.length,
      };
    }

    case "otcs_download_content": {
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
        result.content_base64 = buf.toString("base64");
        result.note = "Binary content — text extraction not available for this format.";
      }

      return result;
    }

    case "otcs_upload_folder": {
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

      if (!fs.existsSync(folder_path))
        throw new Error(`Folder not found: ${folder_path}`);
      if (!fs.statSync(folder_path).isDirectory())
        throw new Error(`Path is not a directory: ${folder_path}`);

      const baseFolderPath = path.resolve(folder_path);
      const sourceFolderName = path.basename(baseFolderPath);

      let rootFolderId: number;
      try {
        const existingFolder = await client.findChildByName(
          parent_id,
          sourceFolderName
        );
        if (existingFolder) {
          rootFolderId = existingFolder.id;
        } else {
          const createdFolder = await client.createFolder(
            parent_id,
            sourceFolderName
          );
          rootFolderId = createdFolder.id;
        }
      } catch (error) {
        throw new Error(
          `Failed to create root folder "${sourceFolderName}": ${error}`
        );
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
              if (!extensions.map((e) => e.toLowerCase()).includes(ext))
                continue;
            }
            if (!entry.name.startsWith(".")) {
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
          message: "No files found to upload",
          folder_path,
          root_folder: { name: sourceFolderName, id: rootFolderId },
          extensions,
        };
      }

      const folderCache: Map<string, number> = new Map();
      folderCache.set("", rootFolderId);

      const ensureFolderPath = async (
        relativeFolderPath: string
      ): Promise<number> => {
        if (relativeFolderPath === "" || relativeFolderPath === ".")
          return rootFolderId;
        if (folderCache.has(relativeFolderPath))
          return folderCache.get(relativeFolderPath)!;
        const result = await client.createFolderPath(
          rootFolderId,
          relativeFolderPath
        );
        const pathParts = relativeFolderPath.split(path.sep);
        let cumulativePath = "";
        for (let i = 0; i < pathParts.length; i++) {
          cumulativePath =
            i === 0 ? pathParts[i] : path.join(cumulativePath, pathParts[i]);
          if (result.folders[i]) {
            folderCache.set(cumulativePath, result.folders[i].id);
          }
        }
        return result.leafId;
      };

      const uniqueFolderPaths = new Set<string>();
      for (const file of filesToUpload) {
        const fp = path.dirname(file.relativePath);
        if (fp !== "" && fp !== ".") uniqueFolderPaths.add(fp);
      }
      const sortedFolderPaths = Array.from(uniqueFolderPaths).sort(
        (a, b) => a.split(path.sep).length - b.split(path.sep).length
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
              folderCache.get(
                relativeFolderPath === "." ? "" : relativeFolderPath
              ) || rootFolderId;
            const buffer = fs.readFileSync(fullPath);
            const fileName = path.basename(fullPath);
            const mimeType = getMimeType(fullPath);
            const result = await client.uploadDocument(
              targetFolderId,
              fileName,
              buffer,
              mimeType
            );
            if (category_id && result.id) {
              try {
                await client.addCategory(
                  result.id,
                  category_id,
                  category_values
                );
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
    }

    case "otcs_upload_batch": {
      const {
        parent_id,
        file_paths,
        concurrency,
        category_id,
        category_values,
      } = args as {
        parent_id: number;
        file_paths: string[];
        concurrency?: number;
        category_id?: number;
        category_values?: Record<string, unknown>;
      };

      if (!file_paths || file_paths.length === 0)
        throw new Error("file_paths array is required");
      const missingFiles = file_paths.filter((fp) => !fs.existsSync(fp));
      if (missingFiles.length > 0) {
        throw new Error(
          `Files not found: ${missingFiles.slice(0, 5).join(", ")}${missingFiles.length > 5 ? ` and ${missingFiles.length - 5} more` : ""}`
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
            const result = await client.uploadDocument(
              parent_id,
              fileName,
              buffer,
              mimeType
            );
            if (category_id && result.id) {
              try {
                await client.addCategory(
                  result.id,
                  category_id,
                  category_values
                );
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
    }

    case "otcs_upload_with_metadata": {
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
        if (!fs.existsSync(filePath))
          throw new Error(`File not found: ${filePath}`);
        buffer = fs.readFileSync(filePath);
        fileName = name || path.basename(filePath);
        mimeType = mime_type || getMimeType(filePath);
      } else if (content_base64) {
        if (!name) throw new Error("name required when using content_base64");
        buffer = Buffer.from(content_base64, "base64");
        fileName = name;
        mimeType = mime_type || "application/octet-stream";
      } else {
        throw new Error("Either file_path or content_base64 is required");
      }

      const uploadResult = await client.uploadDocument(
        parent_id,
        fileName,
        buffer,
        mimeType,
        description
      );
      const nodeId = uploadResult.id;

      const operations: {
        operation: string;
        success: boolean;
        error?: string;
      }[] = [];
      operations.push({ operation: "upload", success: true });

      if (category_id) {
        try {
          await client.addCategory(nodeId, category_id, category_values);
          operations.push({ operation: "add_category", success: true });
        } catch (error) {
          operations.push({
            operation: "add_category",
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
          operations.push({ operation: "rm_classification", success: true });
        } catch (error) {
          operations.push({
            operation: "rm_classification",
            success: false,
            error: String(error),
          });
        }
      }

      let workflowResult: { work_id?: number } | undefined;
      if (workflow_id) {
        try {
          workflowResult = await client.startWorkflow(
            workflow_id,
            nodeId.toString()
          );
          operations.push({ operation: "start_workflow", success: true });
        } catch (error) {
          operations.push({
            operation: "start_workflow",
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
    }

    // ==================== Versions ====================
    case "otcs_versions": {
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
      if (action === "list") {
        const versions = await client.getVersions(node_id);
        return { node_id, versions, version_count: versions.length };
      } else if (action === "add") {
        let buffer: Buffer;
        let fileName: string;
        let mimeType: string;

        if (filePath) {
          if (!fs.existsSync(filePath))
            throw new Error(`File not found: ${filePath}`);
          buffer = fs.readFileSync(filePath);
          fileName = file_name || path.basename(filePath);
          mimeType = mime_type || getMimeType(filePath);
        } else if (content_base64) {
          if (!file_name)
            throw new Error("file_name required when using content_base64");
          buffer = Buffer.from(content_base64, "base64");
          fileName = file_name;
          mimeType = mime_type || "application/octet-stream";
        } else {
          throw new Error(
            "Either file_path or content_base64 is required for add"
          );
        }

        const result = await client.addVersion(
          node_id,
          buffer,
          mimeType,
          fileName,
          description
        );
        return {
          success: true,
          version: result,
          message: `New version added to ${node_id}`,
          size_bytes: buffer.length,
        };
      }
      throw new Error(`Unknown action: ${action}`);
    }

    // ==================== Workspaces ====================
    case "otcs_workspace_types": {
      const { action, template_id } = args as {
        action?: string;
        template_id?: number;
      };
      if (action === "get_form") {
        if (!template_id)
          throw new Error("template_id required for get_form");
        const form = await client.getWorkspaceForm(template_id);
        return { template_id, schema: form };
      }
      const types = await client.getWorkspaceTypes();
      return { workspace_types: types, count: types.length };
    }

    case "otcs_create_workspace": {
      const { template_id, name, parent_id, description, business_properties } =
        args as {
          template_id: number;
          name: string;
          parent_id?: number;
          description?: string;
          business_properties?: Record<string, unknown>;
        };
      const workspace = await client.createWorkspace({
        template_id,
        name,
        parent_id,
        description,
        business_properties,
      });
      return {
        success: true,
        workspace,
        message: `Workspace "${name}" created with ID ${workspace.id}`,
      };
    }

    case "otcs_get_workspace": {
      const { workspace_id, find_for_node } = args as {
        workspace_id?: number;
        find_for_node?: number;
      };
      if (find_for_node) {
        const workspace = await client.findWorkspaceRoot(find_for_node);
        return workspace
          ? { found: true, workspace }
          : {
              found: false,
              message: `No workspace found for node ${find_for_node}`,
            };
      }
      if (!workspace_id)
        throw new Error("Either workspace_id or find_for_node required");
      return await client.getWorkspace(workspace_id);
    }

    case "otcs_search_workspaces": {
      const params = args as any;
      return await client.searchWorkspaces(params);
    }

    // ==================== Workspace Relations ====================
    case "otcs_workspace_relations": {
      const {
        action,
        workspace_id,
        related_workspace_id,
        relation_id,
        relation_type,
      } = args as {
        action: string;
        workspace_id: number;
        related_workspace_id?: number;
        relation_id?: number;
        relation_type?: string;
      };
      switch (action) {
        case "list":
          const relations = await client.getWorkspaceRelations(workspace_id);
          return { workspace_id, relations, count: relations.length };
        case "add":
          if (!related_workspace_id)
            throw new Error("related_workspace_id required for add");
          const newRelation = await client.addWorkspaceRelation(
            workspace_id,
            related_workspace_id,
            relation_type
          );
          return {
            success: true,
            relation: newRelation,
            message: `Workspace ${related_workspace_id} linked to ${workspace_id}`,
          };
        case "remove":
          if (!relation_id)
            throw new Error("relation_id required for remove");
          await client.removeWorkspaceRelation(workspace_id, relation_id);
          return { success: true, message: `Relation ${relation_id} removed` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Workspace Roles ====================
    case "otcs_workspace_roles": {
      const { action, workspace_id, role_id, member_id } = args as {
        action: string;
        workspace_id: number;
        role_id?: number;
        member_id?: number;
      };
      switch (action) {
        case "get_roles":
          const roles = await client.getWorkspaceRoles(workspace_id);
          return { workspace_id, roles, count: roles.length };
        case "get_members":
          const members = await client.getWorkspaceMembers(workspace_id);
          return { workspace_id, members, count: members.length };
        case "get_role_members":
          if (!role_id) throw new Error("role_id required");
          const roleMembers = await client.getRoleMembers(
            workspace_id,
            role_id
          );
          return {
            workspace_id,
            role_id,
            members: roleMembers,
            count: roleMembers.length,
          };
        case "add_member":
          if (!role_id || !member_id)
            throw new Error("role_id and member_id required");
          await client.addRoleMember(workspace_id, role_id, member_id);
          return {
            success: true,
            message: `Member ${member_id} added to role ${role_id}`,
          };
        case "remove_member":
          if (!role_id || !member_id)
            throw new Error("role_id and member_id required");
          await client.removeRoleMember(workspace_id, role_id, member_id);
          return {
            success: true,
            message: `Member ${member_id} removed from role ${role_id}`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Workflows ====================
    case "otcs_get_assignments": {
      const assignments = await client.getAssignments();
      return {
        assignments,
        count: assignments.length,
        message:
          assignments.length > 0
            ? `Found ${assignments.length} pending task(s)`
            : "No pending tasks",
      };
    }

    case "otcs_workflow_status": {
      const {
        mode,
        status,
        kind,
        map_id,
        search_name,
        business_workspace_id,
        start_date,
        end_date,
        wfretention,
      } = args as any;
      if (mode === "active") {
        const workflows = await client.getActiveWorkflows({
          map_id,
          search_name,
          business_workspace_id,
          start_date,
          end_date,
          status,
          kind,
        });
        return {
          workflows,
          count: workflows.length,
          filters: { map_id, status, kind },
        };
      }
      const workflows = await client.getWorkflowStatus({
        wstatus: status,
        kind,
        wfretention,
      });
      return { workflows, count: workflows.length, filters: { status, kind } };
    }

    case "otcs_workflow_definition": {
      const { map_id } = args as { map_id: number };
      const definition = await client.getWorkflowDefinition(map_id);
      return {
        definition,
        task_count: definition.tasks?.length || 0,
        data_package_count: definition.data_packages?.length || 0,
      };
    }

    case "otcs_workflow_tasks": {
      const { process_id } = args as { process_id: number };
      const taskList = await client.getWorkflowTasks(process_id);
      return {
        ...taskList,
        summary: {
          completed: taskList.tasks?.completed?.length || 0,
          current: taskList.tasks?.current?.length || 0,
          next: taskList.tasks?.next?.length || 0,
        },
      };
    }

    case "otcs_workflow_activities": {
      const { process_id, subprocess_id, limit } = args as {
        process_id: number;
        subprocess_id: number;
        limit?: number;
      };
      const activities = await client.getWorkflowActivities(
        process_id,
        subprocess_id,
        limit
      );
      return { activities, count: activities.length };
    }

    case "otcs_start_workflow": {
      const { mode, workflow_id, doc_ids, role_info, attach_documents } =
        args as {
          mode?: string;
          workflow_id: number;
          doc_ids?: string;
          role_info?: Record<string, number>;
          attach_documents?: boolean;
        };
      const startMode = mode || "direct";
      if (startMode === "draft") {
        const result = await client.createDraftWorkflow(
          workflow_id,
          doc_ids,
          attach_documents ?? true
        );
        return {
          success: true,
          draftprocess_id: result.draftprocess_id,
          workflow_type: result.workflow_type,
          message: `Draft workflow created with ID ${result.draftprocess_id}`,
        };
      } else if (startMode === "initiate") {
        const result = await client.initiateWorkflow({
          workflow_id,
          role_info,
        });
        return {
          success: true,
          work_id: result.work_id,
          workflow_id: result.workflow_id,
          message: `Workflow initiated with instance ID ${result.work_id}`,
        };
      } else {
        const result = await client.startWorkflow(workflow_id, doc_ids);
        return {
          success: true,
          work_id: result.work_id,
          message: `Workflow started with instance ID ${result.work_id}`,
        };
      }
    }

    case "otcs_workflow_form": {
      const { process_id, subprocess_id, task_id, detailed } = args as {
        process_id: number;
        subprocess_id: number;
        task_id: number;
        detailed?: boolean;
      };

      if (detailed) {
        const formInfo = await client.getWorkflowTaskFormFull(
          process_id,
          subprocess_id,
          task_id
        );
        const fields: Record<string, any> = {};
        for (const form of formInfo.forms) {
          if (form.schema?.properties) {
            for (const [key, prop] of Object.entries(form.schema.properties)) {
              fields[key] = {
                type: prop.type || "string",
                label: form.options?.fields?.[key]?.label,
                required: form.schema.required?.includes(key),
                readonly:
                  prop.readonly || form.options?.fields?.[key]?.readonly,
              };
            }
          }
        }
        return {
          title: formInfo.data.title,
          instructions: formInfo.data.instructions,
          priority: formInfo.data.priority,
          comments_enabled: formInfo.data.comments_on,
          attachments_enabled: formInfo.data.attachments_on,
          requires_accept: formInfo.data.member_accept,
          requires_authentication: formInfo.data.authentication,
          actions:
            formInfo.data.actions?.map((a: any) => ({
              key: a.key,
              label: a.label,
            })) || [],
          custom_actions:
            formInfo.data.custom_actions?.map((a: any) => ({
              key: a.key,
              label: a.label,
            })) || [],
          fields,
          form_count: formInfo.forms.length,
          raw_forms: formInfo.forms,
        };
      }

      const form = await client.getWorkflowTaskForm(
        process_id,
        subprocess_id,
        task_id
      );
      return {
        form,
        available_actions: form.actions?.map((a: any) => a.key) || [],
        custom_actions: form.custom_actions?.map((a: any) => a.key) || [],
      };
    }

    case "otcs_workflow_task": {
      const {
        action,
        process_id,
        subprocess_id,
        task_id,
        disposition,
        custom_action,
        comment,
        form_data,
      } = args as {
        action?: string;
        process_id: number;
        subprocess_id: number;
        task_id: number;
        disposition?: string;
        custom_action?: string;
        comment?: string;
        form_data?: Record<string, string>;
      };
      const taskAction = action || "send";

      if (taskAction === "check_group") {
        const isGroup = await client.checkGroupAssignment(
          process_id,
          subprocess_id,
          task_id
        );
        return {
          is_group_assignment: isGroup,
          requires_accept: isGroup,
          message: isGroup
            ? "Task is group-assigned. Accept it first."
            : "Task is individually assigned.",
        };
      }

      if (taskAction === "accept") {
        const result = await client.acceptWorkflowTask(
          process_id,
          subprocess_id,
          task_id
        );
        return {
          success: result.success,
          message: result.message || "Task accepted",
          task_id,
          process_id,
        };
      }

      await client.sendWorkflowTask({
        process_id,
        subprocess_id,
        task_id,
        action: disposition,
        custom_action,
        comment,
        form_data,
      });
      const actionDesc = disposition || custom_action || "action";
      return {
        success: true,
        message: `Task ${task_id} completed with ${actionDesc}`,
        details: {
          process_id,
          subprocess_id,
          task_id,
          action: actionDesc,
          comment,
          form_data,
        },
      };
    }

    case "otcs_draft_workflow": {
      const { action, draftprocess_id, values, comment } = args as {
        action: string;
        draftprocess_id: number;
        values?: Record<string, unknown>;
        comment?: string;
      };

      if (action === "get_form") {
        const formInfo = await client.getDraftWorkflowForm(draftprocess_id);
        const fields: Record<string, any> = {};
        for (const form of formInfo.forms) {
          if (form.schema?.properties) {
            for (const [key, prop] of Object.entries(form.schema.properties)) {
              fields[key] = {
                type: prop.type || "string",
                label: form.options?.fields?.[key]?.label,
                required: form.schema.required?.includes(key),
                current_value: form.data?.[key],
              };
            }
          }
        }
        return {
          title: formInfo.data.title,
          instructions: formInfo.data.instructions,
          fields,
          form_count: formInfo.forms.length,
          raw_forms: formInfo.forms,
        };
      }

      if (action === "update_form" || action === "initiate") {
        const updateAction = action === "initiate" ? "Initiate" : "formUpdate";
        await client.updateDraftWorkflowForm({
          draftprocess_id,
          action: updateAction,
          comment,
          values,
        });
        return {
          success: true,
          message:
            action === "initiate"
              ? `Workflow initiated from draft ${draftprocess_id}`
              : `Form updated for draft ${draftprocess_id}`,
          values_updated: values ? Object.keys(values) : [],
        };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    case "otcs_workflow_info": {
      const { work_id } = args as { work_id: number };
      return await client.getWorkflowInfoFull(work_id);
    }

    case "otcs_manage_workflow": {
      const { action, process_id } = args as {
        action: string;
        process_id: number;
      };
      if (action === "delete") {
        await client.deleteWorkflow(process_id);
        return { success: true, message: `Workflow ${process_id} deleted` };
      }
      await client.updateWorkflowStatus(process_id, action as any);
      return {
        success: true,
        message: `Workflow ${process_id} status changed to ${action}`,
      };
    }

    // ==================== Categories ====================
    case "otcs_categories": {
      const { action, node_id, category_id, values, include_metadata, form_mode } =
        args as {
          action: string;
          node_id: number;
          category_id?: number;
          values?: Record<string, unknown>;
          include_metadata?: boolean;
          form_mode?: string;
        };

      switch (action) {
        case "list":
          const result = await client.getCategories(node_id, include_metadata);
          return {
            ...result,
            category_count: result.categories.length,
            message:
              result.categories.length > 0
                ? `Found ${result.categories.length} category(ies)`
                : "No categories applied",
          };
        case "get":
          if (!category_id) throw new Error("category_id required");
          const cat = await client.getCategory(
            node_id,
            category_id,
            include_metadata
          );
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
        case "add":
          if (!category_id) throw new Error("category_id required");
          const added = await client.addCategory(
            node_id,
            category_id,
            values
          );
          return {
            ...added,
            message: `Category ${category_id} added`,
            values_set: values ? Object.keys(values) : [],
          };
        case "update":
          if (!category_id || !values)
            throw new Error("category_id and values required");
          const updated = await client.updateCategory(
            node_id,
            category_id,
            values
          );
          return {
            ...updated,
            message: `Category ${category_id} updated`,
            values_updated: Object.keys(values),
          };
        case "remove":
          if (!category_id) throw new Error("category_id required");
          const removed = await client.removeCategory(node_id, category_id);
          return {
            ...removed,
            message: `Category ${category_id} removed`,
          };
        case "get_form":
          if (!category_id) throw new Error("category_id required");
          const form =
            form_mode === "update"
              ? await client.getCategoryUpdateForm(node_id, category_id)
              : await client.getCategoryCreateForm(node_id, category_id);
          return {
            form,
            attribute_count: form.attributes.length,
            required_attributes: form.attributes
              .filter((a: any) => a.required)
              .map((a: any) => a.key),
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case "otcs_workspace_metadata": {
      const { action, workspace_id, values } = args as {
        action: string;
        workspace_id: number;
        values?: Record<string, unknown>;
      };

      if (action === "get_form") {
        const form = await client.getWorkspaceMetadataForm(workspace_id);
        const totalAttributes = form.categories.reduce(
          (sum: number, cat: any) => sum + cat.attributes.length,
          0
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

      if (action === "update") {
        if (!values) throw new Error("values required for update");
        const result = await client.updateWorkspaceMetadata(
          workspace_id,
          values
        );
        return {
          ...result,
          message: `Workspace ${workspace_id} metadata updated`,
          values_updated: Object.keys(values),
        };
      }

      throw new Error(`Unknown action: ${action}`);
    }

    // ==================== Members ====================
    case "otcs_members": {
      const {
        action,
        member_id,
        user_id,
        group_id,
        type,
        query,
        where_name,
        where_first_name,
        where_last_name,
        where_business_email,
        sort,
        limit,
        page,
      } = args as any;

      switch (action) {
        case "search":
          const searchResult = await client.searchMembers({
            type,
            query,
            where_name,
            where_first_name,
            where_last_name,
            where_business_email,
            sort,
            limit: limit || 100,
            page: page || 1,
          });
          return {
            ...searchResult,
            message: `Found ${searchResult.total_count} member(s)`,
            type_searched:
              type === 0 ? "users" : type === 1 ? "groups" : "all",
          };
        case "get":
          if (!member_id) throw new Error("member_id required");
          const member = await client.getMember(member_id);
          return {
            ...member,
            member_type: member.type === 0 ? "user" : "group",
          };
        case "get_user_groups":
          if (!user_id) throw new Error("user_id required");
          const groupsResult = await client.getUserGroups(user_id, {
            limit: limit || 100,
            page: page || 1,
          });
          return {
            ...groupsResult,
            message: `User ${user_id} belongs to ${groupsResult.total_count} group(s)`,
          };
        case "get_group_members":
          if (!group_id) throw new Error("group_id required");
          const membersResult = await client.getGroupMembers(group_id, {
            limit: limit || 100,
            page: page || 1,
            sort,
          });
          return {
            ...membersResult,
            message: `Group ${group_id} has ${membersResult.total_count} member(s)`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case "otcs_group_membership": {
      const { action, group_id, member_id } = args as {
        action: string;
        group_id: number;
        member_id: number;
      };
      if (action === "add") {
        const result = await client.addMemberToGroup(group_id, member_id);
        return {
          ...result,
          message: `Member ${member_id} added to group ${group_id}`,
        };
      } else if (action === "remove") {
        const result = await client.removeMemberFromGroup(
          group_id,
          member_id
        );
        return {
          ...result,
          message: `Member ${member_id} removed from group ${group_id}`,
        };
      }
      throw new Error(`Unknown action: ${action}`);
    }

    // ==================== Permissions ====================
    case "otcs_permissions": {
      const { action, node_id, right_id, member_id, permissions, apply_to } =
        args as {
          action: string;
          node_id: number;
          right_id?: number;
          member_id?: number;
          permissions?: string[];
          apply_to?: number;
        };
      const targetId = right_id || member_id;

      switch (action) {
        case "get":
          const perms = await client.getNodePermissions(node_id);
          return {
            ...perms,
            summary: {
              has_owner: !!perms.owner,
              has_group: !!perms.group,
              has_public_access: !!perms.public_access,
              custom_permissions_count: perms.custom_permissions.length,
            },
          };
        case "add":
          if (!targetId || !permissions)
            throw new Error("right_id and permissions required");
          const addResult = await client.addCustomPermission(
            node_id,
            targetId,
            permissions as any,
            { apply_to: apply_to as any }
          );
          return {
            ...addResult,
            message: `Permissions added for member ${targetId}`,
            permissions_granted: permissions,
          };
        case "update":
          if (!targetId || !permissions)
            throw new Error("right_id and permissions required");
          const updateResult = await client.updateCustomPermission(
            node_id,
            targetId,
            permissions as any,
            { apply_to: apply_to as any }
          );
          return {
            ...updateResult,
            message: `Permissions updated for member ${targetId}`,
            new_permissions: permissions,
          };
        case "remove":
          if (!targetId) throw new Error("right_id required");
          const removeResult = await client.removeCustomPermission(
            node_id,
            targetId,
            { apply_to: apply_to as any }
          );
          return {
            ...removeResult,
            message: `Permissions removed for member ${targetId}`,
          };
        case "effective":
          if (!targetId)
            throw new Error("right_id or member_id required");
          const effective = await client.getEffectivePermissions(
            node_id,
            targetId
          );
          return {
            ...effective,
            permission_count: effective.permissions.length,
            has_see: effective.permissions.includes("see"),
            has_modify: effective.permissions.includes("modify"),
            has_delete: effective.permissions.includes("delete"),
            has_edit_permissions:
              effective.permissions.includes("edit_permissions"),
          };
        case "set_owner":
          if (!permissions) throw new Error("permissions required");
          const ownerResult = await client.updateOwnerPermissions(
            node_id,
            permissions as any,
            { right_id: targetId, apply_to: apply_to as any }
          );
          return {
            ...ownerResult,
            message: targetId
              ? `Ownership transferred to ${targetId}`
              : "Owner permissions updated",
            owner_permissions: permissions,
          };
        case "set_public":
          if (!permissions)
            throw new Error(
              "permissions required (use empty array to remove public access)"
            );
          const publicResult = await client.updatePublicPermissions(
            node_id,
            permissions as any,
            { apply_to: apply_to as any }
          );
          return {
            ...publicResult,
            message:
              permissions.length > 0
                ? "Public access updated"
                : "Public access removed",
            public_permissions: permissions,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Records Management ====================
    case "otcs_rm_classification": {
      const {
        action,
        node_id,
        node_ids,
        classification_id,
        name,
        official,
        storage,
        accession,
        subject,
      } = args as {
        action: string;
        node_id?: number;
        node_ids?: number[];
        classification_id?: number;
        name?: string;
        official?: boolean;
        storage?: string;
        accession?: string;
        subject?: string;
      };

      const CLASSIFICATION_VOLUME_ID = 2046;

      switch (action) {
        case "browse_tree":
          const browseId = node_id || CLASSIFICATION_VOLUME_ID;
          const browseResult = await client.getSubnodes(browseId, {
            limit: 100,
          });
          return {
            parent_id: browseId,
            parent_name: browseResult.folder?.name || "Classification Volume",
            classifications: browseResult.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              type_name: item.type_name,
              description: item.description,
              has_children: item.container_size > 0,
              child_count: item.container_size,
            })),
            count: browseResult.items.length,
            message:
              browseId === CLASSIFICATION_VOLUME_ID
                ? `Classification Volume root contains ${browseResult.items.length} item(s).`
                : `Found ${browseResult.items.length} item(s) in classification folder ${browseId}`,
          };
        case "get_node_classifications":
          if (!node_id) throw new Error("node_id required");
          const classResult = await client.getRMClassifications(node_id);
          return {
            node_id,
            classifications: classResult.classifications,
            count: classResult.classifications.length,
          };
        case "declare":
          if (!node_id || !classification_id)
            throw new Error("node_id and classification_id required");
          const declareResult = await client.applyRMClassification({
            node_id,
            class_id: classification_id,
            official,
          });
          return {
            success: true,
            result: declareResult,
            message: `Node ${node_id} declared as record`,
          };
        case "undeclare":
          if (!node_id || !classification_id)
            throw new Error("node_id and classification_id required");
          const undeclareResult = await client.removeRMClassification(
            node_id,
            classification_id
          );
          return {
            success: true,
            result: undeclareResult,
            message: `Record classification removed from node ${node_id}`,
          };
        case "update_details":
          if (!node_id) throw new Error("node_id required");
          const updateResult = await client.updateRMRecordDetails({
            node_id,
            official,
            accession_code: accession,
            comments: subject,
          });
          return {
            success: true,
            result: updateResult,
            message: `Record ${node_id} details updated`,
          };
        case "make_confidential":
          if (!node_id) throw new Error("node_id required");
          const confResult = await client.makeRMConfidential(node_id);
          return {
            success: true,
            result: confResult,
            message: `Node ${node_id} marked as confidential`,
          };
        case "remove_confidential":
          if (!node_id) throw new Error("node_id required");
          const unconfResult = await client.removeRMConfidential(node_id);
          return {
            success: true,
            result: unconfResult,
            message: `Confidential flag removed from node ${node_id}`,
          };
        case "finalize":
          if (!node_id && !node_ids)
            throw new Error("node_id or node_ids required");
          const idsToFinalize = node_ids || [node_id!];
          const finalizeResult =
            await client.finalizeRMRecords(idsToFinalize);
          return {
            success: true,
            result: finalizeResult,
            message: `${idsToFinalize.length} record(s) finalized`,
            node_ids: idsToFinalize,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case "otcs_rm_holds": {
      const {
        action,
        hold_id,
        node_id,
        node_ids,
        user_ids,
        name,
        hold_type,
        comment,
        alternate_id,
      } = args as {
        action: string;
        hold_id?: number;
        node_id?: number;
        node_ids?: number[];
        user_ids?: number[];
        name?: string;
        hold_type?: "Legal" | "Administrative";
        comment?: string;
        alternate_id?: string;
      };

      switch (action) {
        case "list_holds":
          const holdsResult = await client.listRMHolds();
          return {
            holds: holdsResult.holds,
            count: holdsResult.holds.length,
            message: `Found ${holdsResult.holds.length} hold(s)`,
          };
        case "get_hold":
          if (!hold_id) throw new Error("hold_id required");
          const hold = await client.getRMHold(hold_id);
          return { hold, message: `Retrieved hold ${hold_id}` };
        case "create_hold":
          if (!name) throw new Error("name required");
          const newHold = await client.createRMHold({
            name,
            comment,
            type: hold_type,
            alternate_hold_id: alternate_id,
          });
          return {
            success: true,
            hold: newHold,
            message: `Hold "${name}" created`,
          };
        case "update_hold":
          if (!hold_id) throw new Error("hold_id required");
          const updatedHold = await client.updateRMHold(hold_id, {
            name,
            comment,
            alternate_hold_id: alternate_id,
          });
          return {
            success: true,
            hold: updatedHold,
            message: `Hold ${hold_id} updated`,
          };
        case "delete_hold":
          if (!hold_id) throw new Error("hold_id required");
          await client.deleteRMHold(hold_id);
          return { success: true, message: `Hold ${hold_id} deleted` };
        case "get_node_holds":
          if (!node_id) throw new Error("node_id required");
          const nodeHoldsResult = await client.getNodeRMHolds(node_id);
          return {
            node_id,
            holds: nodeHoldsResult.holds,
            count: nodeHoldsResult.holds.length,
          };
        case "apply_hold":
          if (!hold_id || !node_id)
            throw new Error("hold_id and node_id required");
          const applyResult = await client.applyRMHold(node_id, hold_id);
          return {
            success: true,
            result: applyResult,
            message: `Hold ${hold_id} applied to node ${node_id}`,
          };
        case "remove_hold":
          if (!hold_id || !node_id)
            throw new Error("hold_id and node_id required");
          const removeResult = await client.removeRMHold(node_id, hold_id);
          return {
            success: true,
            result: removeResult,
            message: `Hold ${hold_id} removed from node ${node_id}`,
          };
        case "apply_batch":
          if (!hold_id || !node_ids || node_ids.length === 0)
            throw new Error("hold_id and node_ids required");
          const applyBatchResult = await client.applyRMHoldBatch(
            node_ids,
            hold_id
          );
          return {
            success: applyBatchResult.success,
            result: applyBatchResult,
            message: `Hold ${hold_id} applied to ${applyBatchResult.count}/${node_ids.length} node(s)${applyBatchResult.failed.length > 0 ? `, ${applyBatchResult.failed.length} failed` : ""}`,
          };
        case "remove_batch":
          if (!hold_id || !node_ids || node_ids.length === 0)
            throw new Error("hold_id and node_ids required");
          const removeBatchResult = await client.removeRMHoldBatch(
            node_ids,
            hold_id
          );
          return {
            success: removeBatchResult.success,
            result: removeBatchResult,
            message: `Hold ${hold_id} removed from ${removeBatchResult.count}/${node_ids.length} node(s)${removeBatchResult.failed.length > 0 ? `, ${removeBatchResult.failed.length} failed` : ""}`,
          };
        case "get_hold_items":
          if (!hold_id) throw new Error("hold_id required");
          const holdItemsResult = await client.getRMHoldItems(hold_id);
          return {
            hold_id,
            items: holdItemsResult.items,
            count: holdItemsResult.items.length,
            total_count: holdItemsResult.total_count,
          };
        case "get_hold_users":
          if (!hold_id) throw new Error("hold_id required");
          const holdUsersResult = await client.getRMHoldUsers(hold_id);
          return {
            hold_id,
            users: holdUsersResult.users,
            count: holdUsersResult.users.length,
          };
        case "add_hold_users":
          if (!hold_id || !user_ids || user_ids.length === 0)
            throw new Error("hold_id and user_ids required");
          const addUsersResult = await client.addRMHoldUsers(
            hold_id,
            user_ids
          );
          return {
            success: true,
            result: addUsersResult,
            message: `${user_ids.length} user(s) added to hold ${hold_id}`,
          };
        case "remove_hold_users":
          if (!hold_id || !user_ids || user_ids.length === 0)
            throw new Error("hold_id and user_ids required");
          const removeUsersResult = await client.removeRMHoldUsers(
            hold_id,
            user_ids
          );
          return {
            success: true,
            result: removeUsersResult,
            message: `${user_ids.length} user(s) removed from hold ${hold_id}`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case "otcs_rm_xref": {
      const {
        action,
        type_name,
        node_id,
        target_node_id,
        node_ids,
        target_node_ids,
        name,
        reciprocal_name,
      } = args as {
        action: string;
        type_name?: string;
        node_id?: number;
        target_node_id?: number;
        node_ids?: number[];
        target_node_ids?: number[];
        name?: string;
        reciprocal_name?: string;
      };

      switch (action) {
        case "list_types":
          const xrefTypesResult = await client.listRMCrossRefTypes();
          return {
            types: xrefTypesResult.types,
            count: xrefTypesResult.types.length,
          };
        case "get_type":
          if (!type_name) throw new Error("type_name required");
          const xrefType = await client.getRMCrossRefType(type_name);
          return { type: xrefType };
        case "create_type":
          if (!name) throw new Error("name required");
          const newType = await client.createRMCrossRefType(
            name,
            reciprocal_name
          );
          return {
            success: true,
            type: newType,
            message: `Cross-reference type "${name}" created`,
          };
        case "delete_type":
          if (!type_name) throw new Error("type_name required");
          await client.deleteRMCrossRefType(type_name);
          return {
            success: true,
            message: `Cross-reference type "${type_name}" deleted`,
          };
        case "get_node_xrefs":
          if (!node_id) throw new Error("node_id required");
          const nodeXrefsResult = await client.getNodeRMCrossRefs(node_id);
          return {
            node_id,
            cross_references: nodeXrefsResult.cross_references,
            count: nodeXrefsResult.cross_references.length,
          };
        case "apply":
          if (!node_id || !target_node_id || !type_name)
            throw new Error("node_id, target_node_id, and type_name required");
          const applyXrefResult = await client.applyRMCrossRef({
            node_id,
            ref_node_id: target_node_id,
            xref_type: type_name,
          });
          return {
            success: true,
            result: applyXrefResult,
            message: `Cross-reference created between ${node_id} and ${target_node_id}`,
          };
        case "remove":
          if (!node_id || !target_node_id || !type_name)
            throw new Error("node_id, target_node_id, and type_name required");
          const removeXrefResult = await client.removeRMCrossRef(
            node_id,
            type_name,
            target_node_id
          );
          return { success: true, result: removeXrefResult };
        case "apply_batch":
          if (!node_ids || !target_node_ids || !type_name)
            throw new Error(
              "node_ids, target_node_ids, and type_name required"
            );
          if (node_ids.length !== target_node_ids.length)
            throw new Error(
              "node_ids and target_node_ids must have same length"
            );
          const applyBatchResult = await client.applyRMCrossRefBatch(
            node_ids,
            type_name,
            target_node_ids[0]
          );
          return {
            success: true,
            result: applyBatchResult,
            message: `${node_ids.length} cross-reference(s) created`,
          };
        case "remove_batch":
          if (!node_ids || !target_node_ids || !type_name)
            throw new Error(
              "node_ids, target_node_ids, and type_name required"
            );
          if (node_ids.length !== target_node_ids.length)
            throw new Error(
              "node_ids and target_node_ids must have same length"
            );
          const removeBatchResult = await client.removeRMCrossRefBatch(
            node_ids,
            type_name,
            target_node_ids[0]
          );
          return {
            success: true,
            result: removeBatchResult,
            message: `${node_ids.length} cross-reference(s) removed`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    case "otcs_rm_rsi": {
      const {
        action,
        rsi_id,
        node_id,
        class_id,
        stage_id,
        name,
        new_name,
        status,
        status_date,
        description,
        subject,
        title,
        disp_control,
        discontinue,
        discontinue_date,
        discontinue_comment,
        stage,
        object_type,
        event_type,
        date_to_use,
        retention_years,
        retention_months,
        retention_days,
        action_code,
        disposition,
        comment,
        page,
        limit,
      } = args as {
        action: string;
        rsi_id?: number;
        node_id?: number;
        class_id?: number;
        stage_id?: number;
        name?: string;
        new_name?: string;
        status?: string;
        status_date?: string;
        description?: string;
        subject?: string;
        title?: string;
        disp_control?: boolean;
        discontinue?: boolean;
        discontinue_date?: string;
        discontinue_comment?: string;
        stage?: string;
        object_type?: "LIV" | "LRM";
        event_type?: number;
        date_to_use?: number;
        retention_years?: number;
        retention_months?: number;
        retention_days?: number;
        action_code?: number;
        disposition?: string;
        comment?: string;
        page?: number;
        limit?: number;
      };

      switch (action) {
        case "list":
          const listResult = await client.listRMRSIs({ page, limit });
          return {
            rsis: listResult.rsis,
            count: listResult.rsis.length,
            total_count: listResult.total_count,
          };
        case "get":
          if (!rsi_id) throw new Error("rsi_id required");
          const rsi = await client.getRMRSI(rsi_id);
          return {
            rsi,
            schedule_count: rsi.schedules?.length || 0,
          };
        case "create":
          if (!name || !status)
            throw new Error("name and status required");
          const newRsi = await client.createRMRSI({
            name,
            status,
            status_date,
            description,
            subject,
            title,
            disp_control,
          });
          return {
            success: true,
            rsi: newRsi,
            message: `RSI "${name}" created with ID ${newRsi.id}`,
          };
        case "update":
          if (!rsi_id) throw new Error("rsi_id required");
          const updatedRsi = await client.updateRMRSI(rsi_id, {
            new_name,
            status,
            status_date,
            description,
            subject,
            title,
            disp_control,
            discontinue,
            discontinue_date,
            discontinue_comment,
          });
          return {
            success: true,
            rsi: updatedRsi,
            message: `RSI ${rsi_id} updated`,
          };
        case "delete":
          if (!rsi_id) throw new Error("rsi_id required");
          await client.deleteRMRSI(rsi_id);
          return { success: true, message: `RSI ${rsi_id} deleted` };
        case "get_node_rsis":
          if (!node_id) throw new Error("node_id required");
          const nodeRsisResult = await client.getNodeRMRSIs(node_id);
          return {
            node_id,
            rsis: nodeRsisResult.rsis,
            count: nodeRsisResult.rsis.length,
          };
        case "assign":
          if (!node_id || !class_id || !rsi_id)
            throw new Error("node_id, class_id, and rsi_id required");
          await client.assignRMRSI({ node_id, class_id, rsi_id, status_date });
          return {
            success: true,
            message: `RSI ${rsi_id} assigned to node ${node_id}`,
          };
        case "remove":
          if (!node_id || !class_id)
            throw new Error("node_id and class_id required");
          await client.removeRMRSI(node_id, class_id);
          return {
            success: true,
            message: `RSI removed from node ${node_id}`,
          };
        case "get_items":
          if (!rsi_id) throw new Error("rsi_id required");
          const itemsResult = await client.getRMRSIItems(rsi_id, {
            page,
            limit,
          });
          return {
            rsi_id,
            items: itemsResult.items,
            count: itemsResult.items.length,
            total_count: itemsResult.total_count,
          };
        case "get_schedules":
          if (!rsi_id) throw new Error("rsi_id required");
          const schedules = await client.getRMRSISchedules(rsi_id);
          return {
            rsi_id,
            schedules,
            count: schedules.length,
          };
        case "create_schedule":
          if (
            !rsi_id ||
            !stage ||
            !object_type ||
            event_type === undefined
          )
            throw new Error(
              "rsi_id, stage, object_type, and event_type required"
            );
          const newSchedule = await client.createRMRSISchedule({
            rsi_id,
            stage,
            object_type,
            event_type,
            date_to_use,
            retention_years,
            retention_months,
            retention_days,
            action_code,
            disposition,
            description,
          });
          return {
            success: true,
            schedule: newSchedule,
            message: `Schedule stage "${stage}" created for RSI ${rsi_id}`,
          };
        case "approve_schedule":
          if (!rsi_id || !stage_id)
            throw new Error("rsi_id and stage_id required");
          await client.approveRMRSISchedule(rsi_id, stage_id, comment);
          return {
            success: true,
            message: `Schedule stage ${stage_id} approved`,
          };
        case "get_approval_history":
          if (!rsi_id) throw new Error("rsi_id required");
          const history = await client.getRMRSIApprovalHistory(rsi_id);
          return { rsi_id, history, count: history.length };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    // ==================== Sharing ====================
    case "otcs_share": {
      const {
        action,
        node_ids,
        node_id,
        invitees,
        expire_date,
        share_initiator_role,
        sharing_message,
        coordinators,
      } = args as {
        action: string;
        node_ids?: number[];
        node_id?: number;
        invitees?: Array<{
          business_email: string;
          perm: number;
          name?: string;
        }>;
        expire_date?: string;
        share_initiator_role?: number;
        sharing_message?: string;
        coordinators?: number[];
      };

      switch (action) {
        case "list":
          const listResult = await client.listShares();
          return {
            shares: listResult.shares,
            total_count: listResult.total_count,
            message:
              listResult.total_count === 0
                ? "No active shares found"
                : `Found ${listResult.total_count} active share(s)`,
          };
        case "create":
          if (!node_ids || node_ids.length === 0)
            throw new Error("node_ids required");
          const shareResult = await client.createShare({
            node_ids,
            invitees: invitees as any,
            expire_date,
            share_initiator_role: share_initiator_role as any,
            sharing_message,
            coordinators,
          });
          return {
            success: shareResult.success,
            node_ids: shareResult.node_ids,
            partial: shareResult.partial,
            message:
              shareResult.message || `Shared ${node_ids.length} item(s)`,
          };
        case "stop":
          if (!node_id) throw new Error("node_id required");
          const stopResult = await client.stopShare(node_id);
          return {
            success: stopResult.success,
            node_id,
            message: stopResult.message,
          };
        case "stop_batch":
          if (!node_ids || node_ids.length === 0)
            throw new Error("node_ids required");
          const batchResult = await client.stopShareBatch(node_ids);
          return {
            success: batchResult.success,
            count: batchResult.count,
            failed: batchResult.failed,
            message:
              batchResult.failed.length === 0
                ? `Stopped sharing ${batchResult.count} item(s)`
                : `Stopped sharing ${batchResult.count} item(s), ${batchResult.failed.length} failed`,
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
