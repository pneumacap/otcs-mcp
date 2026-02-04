#!/usr/bin/env npx tsx
/**
 * Autonomous Polling Agent — Main entry point.
 *
 * Monitors OTCS folders for new uploads and processes them:
 *   1. Download document text (free)
 *   2. Classify & extract via LLM (1 cheap call)
 *   3. Match extraction against rules (free)
 *   4. Execute programmatic actions (free) — or fall back to agentic loop
 *
 * Usage: npx tsx agent/poller.ts
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { OTCSClient } from "../src/client/otcs-client.js";
import { loadConfig, type AgentConfig, type Rule } from "./config.js";
import { runAgentLoop } from "./agent-loop.js";
import {
  downloadDocument,
  classifyAndExtract,
  matchRule,
  collectAllExtractFields,
  executeActions,
  type WorkflowRule,
} from "./workflows.js";
import { log, logError, logEntry, type LogEntry, type UsageStats } from "./logger.js";
import { initBridge } from "./bridge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LAST_POLL_FILE = resolve(__dirname, "logs", ".last-poll");

// ── Pricing (Anthropic) ──

function computeCost(input: number, output: number, cacheRead: number, cacheWrite: number): number {
  const nonCachedInput = Math.max(0, input - cacheRead - cacheWrite);
  return (
    nonCachedInput * (3 / 1_000_000) +
    output * (15 / 1_000_000) +
    cacheRead * (0.3 / 1_000_000) +
    cacheWrite * (3.75 / 1_000_000)
  );
}

// ── State ──

const processedIds = new Set<number>();
let lastPollTimestamp: string | null = null;

// Session-level cumulative usage
const sessionUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  cost: 0,
  documentsProcessed: 0,
};

function loadLastPollTimestamp(): void {
  if (existsSync(LAST_POLL_FILE)) {
    lastPollTimestamp = readFileSync(LAST_POLL_FILE, "utf-8").trim();
    log(`Recovered last poll timestamp: ${lastPollTimestamp}`);
  }
}

function saveLastPollTimestamp(ts: string): void {
  lastPollTimestamp = ts;
  writeFileSync(LAST_POLL_FILE, ts, "utf-8");
}

// ── Convert config Rule to WorkflowRule ──

function toWorkflowRules(rules: Rule[]): WorkflowRule[] {
  return rules.map((r) => ({
    name: r.name,
    match: r.match as Record<string, string>,
    actions: r.actions,
    extractFields: r.extractFields,
    excludePatterns: r.excludePatterns,
    instructions: r.instructions,
    shareEmail: r.shareEmail,
  }));
}

// ── Process a single document ──

async function processDocument(
  client: OTCSClient,
  config: AgentConfig,
  workflowRules: WorkflowRule[],
  allExtractFields: Record<string, string>,
  nodeId: number,
  nodeName: string,
  mimeType: string,
): Promise<LogEntry> {
  const startTime = Date.now();

  // ── Step 1: Download (free) ──
  log(`  [1/4] Downloading document...`);
  const documentText = await downloadDocument(client, nodeId);

  // ── Step 2: Classify & extract (1 LLM call) ──
  log(`  [2/4] Classifying (LLM)...`);
  const { extraction, usage } = await classifyAndExtract(
    config.anthropicApiKey,
    config.anthropicModel,
    documentText,
    allExtractFields,
  );

  log(`  → Type: ${extraction.documentType}`);
  log(`  → Summary: ${extraction.summary}`);
  for (const [k, v] of Object.entries(extraction)) {
    if (k !== "documentType" && k !== "summary" && v) {
      log(`  → ${k}: ${v}`);
    }
  }

  // ── Step 3: Match rule against extraction (free) ──
  const matchedRule = matchRule(extraction, workflowRules);

  if (matchedRule) {
    log(`  [3/4] Matched rule: "${matchedRule.name}"`);
  } else {
    log(`  [3/4] No rule matched`);
  }

  // ── Step 4: Execute ──
  if (matchedRule?.actions && matchedRule.actions.length > 0) {
    // ── Programmatic path: execute config-driven actions (free) ──
    log(`  [4/4] Executing ${matchedRule.actions.length} programmatic action(s)...`);
    const { steps } = await executeActions(
      client, matchedRule.actions, extraction, nodeId, nodeName,
    );

    const durationMs = Date.now() - startTime;
    const totalTokens = usage.input + usage.output;
    const docCost = computeCost(usage.input, usage.output, usage.cacheRead, usage.cacheWrite);

    // Accumulate session totals
    sessionUsage.inputTokens += usage.input;
    sessionUsage.outputTokens += usage.output;
    sessionUsage.cacheReadTokens += usage.cacheRead;
    sessionUsage.cacheWriteTokens += usage.cacheWrite;
    sessionUsage.cost += docCost;
    sessionUsage.documentsProcessed++;

    log(`  Done (programmatic) in ${durationMs}ms — 1 LLM call (${totalTokens} tokens), ${steps.length} API calls, cost=$${docCost.toFixed(4)}`);
    log(`  [SESSION] docs=${sessionUsage.documentsProcessed} total_tokens=${sessionUsage.inputTokens + sessionUsage.outputTokens} total_cost=$${sessionUsage.cost.toFixed(4)}`);

    return {
      timestamp: new Date().toISOString(),
      nodeId,
      nodeName,
      action: matchedRule.name,
      toolCalls: [
        { name: "classify", args: { documentType: extraction.documentType }, result: `${totalTokens} tokens` },
        ...steps.map((s) => ({ name: s.name, args: s.args, result: s.result })),
      ],
      result: `Matched "${matchedRule.name}". Type: ${extraction.documentType}. ${extraction.summary}`,
      durationMs,
      usage: {
        inputTokens: usage.input,
        outputTokens: usage.output,
        cacheReadTokens: usage.cacheRead,
        cacheWriteTokens: usage.cacheWrite,
        cost: docCost,
      },
    };
  } else {
    // ── Agentic fallback: give AI the extraction so the classify call isn't wasted ──
    const instructions = matchedRule?.instructions || "Determine the appropriate action for this document.";
    const userMessage = [
      `New document uploaded: "${nodeName}" (ID: ${nodeId}, type: ${mimeType}).`,
      `Classification: ${JSON.stringify(extraction)}`,
      instructions,
    ].join("\n\n");

    log(`  [4/4] No programmatic actions — falling back to agentic loop...`);
    const agentResult = await runAgentLoop(
      client,
      config.anthropicApiKey,
      [{ role: "user", content: userMessage }],
      config.systemPrompt,
      config.maxAgentRounds,
      config.anthropicModel,
      config.tools,
    );

    const durationMs = Date.now() - startTime;
    const classifyTokens = usage.input + usage.output;
    const agentTokens = agentResult.usage.inputTokens + agentResult.usage.outputTokens;

    // Combine classify + agent usage
    const totalInput = usage.input + agentResult.usage.inputTokens;
    const totalOutput = usage.output + agentResult.usage.outputTokens;
    const totalCacheRead = usage.cacheRead + agentResult.usage.cacheReadTokens;
    const totalCacheWrite = usage.cacheWrite + agentResult.usage.cacheWriteTokens;
    const docCost = computeCost(totalInput, totalOutput, totalCacheRead, totalCacheWrite);

    // Accumulate session totals
    sessionUsage.inputTokens += totalInput;
    sessionUsage.outputTokens += totalOutput;
    sessionUsage.cacheReadTokens += totalCacheRead;
    sessionUsage.cacheWriteTokens += totalCacheWrite;
    sessionUsage.cost += docCost;
    sessionUsage.documentsProcessed++;

    log(`  Done (agentic) in ${durationMs}ms — ${agentResult.rounds} round(s), ${classifyTokens + agentTokens} total tokens, cost=$${docCost.toFixed(4)}`);
    log(`  [SESSION] docs=${sessionUsage.documentsProcessed} total_tokens=${sessionUsage.inputTokens + sessionUsage.outputTokens} total_cost=$${sessionUsage.cost.toFixed(4)}`);

    return {
      timestamp: new Date().toISOString(),
      nodeId,
      nodeName,
      action: matchedRule?.name || "agentic-fallback",
      toolCalls: [
        { name: "classify", args: { documentType: extraction.documentType }, result: `${classifyTokens} tokens` },
        ...agentResult.toolCalls.map((tc) => ({
          name: tc.name,
          args: tc.args,
          result: tc.result.slice(0, 500),
        })),
      ],
      result: agentResult.finalText.slice(0, 1000),
      durationMs,
      usage: {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        cacheReadTokens: totalCacheRead,
        cacheWriteTokens: totalCacheWrite,
        cost: docCost,
      },
    };
  }
}

// ── Polling ──

async function pollFolder(
  client: OTCSClient,
  folderId: number,
  config: AgentConfig,
  workflowRules: WorkflowRule[],
  allExtractFields: Record<string, string>,
): Promise<number> {
  let result: any;
  try {
    result = await client.search({
      query: "*",
      lookfor: "complexquery",
      location_id: folderId,
      filter_type: "documents",
      sort: "desc_OTObjectDate",
      limit: 50,
    });
  } catch (err: any) {
    logError(`Search failed for folder ${folderId}: ${err.message}`);
    return 0;
  }

  const items = (result?.results || []) as unknown as Record<string, unknown>[];
  if (items.length === 0) return 0;

  // Filter to new items only
  const newItems = items.filter((item) => {
    const id = item.id as number;
    if (processedIds.has(id)) return false;

    // If we have a last poll timestamp, only process newer items
    if (lastPollTimestamp && item.modify_date) {
      const modDate = String(item.modify_date);
      if (modDate <= lastPollTimestamp) return false;
    }

    return true;
  });

  if (newItems.length === 0) return 0;

  log(`  ${newItems.length} new item(s) found in folder ${folderId}`);

  for (const item of newItems) {
    const nodeId = item.id as number;
    const nodeName = (item.name as string) || `Node ${nodeId}`;
    const mimeType = (item.mime_type as string) || "unknown";

    log(`  Processing: ${nodeName} (ID: ${nodeId})`);

    try {
      const entry = await processDocument(
        client, config, workflowRules, allExtractFields,
        nodeId, nodeName, mimeType,
      );
      logEntry(entry);
      processedIds.add(nodeId);
    } catch (err: any) {
      const status = (err as any)?.status ?? (err as any)?.statusCode;
      const isTransient = status === 429 || status === 529 || status === 503;
      if (!isTransient) {
        processedIds.add(nodeId);
      }
      logError(`Failed to process ${nodeName} (ID: ${nodeId}): ${err.message}${isTransient ? " (will retry next poll)" : ""}`);
    }
  }

  // Update last poll timestamp from the most recent item
  const latestDate = items
    .map((i) => String(i.modify_date || ""))
    .filter(Boolean)
    .sort()
    .pop();
  if (latestDate) {
    saveLastPollTimestamp(latestDate);
  }

  return newItems.length;
}

// ── Main ──

async function main(): Promise<void> {
  log("Starting autonomous agent...");

  // Initialize bridge (dynamic imports for CJS/ESM interop)
  await initBridge();

  const config = loadConfig();

  if (!config.enabled) {
    log("Agent is disabled in config. Set enabled: true to start.");
    process.exit(0);
  }

  // Pre-compute workflow rules and extract fields once
  const workflowRules = toWorkflowRules(config.rules);
  const allExtractFields = collectAllExtractFields(workflowRules);

  log(`Watching folders: [${config.watchFolders.join(", ")}]`);
  log(`Poll interval: ${config.pollIntervalMs / 1000}s`);
  log(`Rules: ${workflowRules.length} (extract fields: ${Object.keys(allExtractFields).length})`);
  log(`Model: ${config.anthropicModel}`);

  // Create OTCS client and authenticate
  const client = new OTCSClient({
    baseUrl: config.otcsBaseUrl,
    username: config.otcsUsername,
    password: config.otcsPassword,
  });

  try {
    const ticket = await client.authenticate(config.otcsUsername, config.otcsPassword);
    log(`Authenticated as ${config.otcsUsername} (ticket: ${ticket.slice(0, 8)}...)`);
  } catch (err: any) {
    logError(`Authentication failed: ${err.message}`);
    process.exit(1);
  }

  // Load last poll timestamp for restart recovery
  loadLastPollTimestamp();

  // If no last timestamp, do initial scan to establish baseline
  if (!lastPollTimestamp) {
    log("Initial scan — establishing baseline (marking existing items as seen)...");
    for (const folderId of config.watchFolders) {
      try {
        const result = await client.search({
          query: "*",
          lookfor: "complexquery",
          location_id: folderId,
          sort: "desc_OTObjectDate",
          limit: 100,
        });
        const items = (result?.results || []) as unknown as Record<string, unknown>[];
        for (const item of items) {
          if (item.id) processedIds.add(item.id as number);
        }
        const latestDate = items
          .map((i) => String(i.modify_date || ""))
          .filter(Boolean)
          .sort()
          .pop();
        if (latestDate) saveLastPollTimestamp(latestDate);
        log(`  Folder ${folderId}: ${items.length} existing item(s) baselined`);
      } catch (err: any) {
        logError(`Baseline scan failed for folder ${folderId}: ${err.message}`);
      }
    }
  }

  // Polling loop with lock to prevent overlapping polls
  let pollCount = 0;
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      pollCount++;
      let totalNew = 0;
      for (const folderId of config.watchFolders) {
        totalNew += await pollFolder(client, folderId, config, workflowRules, allExtractFields);
      }
      if (totalNew === 0) {
        log(`Poll #${pollCount} — 0 new items`);
      }
    } finally {
      polling = false;
    }
  };

  // Run first poll immediately
  await poll();

  // Schedule subsequent polls
  setInterval(poll, config.pollIntervalMs);

  // Keep process alive and handle graceful shutdown
  process.on("SIGINT", () => {
    log("Shutting down...");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log("Shutting down...");
    process.exit(0);
  });
}

main().catch((err) => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
