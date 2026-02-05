/**
 * Discovery module — Scans source/destination and builds diff manifest.
 * Handles both local filesystem and OTCS scanning.
 */

import * as fs from "fs";
import * as path from "path";
import { OTCSClient } from "../src/client/otcs-client.js";
import { MigrationJob, expandPath } from "./config.js";
import { log, logPhase } from "./logger.js";

// ── MIME types ──────────────────────────────────────────────────────────
export const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
  ".msg": "application/vnd.ms-outlook",
  ".eml": "message/rfc822",
};

export function getMimeType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

// ── Local file entry ────────────────────────────────────────────────────
export interface LocalFileEntry {
  type: "local";
  fullPath: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedDate: Date;
  mimeType: string;
  isDirectory: boolean;
}

// ── OTCS file entry ─────────────────────────────────────────────────────
export interface OTCSFileEntry {
  type: "otcs";
  nodeId: number;
  parentId: number;
  relativePath: string;
  name: string;
  size: number;
  modifiedDate: Date;
  mimeType: string;
  isDirectory: boolean;
}

export type FileEntry = LocalFileEntry | OTCSFileEntry;

// ── Manifest item with diff status ──────────────────────────────────────
export interface ManifestItem {
  source: FileEntry;
  dest?: FileEntry;
  status: "new" | "existing" | "modified" | "orphan";
  conflictReason?: string;
}

export interface MigrationManifest {
  job: MigrationJob;
  sourceItems: FileEntry[];
  destItems: FileEntry[];
  items: ManifestItem[];
  summary: {
    totalSource: number;
    totalDest: number;
    new: number;
    existing: number;
    modified: number;
    orphans: number;
    totalBytes: number;
  };
}

// ── Local filesystem scanning ───────────────────────────────────────────
export function scanLocalDirectory(
  dir: string,
  basePath: string,
  extensions: string[],
  recursive: boolean
): LocalFileEntry[] {
  const files: LocalFileEntry[] = [];

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory does not exist: ${dir}`);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      // Add directory entry
      const stat = fs.statSync(fullPath);
      files.push({
        type: "local",
        fullPath,
        relativePath,
        name: entry.name,
        size: 0,
        modifiedDate: stat.mtime,
        mimeType: "inode/directory",
        isDirectory: true,
      });

      // Recurse if needed
      if (recursive) {
        files.push(...scanLocalDirectory(fullPath, basePath, extensions, recursive));
      }
    } else if (entry.isFile()) {
      // Filter by extension if specified
      if (extensions.length > 0) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extensions.includes(ext)) continue;
      }

      const stat = fs.statSync(fullPath);
      files.push({
        type: "local",
        fullPath,
        relativePath,
        name: entry.name,
        size: stat.size,
        modifiedDate: stat.mtime,
        mimeType: getMimeType(fullPath),
        isDirectory: false,
      });
    }
  }

  return files;
}

// ── OTCS scanning ───────────────────────────────────────────────────────
export async function scanOTCSFolder(
  client: OTCSClient,
  nodeId: number,
  basePath: string,
  recursive: boolean
): Promise<OTCSFileEntry[]> {
  const files: OTCSFileEntry[] = [];

  // Get all items in this folder (paginated)
  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await client.getSubnodes(nodeId, { page, limit });

    for (const item of result.items) {
      const relativePath = basePath ? `${basePath}/${item.name}` : item.name;
      const isDirectory = item.type === 0; // Type 0 = Folder in OTCS

      files.push({
        type: "otcs",
        nodeId: item.id,
        parentId: nodeId,
        relativePath,
        name: item.name,
        size: item.size || 0,
        modifiedDate: item.modify_date ? new Date(item.modify_date) : new Date(),
        mimeType: item.mime_type || "application/octet-stream",
        isDirectory,
      });

      // Recurse into subfolders
      if (isDirectory && recursive) {
        const subFiles = await scanOTCSFolder(client, item.id, relativePath, recursive);
        files.push(...subFiles);
      }
    }

    hasMore = result.paging.page < result.paging.page_total;
    page++;
  }

  return files;
}

// ── Compute diff manifest ───────────────────────────────────────────────
function computeDiff(
  sourceItems: FileEntry[],
  destItems: FileEntry[]
): ManifestItem[] {
  const items: ManifestItem[] = [];

  // Build a map of destination items by relative path
  const destMap = new Map<string, FileEntry>();
  for (const dest of destItems) {
    destMap.set(dest.relativePath.toLowerCase(), dest);
  }

  // Process source items
  const processedDestPaths = new Set<string>();

  for (const source of sourceItems) {
    const key = source.relativePath.toLowerCase();
    const dest = destMap.get(key);

    if (!dest) {
      // New item (source only)
      items.push({ source, status: "new" });
    } else {
      processedDestPaths.add(key);

      // Check if modified (compare size and date)
      const sizeMatch = source.size === dest.size;
      const sourceTime = source.modifiedDate.getTime();
      const destTime = dest.modifiedDate.getTime();
      // Allow 1 second tolerance for date comparison
      const dateMatch = Math.abs(sourceTime - destTime) < 1000;

      if (sizeMatch && dateMatch) {
        items.push({ source, dest, status: "existing" });
      } else {
        items.push({
          source,
          dest,
          status: "modified",
          conflictReason: !sizeMatch
            ? `Size mismatch: source=${source.size}, dest=${dest.size}`
            : `Date mismatch: source=${source.modifiedDate.toISOString()}, dest=${dest.modifiedDate.toISOString()}`,
        });
      }
    }
  }

  // Find orphans (dest only)
  for (const dest of destItems) {
    const key = dest.relativePath.toLowerCase();
    if (!processedDestPaths.has(key)) {
      // Create a synthetic source entry for orphans
      items.push({
        source: dest,
        dest,
        status: "orphan",
      });
    }
  }

  return items;
}

// ── Main discovery function ─────────────────────────────────────────────
export async function discover(
  client: OTCSClient,
  job: MigrationJob
): Promise<MigrationManifest> {
  logPhase({ phase: "discover", status: "start", summary: `Discovering files for job: ${job.name}` });

  let sourceItems: FileEntry[];
  let destItems: FileEntry[];

  const extensions = (job.extensions || []).map((e) =>
    e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
  );

  if (job.direction === "local-to-otcs") {
    // Source is local, destination is OTCS
    const sourcePath = expandPath(job.source);
    log(`Scanning local source: ${sourcePath}`);
    sourceItems = scanLocalDirectory(sourcePath, sourcePath, extensions, job.recursive);

    const destId = job.destination as number;
    log(`Scanning OTCS destination: ${destId}`);
    destItems = await scanOTCSFolder(client, destId, "", job.recursive);
  } else {
    // Source is OTCS, destination is local
    const sourceId = job.source as number;
    log(`Scanning OTCS source: ${sourceId}`);
    sourceItems = await scanOTCSFolder(client, sourceId, "", job.recursive);

    const destPath = expandPath(job.destination);
    log(`Scanning local destination: ${destPath}`);
    if (fs.existsSync(destPath)) {
      destItems = scanLocalDirectory(destPath, destPath, extensions, job.recursive);
    } else {
      destItems = [];
    }
  }

  // Filter out directories for the diff (we only care about files for transfer)
  const sourceFiles = sourceItems.filter((f) => !f.isDirectory);
  const destFiles = destItems.filter((f) => !f.isDirectory);

  // Compute diff
  const items = computeDiff(sourceFiles, destFiles);

  // Compute summary
  const summary = {
    totalSource: sourceFiles.length,
    totalDest: destFiles.length,
    new: items.filter((i) => i.status === "new").length,
    existing: items.filter((i) => i.status === "existing").length,
    modified: items.filter((i) => i.status === "modified").length,
    orphans: items.filter((i) => i.status === "orphan").length,
    totalBytes: sourceFiles.reduce((sum, f) => sum + f.size, 0),
  };

  log(`Discovery complete: ${summary.new} new, ${summary.existing} existing, ${summary.modified} modified, ${summary.orphans} orphans`);
  logPhase({
    phase: "discover",
    status: "complete",
    summary: `Found ${summary.totalSource} source files, ${summary.totalDest} dest files`,
    details: summary,
  });

  return {
    job,
    sourceItems,
    destItems,
    items,
    summary,
  };
}
