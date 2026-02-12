/**
 * Configuration loader for the autonomous polling agent.
 * Reads agent-config.json and merges with environment variable overrides.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AgentDef {
  name: string;
  instructions: string;
  systemPrompt?: string;
  tools?: string[];
  watchFolders?: number[];
}

export interface AgentConfig {
  enabled: boolean;
  pollIntervalMs: number;
  maxAgentRounds: number;
  watchFolders: number[];
  systemPrompt: string;
  agents: AgentDef[];
  // Derived from env vars
  anthropicApiKey: string;
  otcsBaseUrl: string;
  otcsUsername: string;
  otcsPassword: string;
  anthropicModel: string;
  tlsSkipVerify: boolean;
  tools?: string[]; // If set, only include these tools (by name)
  concurrency: number; // Max parallel document processing (default: 3)
}

export function loadConfig(): AgentConfig {
  // Load JSON config
  const configPath = resolve(__dirname, "agent-config.json");
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));

  // Validate required env vars
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY env var is required");

  const otcsBaseUrl = process.env.OTCS_BASE_URL;
  if (!otcsBaseUrl) throw new Error("OTCS_BASE_URL env var is required");

  const otcsUsername = process.env.OTCS_USERNAME;
  if (!otcsUsername) throw new Error("OTCS_USERNAME env var is required");

  const otcsPassword = process.env.OTCS_PASSWORD;
  if (!otcsPassword) throw new Error("OTCS_PASSWORD env var is required");

  // Merge env var overrides
  const enabled = process.env.AGENT_ENABLED !== undefined
    ? process.env.AGENT_ENABLED === "true"
    : raw.enabled ?? true;

  const pollIntervalMs = process.env.AGENT_POLL_INTERVAL
    ? parseInt(process.env.AGENT_POLL_INTERVAL, 10)
    : raw.pollIntervalMs ?? 30000;

  const watchFolders = process.env.AGENT_WATCH_FOLDERS
    ? process.env.AGENT_WATCH_FOLDERS.split(",").map((s) => parseInt(s.trim(), 10))
    : raw.watchFolders ?? [2000];

  const tlsSkipVerify = process.env.OTCS_TLS_SKIP_VERIFY === "true";

  return {
    enabled,
    pollIntervalMs,
    maxAgentRounds: raw.maxAgentRounds ?? 10,
    watchFolders,
    systemPrompt: raw.systemPrompt ?? "",
    agents: raw.agents ?? [],
    anthropicApiKey,
    otcsBaseUrl,
    otcsUsername,
    otcsPassword,
    anthropicModel: raw.model || process.env.AGENT_MODEL || "claude-sonnet-4-5-20250929",
    tlsSkipVerify,
    tools: raw.tools as string[] | undefined,
    concurrency: raw.concurrency ?? 3,
  };
}
