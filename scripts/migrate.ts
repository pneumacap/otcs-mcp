#!/usr/bin/env tsx
/**
 * Content Server Bulk Migration Script
 *
 * Uploads files from a local folder to OpenText Content Server
 * using direct REST API calls — no LLM in the loop.
 *
 * Usage:
 *   tsx scripts/migrate.ts --source ~/Desktop/statements --dest 182121
 *   tsx scripts/migrate.ts --source ./docs --dest 2000 --concurrency 50 --extensions .pdf,.docx
 *   tsx scripts/migrate.ts --source ./data --dest 2000 --recursive --dry-run
 *
 * Environment variables (from .env):
 *   OTCS_BASE_URL, OTCS_USERNAME, OTCS_PASSWORD
 */

import { OTCSClient } from "../src/client/otcs-client.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load .env ──────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

// ── MIME types ──────────────────────────────────────────────────────────
const MIME_TYPES: Record<string, string> = {
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

function getMimeType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

// ── CLI argument parsing ────────────────────────────────────────────────
interface MigrateOptions {
  source: string;
  dest: number;
  concurrency: number;
  extensions: string[];
  recursive: boolean;
  dryRun: boolean;
  createFolder: string | null;
  retries: number;
  checkpoint: string | null;
}

function parseArgs(): MigrateOptions {
  const args = process.argv.slice(2);
  const opts: MigrateOptions = {
    source: "",
    dest: 0,
    concurrency: 20,
    extensions: [],
    recursive: false,
    dryRun: false,
    createFolder: null,
    retries: 3,
    checkpoint: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--source":
      case "-s":
        opts.source = args[++i];
        break;
      case "--dest":
      case "-d":
        opts.dest = parseInt(args[++i], 10);
        break;
      case "--concurrency":
      case "-c":
        opts.concurrency = parseInt(args[++i], 10);
        break;
      case "--extensions":
      case "-e":
        opts.extensions = args[++i].split(",").map(e => e.trim().startsWith(".") ? e.trim() : `.${e.trim()}`);
        break;
      case "--recursive":
      case "-r":
        opts.recursive = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--create-folder":
        opts.createFolder = args[++i];
        break;
      case "--retries":
        opts.retries = parseInt(args[++i], 10);
        break;
      case "--checkpoint":
        opts.checkpoint = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  if (!opts.source || !opts.dest) {
    console.error("Error: --source and --dest are required.\n");
    printHelp();
    process.exit(1);
  }

  return opts;
}

function printHelp() {
  console.log(`
Content Server Bulk Migration Script

Usage:
  tsx scripts/migrate.ts --source <path> --dest <folder_id> [options]

Required:
  --source, -s <path>       Local folder to upload
  --dest, -d <id>           Content Server destination folder ID

Options:
  --concurrency, -c <n>     Parallel uploads (default: 20, max: 100)
  --extensions, -e <list>   Filter by extension (e.g., ".pdf,.docx")
  --recursive, -r           Include subfolders
  --create-folder <name>    Create a new folder in dest first, upload into it
  --retries <n>             Retry failed uploads (default: 3)
  --checkpoint <file>       Resume from checkpoint file
  --dry-run                 List files without uploading
  --help, -h                Show this help

Examples:
  tsx scripts/migrate.ts -s ~/Desktop/statements -d 182121
  tsx scripts/migrate.ts -s ./docs -d 2000 -c 50 -e .pdf,.docx -r
  tsx scripts/migrate.ts -s ./archive -d 2000 --create-folder "2026 Archive" -c 100
  `);
}

// ── File collection ─────────────────────────────────────────────────────
interface FileEntry {
  fullPath: string;
  relativePath: string;
  size: number;
}

function collectFiles(dir: string, basePath: string, extensions: string[], recursive: boolean): FileEntry[] {
  const files: FileEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && recursive) {
      files.push(...collectFiles(fullPath, basePath, extensions, recursive));
    } else if (entry.isFile()) {
      if (extensions.length > 0) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extensions.includes(ext)) continue;
      }
      const stat = fs.statSync(fullPath);
      files.push({
        fullPath,
        relativePath: path.relative(basePath, fullPath),
        size: stat.size,
      });
    }
  }
  return files;
}

// ── Checkpoint management ───────────────────────────────────────────────
interface Checkpoint {
  completed: Set<string>;
  failed: Map<string, string>;
}

function loadCheckpoint(filePath: string | null): Checkpoint {
  if (!filePath || !fs.existsSync(filePath)) {
    return { completed: new Set(), failed: new Map() };
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return {
    completed: new Set(data.completed || []),
    failed: new Map(Object.entries(data.failed || {})),
  };
}

function saveCheckpoint(filePath: string, checkpoint: Checkpoint) {
  fs.writeFileSync(filePath, JSON.stringify({
    completed: Array.from(checkpoint.completed),
    failed: Object.fromEntries(checkpoint.failed),
    timestamp: new Date().toISOString(),
  }, null, 2));
}

// ── Progress display ────────────────────────────────────────────────────
class ProgressTracker {
  total: number;
  completed = 0;
  failed = 0;
  totalBytes = 0;
  uploadedBytes = 0;
  startTime: number;
  lastPrintTime = 0;

  constructor(total: number, totalBytes: number) {
    this.total = total;
    this.totalBytes = totalBytes;
    this.startTime = Date.now();
  }

  update(bytes: number, success: boolean) {
    if (success) {
      this.completed++;
      this.uploadedBytes += bytes;
    } else {
      this.failed++;
    }
    this.print();
  }

  print() {
    const now = Date.now();
    if (now - this.lastPrintTime < 500 && (this.completed + this.failed) < this.total) return;
    this.lastPrintTime = now;

    const elapsed = (now - this.startTime) / 1000;
    const done = this.completed + this.failed;
    const pct = ((done / this.total) * 100).toFixed(1);
    const rate = elapsed > 0 ? (this.completed / elapsed).toFixed(1) : "0";
    const mbUploaded = (this.uploadedBytes / 1024 / 1024).toFixed(1);
    const mbps = elapsed > 0 ? (this.uploadedBytes / 1024 / 1024 / elapsed).toFixed(2) : "0";
    const remaining = this.completed > 0
      ? ((this.total - done) / (this.completed / elapsed)).toFixed(0)
      : "?";

    process.stdout.write(
      `\r  [${pct}%] ${this.completed}/${this.total} uploaded | ${this.failed} failed | ${rate} files/sec | ${mbUploaded} MB (${mbps} MB/s) | ETA: ${remaining}s    `
    );
  }

  summary() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = (this.completed / elapsed).toFixed(2);
    const mbTotal = (this.uploadedBytes / 1024 / 1024).toFixed(1);
    console.log(`\n\n  Migration Complete`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Uploaded:     ${this.completed}/${this.total} files`);
    console.log(`  Failed:       ${this.failed}`);
    console.log(`  Data:         ${mbTotal} MB`);
    console.log(`  Duration:     ${elapsed.toFixed(1)}s`);
    console.log(`  Throughput:   ${rate} files/sec`);
    console.log(`  ─────────────────────────────────────`);
  }
}

// ── Upload with retry ───────────────────────────────────────────────────
async function uploadWithRetry(
  client: OTCSClient,
  parentId: number,
  file: FileEntry,
  maxRetries: number,
): Promise<{ success: boolean; nodeId?: number; error?: string }> {
  const buffer = fs.readFileSync(file.fullPath);
  const fileName = path.basename(file.fullPath);
  const mimeType = getMimeType(file.fullPath);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await client.uploadDocument(parentId, fileName, buffer, mimeType);
      return { success: true, nodeId: result.id };
    } catch (err: any) {
      if (attempt === maxRetries) {
        return { success: false, error: err.message || String(err) };
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const sourcePath = path.resolve(opts.source);

  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
    console.error(`Error: Source "${sourcePath}" is not a valid directory.`);
    process.exit(1);
  }

  // Validate env
  const baseUrl = process.env.OTCS_BASE_URL;
  const username = process.env.OTCS_USERNAME;
  const password = process.env.OTCS_PASSWORD;
  if (!baseUrl || !username || !password) {
    console.error("Error: OTCS_BASE_URL, OTCS_USERNAME, OTCS_PASSWORD must be set in .env");
    process.exit(1);
  }

  // Collect files
  console.log(`\n  Scanning: ${sourcePath}`);
  const files = collectFiles(sourcePath, sourcePath, opts.extensions, opts.recursive);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`  Found:    ${files.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);

  if (files.length === 0) {
    console.log("  Nothing to upload.");
    return;
  }

  if (opts.extensions.length > 0) {
    console.log(`  Filter:   ${opts.extensions.join(", ")}`);
  }

  // Dry run
  if (opts.dryRun) {
    console.log(`\n  Dry run — files that would be uploaded:\n`);
    for (const f of files.slice(0, 50)) {
      console.log(`    ${f.relativePath} (${(f.size / 1024).toFixed(1)} KB)`);
    }
    if (files.length > 50) console.log(`    ... and ${files.length - 50} more`);
    console.log(`\n  Total: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
    return;
  }

  // Connect and authenticate
  console.log(`  Server:   ${baseUrl}`);
  const client = new OTCSClient({
    baseUrl,
    username,
    password,
  });
  await client.authenticate();
  console.log(`  Auth:     OK (${username})`);

  // Create destination folder if requested
  let destId = opts.dest;
  if (opts.createFolder) {
    const result = await client.createFolder(destId, opts.createFolder);
    destId = result.id;
    console.log(`  Created:  "${opts.createFolder}" (ID: ${destId})`);
  }

  // Load checkpoint for resume
  const checkpointPath = opts.checkpoint || path.join(sourcePath, ".migrate-checkpoint.json");
  const checkpoint = loadCheckpoint(opts.checkpoint ? checkpointPath : null);
  const filesToUpload = files.filter(f => !checkpoint.completed.has(f.relativePath));

  if (filesToUpload.length < files.length) {
    console.log(`  Resume:   Skipping ${files.length - filesToUpload.length} already uploaded`);
  }

  // Build folder structure first (for recursive uploads)
  const folderCache = new Map<string, number>();
  folderCache.set("", destId);
  folderCache.set(".", destId);

  if (opts.recursive) {
    const uniqueDirs = new Set<string>();
    for (const f of filesToUpload) {
      const dir = path.dirname(f.relativePath);
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
    console.log(`  Folders:  ${sortedDirs.length} subfolder(s) created/verified`);
  }

  // Upload with concurrency
  const concurrency = Math.min(Math.max(opts.concurrency, 1), 100);
  console.log(`  Upload:   ${filesToUpload.length} files @ ${concurrency}x concurrency\n`);

  const progress = new ProgressTracker(filesToUpload.length, totalBytes);
  const errors: { file: string; error: string }[] = [];

  for (let i = 0; i < filesToUpload.length; i += concurrency) {
    const batch = filesToUpload.slice(i, i + concurrency);
    const promises = batch.map(async (file) => {
      const relDir = path.dirname(file.relativePath);
      const targetId = folderCache.get(relDir === "." ? "" : relDir) || destId;

      const result = await uploadWithRetry(client, targetId, file, opts.retries);

      if (result.success) {
        checkpoint.completed.add(file.relativePath);
      } else {
        checkpoint.failed.set(file.relativePath, result.error || "Unknown error");
        errors.push({ file: file.relativePath, error: result.error || "Unknown error" });
      }

      progress.update(file.size, result.success);
    });

    await Promise.all(promises);

    // Save checkpoint every 100 files
    if ((i + concurrency) % 100 < concurrency) {
      saveCheckpoint(checkpointPath, checkpoint);
    }
  }

  // Final checkpoint save
  saveCheckpoint(checkpointPath, checkpoint);

  // Summary
  progress.summary();

  if (errors.length > 0) {
    console.log(`\n  Failed files:`);
    for (const e of errors.slice(0, 20)) {
      console.log(`    ${e.file}: ${e.error}`);
    }
    if (errors.length > 20) console.log(`    ... and ${errors.length - 20} more`);
    console.log(`\n  Re-run with --checkpoint ${checkpointPath} to retry failed files.`);
  }
}

main().catch(err => {
  console.error("\nFatal error:", err.message || err);
  process.exit(1);
});
