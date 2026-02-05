/**
 * Migration-specific logging system.
 * Appends JSON lines to daily log files in migration/logs/.
 */

import { appendFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = resolve(__dirname, "logs");

// Ensure logs directory exists
mkdirSync(LOGS_DIR, { recursive: true });

/** Tag prefix for all migration console output */
const TAG = "[Migration]";

export interface FileLogEntry {
  timestamp: string;
  file: string;
  action: "upload" | "download" | "skip" | "verify" | "error";
  status: "success" | "failed" | "skipped";
  size?: number;
  duration?: number;
  sourceId?: number;
  destId?: number;
  error?: string;
}

export interface PhaseLogEntry {
  timestamp: string;
  phase: "init" | "discover" | "resolve" | "transfer" | "verify" | "report" | "cleanup";
  status: "start" | "complete" | "error";
  summary?: string;
  details?: Record<string, unknown>;
}

export type LogEntry = FileLogEntry | PhaseLogEntry;

function getLogPath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return resolve(LOGS_DIR, `migration-${date}.log`);
}

export function logEntry(entry: LogEntry): void {
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(getLogPath(), line, "utf-8");
}

export function logFile(entry: Omit<FileLogEntry, "timestamp">): void {
  logEntry({ timestamp: new Date().toISOString(), ...entry });
}

export function logPhase(entry: Omit<PhaseLogEntry, "timestamp">): void {
  logEntry({ timestamp: new Date().toISOString(), ...entry });
}

export function log(message: string): void {
  console.log(`${TAG} ${message}`);
}

export function logError(message: string): void {
  console.error(`${TAG} ERROR: ${message}`);
}

export function logWarn(message: string): void {
  console.warn(`${TAG} WARN: ${message}`);
}

export function getLogsDir(): string {
  return LOGS_DIR;
}
