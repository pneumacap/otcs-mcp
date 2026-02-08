/**
 * Shared utility functions for OTCS tools.
 * Single source of truth — replaces duplicated copies in index.ts, otcs-bridge.ts, ai-orchestrator.ts.
 */

import * as path from 'path';

// ── MIME type detection ──

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ── Error suggestion helper ──

export function getSuggestion(error: string): string {
  if (error.includes('401') || error.includes('Authentication'))
    return 'Session may have expired. Try re-authenticating.';
  if (error.includes('404') || error.includes('not found'))
    return 'Node may have been deleted or moved.';
  if (error.includes('403') || error.includes('permission'))
    return 'Insufficient permissions for this operation.';
  if (error.includes('already exists')) return 'An item with this name already exists.';
  return 'Check the error message for details.';
}

// ── Result compaction (reduces token usage) ──

/** Fields to keep from browse result items */
const BROWSE_KEEP = new Set(['id', 'name', 'type', 'type_name', 'container_size']);

/** Fields to keep from search result items */
const SEARCH_KEEP = new Set([
  'id',
  'name',
  'type',
  'type_name',
  'description',
  'parent_id',
  'summary',
  'highlight_summary',
]);

export function pickKeys(obj: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

/**
 * Compact a tool result to reduce token usage.
 * - Uses compact JSON (no pretty-print)
 * - Strips unnecessary fields from browse/search results
 * - Keeps full results for download_content (user explicitly asked to read)
 */
export function compactToolResult(toolName: string, result: unknown): string {
  if (toolName === 'otcs_browse' && result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.items)) {
      return JSON.stringify({
        ...r,
        items: r.items.map((item: Record<string, unknown>) => pickKeys(item, BROWSE_KEEP)),
      });
    }
  }

  if (toolName === 'otcs_search' && result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.results)) {
      return JSON.stringify({
        total_count: r.total_count,
        results: r.results
          .slice(0, 50)
          .map((item: Record<string, unknown>) => pickKeys(item, SEARCH_KEEP)),
      });
    }
  }

  return JSON.stringify(result);
}
