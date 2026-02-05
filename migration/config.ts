/**
 * Configuration loader for the migration system.
 * Reads migration-config.json and merges with environment variable overrides.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load .env ──────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split("\n");
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

export type Direction = "local-to-otcs" | "otcs-to-local";
export type ConflictStrategy = "skip" | "overwrite" | "rename" | "agent";

export interface MigrationJob {
  name: string;
  direction: Direction;
  source: string | number; // Local path for local-to-otcs, OTCS node ID for otcs-to-local
  destination: string | number; // OTCS node ID for local-to-otcs, local path for otcs-to-local
  recursive: boolean;
  extensions?: string[];
  concurrency: number;
  retries: number;
  conflictStrategy: ConflictStrategy;
  verify: boolean;
  generateReport: boolean;
  reportDestination?: number; // OTCS folder ID to upload the report
}

export interface MigrationConfig {
  jobs: MigrationJob[];
  // Derived from env vars
  otcsBaseUrl: string;
  otcsUsername: string;
  otcsPassword: string;
  anthropicApiKey?: string; // Optional, only needed for agent conflict resolution or report generation
}

export interface CLIOptions {
  job?: string;
  all?: boolean;
  dryRun?: boolean;
  concurrency?: number;
  resume?: boolean;
}

export function loadConfig(): MigrationConfig {
  // Load JSON config
  const configPath = resolve(__dirname, "migration-config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));

  // Validate required env vars
  const otcsBaseUrl = process.env.OTCS_BASE_URL;
  if (!otcsBaseUrl) throw new Error("OTCS_BASE_URL env var is required");

  const otcsUsername = process.env.OTCS_USERNAME;
  if (!otcsUsername) throw new Error("OTCS_USERNAME env var is required");

  const otcsPassword = process.env.OTCS_PASSWORD;
  if (!otcsPassword) throw new Error("OTCS_PASSWORD env var is required");

  // Anthropic API key is optional (only required for agent conflict resolution or report generation)
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  return {
    jobs: raw.jobs ?? [],
    otcsBaseUrl,
    otcsUsername,
    otcsPassword,
    anthropicApiKey,
  };
}

export function parseCLIArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const opts: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--job":
      case "-j":
        opts.job = args[++i];
        break;
      case "--all":
      case "-a":
        opts.all = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--concurrency":
      case "-c":
        opts.concurrency = parseInt(args[++i], 10);
        break;
      case "--resume":
      case "-r":
        opts.resume = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Migration System — Bi-directional OTCS/Local File Transfer

Usage:
  tsx migration/runner.ts [options]

Options:
  --job, -j <name>       Run a specific job by name
  --all, -a              Run all jobs in sequence
  --dry-run              Scan and report without transferring
  --concurrency, -c <n>  Override concurrency level
  --resume, -r           Resume from last checkpoint
  --help, -h             Show this help

Examples:
  tsx migration/runner.ts --job "Upload statements to OTCS"
  tsx migration/runner.ts --all
  tsx migration/runner.ts --job "Upload statements" --dry-run
  tsx migration/runner.ts --job "Upload statements" --concurrency 100
  tsx migration/runner.ts --job "Upload statements" --resume
  `);
}

export function getJob(config: MigrationConfig, jobName: string): MigrationJob | undefined {
  return config.jobs.find((j) => j.name === jobName);
}

export function expandPath(p: string | number): string {
  if (typeof p === "number") return String(p);
  // Expand ~ to home directory
  if (p.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return resolve(home, p.slice(2));
  }
  return resolve(p);
}
