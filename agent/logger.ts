/**
 * Audit logger for the autonomous agent.
 * Appends JSON lines to daily log files in agent/logs/.
 */

import { appendFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = resolve(__dirname, "logs");

// Ensure logs directory exists
mkdirSync(LOGS_DIR, { recursive: true });

export interface LogEntry {
  timestamp: string;
  nodeId: number;
  nodeName: string;
  action: string;
  toolCalls: { name: string; args: Record<string, unknown>; result: string }[];
  result: string;
  durationMs: number;
}

function getLogPath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return resolve(LOGS_DIR, `agent-${date}.log`);
}

export function logEntry(entry: LogEntry): void {
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(getLogPath(), line, "utf-8");
}

/** Prefix for all agent console output */
const TAG = "[Agent]";

export function log(message: string): void {
  console.log(`${TAG} ${message}`);
}

export function logError(message: string): void {
  console.error(`${TAG} ERROR: ${message}`);
}
