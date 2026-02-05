/**
 * Transfer module — Bi-directional upload/download engine.
 * Supports concurrent transfers, retry with exponential backoff, and checkpoint/resume.
 */

import * as fs from "fs";
import * as path from "path";
import { OTCSClient } from "../src/client/otcs-client.js";
import { MigrationJob, expandPath, ConflictStrategy } from "./config.js";
import {
  MigrationManifest,
  ManifestItem,
  LocalFileEntry,
  OTCSFileEntry,
  getMimeType,
} from "./discovery.js";
import { log, logFile, logPhase, logWarn } from "./logger.js";

// ── Checkpoint management ───────────────────────────────────────────────
export interface Checkpoint {
  jobName: string;
  timestamp: string;
  completed: string[]; // Relative paths of completed files
  failed: Record<string, string>; // relativePath -> error message
  nodeIdMap: Record<string, number>; // relativePath -> OTCS nodeId (for uploads)
}

export function getCheckpointPath(job: MigrationJob): string {
  const safeName = job.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  return path.resolve(path.dirname(import.meta.url.replace("file://", "")), "logs", `checkpoint-${safeName}.json`);
}

export function loadCheckpoint(job: MigrationJob): Checkpoint {
  const checkpointPath = getCheckpointPath(job);
  if (fs.existsSync(checkpointPath)) {
    try {
      return JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
    } catch {
      // Corrupt checkpoint, start fresh
    }
  }
  return {
    jobName: job.name,
    timestamp: new Date().toISOString(),
    completed: [],
    failed: {},
    nodeIdMap: {},
  };
}

export function saveCheckpoint(job: MigrationJob, checkpoint: Checkpoint): void {
  checkpoint.timestamp = new Date().toISOString();
  const checkpointPath = getCheckpointPath(job);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

// ── Progress tracking ───────────────────────────────────────────────────
export class ProgressTracker {
  total: number;
  completed = 0;
  failed = 0;
  skipped = 0;
  totalBytes = 0;
  transferredBytes = 0;
  startTime: number;
  lastPrintTime = 0;

  constructor(total: number, totalBytes: number) {
    this.total = total;
    this.totalBytes = totalBytes;
    this.startTime = Date.now();
  }

  update(bytes: number, status: "success" | "failed" | "skipped") {
    if (status === "success") {
      this.completed++;
      this.transferredBytes += bytes;
    } else if (status === "failed") {
      this.failed++;
    } else {
      this.skipped++;
    }
    this.print();
  }

  print() {
    const now = Date.now();
    if (now - this.lastPrintTime < 500 && this.getDone() < this.total) return;
    this.lastPrintTime = now;

    const elapsed = (now - this.startTime) / 1000;
    const done = this.getDone();
    const pct = ((done / this.total) * 100).toFixed(1);
    const rate = elapsed > 0 ? (this.completed / elapsed).toFixed(1) : "0";
    const mbTransferred = (this.transferredBytes / 1024 / 1024).toFixed(1);
    const mbps = elapsed > 0 ? (this.transferredBytes / 1024 / 1024 / elapsed).toFixed(2) : "0";
    const remaining =
      this.completed > 0 ? ((this.total - done) / (this.completed / elapsed)).toFixed(0) : "?";

    process.stdout.write(
      `\r  [${pct}%] ${this.completed}/${this.total} transferred | ${this.skipped} skipped | ${this.failed} failed | ${rate} files/sec | ${mbTransferred} MB (${mbps} MB/s) | ETA: ${remaining}s    `
    );
  }

  getDone(): number {
    return this.completed + this.failed + this.skipped;
  }

  getStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      skipped: this.skipped,
      totalBytes: this.totalBytes,
      transferredBytes: this.transferredBytes,
      durationSec: elapsed,
      filesPerSec: elapsed > 0 ? this.completed / elapsed : 0,
      mbPerSec: elapsed > 0 ? this.transferredBytes / 1024 / 1024 / elapsed : 0,
    };
  }
}

// ── Transfer result ─────────────────────────────────────────────────────
export interface TransferResult {
  item: ManifestItem;
  success: boolean;
  action: "transferred" | "skipped" | "failed";
  destId?: number;
  error?: string;
  duration: number;
}

export interface TransferSummary {
  results: TransferResult[];
  stats: ReturnType<ProgressTracker["getStats"]>;
}

// ── Upload with retry ───────────────────────────────────────────────────
async function uploadWithRetry(
  client: OTCSClient,
  parentId: number,
  file: LocalFileEntry,
  maxRetries: number
): Promise<{ success: boolean; nodeId?: number; error?: string }> {
  const buffer = fs.readFileSync(file.fullPath);
  const mimeType = getMimeType(file.fullPath);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await client.uploadDocument(parentId, file.name, buffer, mimeType);
      return { success: true, nodeId: result.id };
    } catch (err: any) {
      if (attempt === maxRetries) {
        return { success: false, error: err.message || String(err) };
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

// ── Download with retry ─────────────────────────────────────────────────
async function downloadWithRetry(
  client: OTCSClient,
  nodeId: number,
  destPath: string,
  maxRetries: number
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { content } = await client.getContent(nodeId);
      // Ensure parent directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, Buffer.from(content));
      return { success: true };
    } catch (err: any) {
      if (attempt === maxRetries) {
        return { success: false, error: err.message || String(err) };
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

// ── Apply conflict resolution ───────────────────────────────────────────
function shouldTransfer(
  item: ManifestItem,
  strategy: ConflictStrategy,
  agentDecisions?: Map<string, string>
): { transfer: boolean; rename?: string; reason: string } {
  // New items always transfer
  if (item.status === "new") {
    return { transfer: true, reason: "New file" };
  }

  // Orphans (dest-only) are never transferred
  if (item.status === "orphan") {
    return { transfer: false, reason: "Orphan (destination only)" };
  }

  // Existing (identical) files are skipped
  if (item.status === "existing") {
    return { transfer: false, reason: "Already exists and matches" };
  }

  // Modified files depend on conflict strategy
  if (item.status === "modified") {
    switch (strategy) {
      case "skip":
        return { transfer: false, reason: "Skipped (conflict strategy: skip)" };

      case "overwrite":
        return { transfer: true, reason: "Overwriting (conflict strategy: overwrite)" };

      case "rename": {
        const ext = path.extname(item.source.name);
        const base = path.basename(item.source.name, ext);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const newName = `${base}_${timestamp}${ext}`;
        return { transfer: true, rename: newName, reason: `Renamed (conflict strategy: rename)` };
      }

      case "agent": {
        // Check agent decisions
        const key = item.source.relativePath;
        const decision = agentDecisions?.get(key);
        if (decision === "skip") {
          return { transfer: false, reason: "Skipped (agent decision)" };
        } else if (decision === "overwrite") {
          return { transfer: true, reason: "Overwriting (agent decision)" };
        } else if (decision?.startsWith("rename:")) {
          return { transfer: true, rename: decision.slice(7), reason: "Renamed (agent decision)" };
        }
        // Default to skip if no agent decision
        return { transfer: false, reason: "No agent decision, skipping" };
      }
    }
  }

  return { transfer: false, reason: "Unknown status" };
}

// ── Main transfer function ──────────────────────────────────────────────
export async function transfer(
  client: OTCSClient,
  manifest: MigrationManifest,
  options: {
    dryRun?: boolean;
    resume?: boolean;
    concurrencyOverride?: number;
    agentDecisions?: Map<string, string>;
  } = {}
): Promise<TransferSummary> {
  const { job } = manifest;
  const { dryRun, resume, concurrencyOverride, agentDecisions } = options;

  logPhase({ phase: "transfer", status: "start", summary: `Starting transfer for job: ${job.name}` });

  // Load checkpoint if resuming
  const checkpoint = resume ? loadCheckpoint(job) : {
    jobName: job.name,
    timestamp: new Date().toISOString(),
    completed: [],
    failed: {},
    nodeIdMap: {},
  };

  const completedSet = new Set(checkpoint.completed);

  // Filter items to transfer (include all non-orphan items so skipped ones are counted)
  const itemsToProcess = manifest.items.filter((item) => {
    // Skip directories
    if (item.source.isDirectory) return false;
    // Skip already completed (if resuming)
    if (completedSet.has(item.source.relativePath)) return false;
    // Skip orphans (destination-only files)
    if (item.status === "orphan") return false;
    // Include new, existing, and modified items (modified may be skipped based on conflict strategy)
    return true;
  });

  // Calculate total bytes
  const totalBytes = itemsToProcess
    .filter((i) => shouldTransfer(i, job.conflictStrategy, agentDecisions).transfer)
    .reduce((sum, i) => sum + i.source.size, 0);

  const concurrency = Math.min(Math.max(concurrencyOverride || job.concurrency, 1), 100);
  const progress = new ProgressTracker(itemsToProcess.length, totalBytes);

  log(`Transfer: ${itemsToProcess.length} items @ ${concurrency}x concurrency${dryRun ? " (DRY RUN)" : ""}`);

  const results: TransferResult[] = [];

  // Build folder cache for uploads (local-to-otcs)
  const folderCache = new Map<string, number>();
  if (job.direction === "local-to-otcs") {
    const destId = job.destination as number;
    folderCache.set("", destId);
    folderCache.set(".", destId);

    // Pre-create folder structure
    if (job.recursive && !dryRun) {
      const uniqueDirs = new Set<string>();
      for (const item of itemsToProcess) {
        const dir = path.dirname(item.source.relativePath);
        if (dir !== "" && dir !== ".") uniqueDirs.add(dir);
      }
      const sortedDirs = Array.from(uniqueDirs).sort(
        (a, b) => a.split(path.sep).length - b.split(path.sep).length
      );
      for (const dir of sortedDirs) {
        if (folderCache.has(dir)) continue;
        try {
          const result = await client.createFolderPath(destId, dir);
          const parts = dir.split(path.sep);
          let cumulative = "";
          for (let i = 0; i < parts.length; i++) {
            cumulative = i === 0 ? parts[i] : path.join(cumulative, parts[i]);
            if (result.folders[i]) folderCache.set(cumulative, result.folders[i].id);
          }
        } catch {
          // folder may already exist
        }
      }
      log(`  Created/verified ${sortedDirs.length} subfolder(s)`);
    }
  }

  // Process items in batches
  for (let i = 0; i < itemsToProcess.length; i += concurrency) {
    const batch = itemsToProcess.slice(i, i + concurrency);

    const promises = batch.map(async (item): Promise<TransferResult> => {
      const startTime = Date.now();
      const decision = shouldTransfer(item, job.conflictStrategy, agentDecisions);

      if (!decision.transfer) {
        // Skip this item
        progress.update(0, "skipped");
        logFile({
          file: item.source.relativePath,
          action: "skip",
          status: "skipped",
          size: item.source.size,
        });
        return {
          item,
          success: true,
          action: "skipped",
          duration: Date.now() - startTime,
        };
      }

      if (dryRun) {
        // Dry run - just log what would happen
        progress.update(item.source.size, "success");
        return {
          item,
          success: true,
          action: "transferred",
          duration: Date.now() - startTime,
        };
      }

      // Perform actual transfer
      if (job.direction === "local-to-otcs") {
        const localFile = item.source as LocalFileEntry;
        const relDir = path.dirname(localFile.relativePath);
        const targetId = folderCache.get(relDir === "." ? "" : relDir) || (job.destination as number);
        const fileName = decision.rename || localFile.name;

        const result = await uploadWithRetry(client, targetId, { ...localFile, name: fileName }, job.retries);

        if (result.success) {
          checkpoint.completed.push(localFile.relativePath);
          checkpoint.nodeIdMap[localFile.relativePath] = result.nodeId!;
          progress.update(localFile.size, "success");
          logFile({
            file: localFile.relativePath,
            action: "upload",
            status: "success",
            size: localFile.size,
            destId: result.nodeId,
            duration: Date.now() - startTime,
          });
          return {
            item,
            success: true,
            action: "transferred",
            destId: result.nodeId,
            duration: Date.now() - startTime,
          };
        } else {
          checkpoint.failed[localFile.relativePath] = result.error || "Unknown error";
          progress.update(0, "failed");
          logFile({
            file: localFile.relativePath,
            action: "upload",
            status: "failed",
            size: localFile.size,
            error: result.error,
            duration: Date.now() - startTime,
          });
          return {
            item,
            success: false,
            action: "failed",
            error: result.error,
            duration: Date.now() - startTime,
          };
        }
      } else {
        // otcs-to-local
        const otcsFile = item.source as OTCSFileEntry;
        const destPath = path.join(expandPath(job.destination), otcsFile.relativePath);
        const fileName = decision.rename || otcsFile.name;
        const finalPath = decision.rename ? path.join(path.dirname(destPath), fileName) : destPath;

        const result = await downloadWithRetry(client, otcsFile.nodeId, finalPath, job.retries);

        if (result.success) {
          checkpoint.completed.push(otcsFile.relativePath);
          progress.update(otcsFile.size, "success");
          logFile({
            file: otcsFile.relativePath,
            action: "download",
            status: "success",
            size: otcsFile.size,
            sourceId: otcsFile.nodeId,
            duration: Date.now() - startTime,
          });
          return {
            item,
            success: true,
            action: "transferred",
            duration: Date.now() - startTime,
          };
        } else {
          checkpoint.failed[otcsFile.relativePath] = result.error || "Unknown error";
          progress.update(0, "failed");
          logFile({
            file: otcsFile.relativePath,
            action: "download",
            status: "failed",
            size: otcsFile.size,
            error: result.error,
            duration: Date.now() - startTime,
          });
          return {
            item,
            success: false,
            action: "failed",
            error: result.error,
            duration: Date.now() - startTime,
          };
        }
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Save checkpoint every 100 files
    if (!dryRun && (i + concurrency) % 100 < concurrency) {
      saveCheckpoint(job, checkpoint);
    }
  }

  // Final checkpoint save
  if (!dryRun) {
    saveCheckpoint(job, checkpoint);
  }

  // Clear progress line
  console.log("");

  const stats = progress.getStats();
  log(`Transfer complete: ${stats.completed} transferred, ${stats.skipped} skipped, ${stats.failed} failed`);
  logPhase({
    phase: "transfer",
    status: "complete",
    summary: `${stats.completed} transferred, ${stats.skipped} skipped, ${stats.failed} failed`,
    details: stats,
  });

  return { results, stats };
}
