/**
 * Reusable polling engine — the core loop extracted from poller.ts.
 *
 * Can be used:
 *   1. From the CLI via poller.ts (reads agent-config.json)
 *   2. From the web app via /api/agents/run (reads DB)
 *
 * Usage:
 *   const engine = createEngine(config, client);
 *   await engine.start();   // begins polling
 *   engine.status();        // { running, pollCount, ... }
 *   engine.stop();          // stops polling
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { NodeTypes } from "../packages/core/src/types/core.js";
import { type AgentConfig, type Rule } from "./config.js";
import { runAgentLoop } from "./agent-loop.js";
import {
  downloadDocument,
  classifyAndExtract,
  matchRule,
  collectAllExtractFields,
  executeActions,
  type WorkflowRule,
} from "./workflows.js";
import { computeCost } from "../packages/core/src/llm/cost.js";
import { log, logError, logEntry, type LogEntry } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LAST_POLL_FILE = resolve(__dirname, "logs", ".last-poll");

// ── Types ──

export interface EngineStatus {
  running: boolean;
  startedAt: string | null;
  pollCount: number;
  documentsProcessed: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  watchFolders: number[];
  rulesCount: number;
  pollIntervalMs: number;
  lastPollAt: string | null;
  recentLogs: string[];
}

export interface EngineHandle {
  start: () => Promise<void>;
  stop: () => void;
  status: () => EngineStatus;
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

// ── Engine Factory ──

export interface EngineOptions {
  /** If true, process all existing documents on first poll instead of baselining them as "seen". Default: false. */
  processExisting?: boolean;
}

export function createEngine(config: AgentConfig, client: OTCSClient, options?: EngineOptions): EngineHandle {
  // ── Per-engine state ──
  const processedIds = new Set<number>();
  let lastPollTimestamp: string | null = null;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let startedAt: string | null = null;
  let pollCount = 0;
  let polling = false;
  let lastPollAt: string | null = null;
  const recentLogs: string[] = []; // keep last 50 log lines

  const sessionUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    documentsProcessed: 0,
  };

  // Pre-compute rules
  const workflowRules = toWorkflowRules(config.rules);
  const allExtractFields = collectAllExtractFields(workflowRules);

  // Internal log wrapper that also captures recent logs
  function elog(msg: string): void {
    log(msg);
    recentLogs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    if (recentLogs.length > 50) recentLogs.shift();
  }

  // ── Timestamp persistence ──

  function loadLastPollTimestamp(): void {
    if (existsSync(LAST_POLL_FILE)) {
      lastPollTimestamp = readFileSync(LAST_POLL_FILE, "utf-8").trim();
      elog(`Recovered last poll timestamp: ${lastPollTimestamp}`);
    }
  }

  function saveLastPollTimestamp(ts: string): void {
    lastPollTimestamp = ts;
    try {
      writeFileSync(LAST_POLL_FILE, ts, "utf-8");
    } catch {
      // Silently ignore write failures (e.g. when run inside Next.js)
    }
  }

  // ── Process a single document ──

  async function processDocument(
    nodeId: number,
    nodeName: string,
    mimeType: string,
  ): Promise<LogEntry> {
    const startTime = Date.now();

    // Step 1: Download (free)
    elog(`  [1/4] Downloading document...`);
    const documentText = await downloadDocument(client, nodeId);

    // Step 2: Classify & extract (1 LLM call)
    elog(`  [2/4] Classifying (LLM)...`);
    const { extraction, usage } = await classifyAndExtract(
      config.anthropicApiKey,
      config.anthropicModel,
      documentText,
      allExtractFields,
    );

    elog(`  → Type: ${extraction.documentType}`);
    elog(`  → Summary: ${extraction.summary}`);
    for (const [k, v] of Object.entries(extraction)) {
      if (k !== "documentType" && k !== "summary" && v) {
        elog(`  → ${k}: ${v}`);
      }
    }

    // Step 3: Match rule (free)
    const matchedRule = matchRule(extraction, workflowRules, { name: nodeName, mimeType });

    if (matchedRule) {
      elog(`  [3/4] Matched rule: "${matchedRule.name}"`);
    } else {
      elog(`  [3/4] No rule matched`);
    }

    // Step 4: Execute
    if (matchedRule?.actions && matchedRule.actions.length > 0) {
      // Programmatic path (free)
      elog(`  [4/4] Executing ${matchedRule.actions.length} programmatic action(s)...`);
      const { steps } = await executeActions(
        client, matchedRule.actions, extraction, nodeId, nodeName,
      );

      const durationMs = Date.now() - startTime;
      const totalTokens = usage.input + usage.output;
      const docCost = computeCost(usage.input, usage.output, usage.cacheRead, usage.cacheWrite);

      sessionUsage.inputTokens += usage.input;
      sessionUsage.outputTokens += usage.output;
      sessionUsage.cacheReadTokens += usage.cacheRead;
      sessionUsage.cacheWriteTokens += usage.cacheWrite;
      sessionUsage.cost += docCost;
      sessionUsage.documentsProcessed++;

      elog(`  Done (programmatic) in ${durationMs}ms — 1 LLM call (${totalTokens} tokens), ${steps.length} API calls, cost=$${docCost.toFixed(4)}`);

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
      // Agentic fallback
      const instructions = matchedRule?.instructions || "Determine the appropriate action for this document.";
      const userMessage = [
        `New document uploaded: "${nodeName}" (ID: ${nodeId}, type: ${mimeType}).`,
        `Classification: ${JSON.stringify(extraction)}`,
        instructions,
      ].join("\n\n");

      elog(`  [4/4] No programmatic actions — falling back to agentic loop...`);
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

      const totalInput = usage.input + agentResult.usage.inputTokens;
      const totalOutput = usage.output + agentResult.usage.outputTokens;
      const totalCacheRead = usage.cacheRead + agentResult.usage.cacheReadTokens;
      const totalCacheWrite = usage.cacheWrite + agentResult.usage.cacheWriteTokens;
      const docCost = computeCost(totalInput, totalOutput, totalCacheRead, totalCacheWrite);

      sessionUsage.inputTokens += totalInput;
      sessionUsage.outputTokens += totalOutput;
      sessionUsage.cacheReadTokens += totalCacheRead;
      sessionUsage.cacheWriteTokens += totalCacheWrite;
      sessionUsage.cost += docCost;
      sessionUsage.documentsProcessed++;

      elog(`  Done (agentic) in ${durationMs}ms — ${agentResult.rounds} round(s), ${classifyTokens + agentTokens} total tokens, cost=$${docCost.toFixed(4)}`);

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

  // ── Poll a single folder ──

  async function pollFolder(folderId: number): Promise<number> {
    let result: any;
    try {
      result = await client.getSubnodes(folderId, {
        where_type: [NodeTypes.DOCUMENT],
        limit: 100,
        sort: "-modify_date",
      });
    } catch (err: any) {
      logError(`Browse failed for folder ${folderId}: ${err.message}`);
      return 0;
    }

    const items = (result?.items || []) as unknown as Record<string, unknown>[];
    if (items.length === 0) return 0;

    const lastPollTime = lastPollTimestamp ? new Date(lastPollTimestamp).getTime() : 0;

    const newItems = items.filter((item) => {
      const id = item.id as number;
      if (processedIds.has(id)) return false;
      if (lastPollTime && item.modify_date) {
        // OTCS returns dates without timezone suffix (e.g. "2026-02-09T04:52:23")
        // which JS parses as local time. Append 'Z' to treat as UTC, matching
        // the UTC timestamps we store in .last-poll.
        let dateStr = String(item.modify_date);
        if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.includes("-", 10)) {
          dateStr += "Z";
        }
        const modTime = new Date(dateStr).getTime();
        if (modTime <= lastPollTime) return false;
      }
      return true;
    });

    if (newItems.length === 0) return 0;

    elog(`  ${newItems.length} new item(s) found in folder ${folderId}`);

    for (const item of newItems) {
      const nodeId = item.id as number;
      const nodeName = (item.name as string) || `Node ${nodeId}`;
      const mimeType = (item.mime_type as string) || "unknown";

      elog(`  Processing: ${nodeName} (ID: ${nodeId})`);

      try {
        const entry = await processDocument(nodeId, nodeName, mimeType);
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

    // Save current wall-clock time AFTER processing is complete.
    // Using item modify_date would cause reprocessing on restart because
    // our actions (update_description, categorize) bump the doc's modify_date
    // past the saved timestamp.
    saveLastPollTimestamp(new Date().toISOString());

    return newItems.length;
  }

  // ── Single poll cycle ──

  async function doPoll(): Promise<void> {
    if (polling) return;
    polling = true;
    try {
      pollCount++;
      lastPollAt = new Date().toISOString();
      let totalNew = 0;
      for (const folderId of config.watchFolders) {
        totalNew += await pollFolder(folderId);
      }
      if (totalNew === 0) {
        elog(`Poll #${pollCount} — 0 new items`);
      }
    } finally {
      polling = false;
    }
  }

  // ── Baseline scan ──

  async function baseline(): Promise<void> {
    if (options?.processExisting) {
      // Skip baseline entirely — process all existing documents on first poll
      elog("Process-existing mode: skipping baseline, will process all documents in watched folders.");
      lastPollTimestamp = null;
      return;
    }

    loadLastPollTimestamp();

    if (!lastPollTimestamp) {
      elog("Initial scan — establishing baseline (marking existing items as seen)...");
      for (const folderId of config.watchFolders) {
        try {
          const result = await client.getSubnodes(folderId, {
            where_type: [NodeTypes.DOCUMENT],
            limit: 100,
            sort: "-modify_date",
          });
          const items = result?.items || [];
          for (const item of items) {
            if (item.id) processedIds.add(item.id as number);
          }
          elog(`  Folder ${folderId}: ${items.length} existing item(s) baselined (${result?.paging?.total_count ?? "?"} total)`);
        } catch (err: any) {
          logError(`Baseline scan failed for folder ${folderId}: ${err.message}`);
        }
      }
      // Save current time as the high-water mark after scanning all folders
      saveLastPollTimestamp(new Date().toISOString());
    }
  }

  // ── Public API ──

  return {
    async start() {
      if (running) return;
      running = true;
      startedAt = new Date().toISOString();

      elog(`Engine starting — ${workflowRules.length} rules, ${config.watchFolders.length} folders, poll every ${config.pollIntervalMs / 1000}s`);

      await baseline();
      await doPoll();

      intervalHandle = setInterval(doPoll, config.pollIntervalMs);
    },

    stop() {
      if (!running) return;
      running = false;
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      elog("Engine stopped.");
    },

    status(): EngineStatus {
      return {
        running,
        startedAt,
        pollCount,
        documentsProcessed: sessionUsage.documentsProcessed,
        inputTokens: sessionUsage.inputTokens,
        outputTokens: sessionUsage.outputTokens,
        totalCost: sessionUsage.cost,
        watchFolders: config.watchFolders,
        rulesCount: workflowRules.length,
        pollIntervalMs: config.pollIntervalMs,
        lastPollAt,
        recentLogs: [...recentLogs],
      };
    },
  };
}
