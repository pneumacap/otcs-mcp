/**
 * Reusable polling engine — the core loop extracted from poller.ts.
 *
 * Can be used:
 *   1. From the CLI via poller.ts (reads agent-config.json)
 *   2. From the web app via /api/agents/run (reads DB)
 *
 * Pure agentic: download doc text → build prompt → run agent loop.
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
import { type AgentConfig } from "./config.js";
import { runAgentLoop } from "./agent-loop.js";
import { downloadDocument } from "./workflows.js";
import { computeCost } from "../packages/core/src/llm/cost.js";
import { log, logError, logEntry, type LogEntry } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LAST_POLL_FILE = resolve(__dirname, "logs", ".last-poll");

// ── Parallel map with concurrency limit (no external deps) ──

async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function next(): Promise<void> {
    const idx = i++;
    if (idx >= items.length) return;
    results[idx] = await fn(items[idx]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

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
  agentsCount: number;
  pollIntervalMs: number;
  lastPollAt: string | null;
  recentLogs: string[];
}

export interface EngineHandle {
  start: () => Promise<void>;
  stop: () => void;
  status: () => EngineStatus;
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

  // ── Pick the best agent for a document ──
  // For now: use the first agent. Per-agent watchFolders can scope this.

  function pickAgent(folderId: number) {
    // If an agent has watchFolders that include this folder, prefer it
    for (const agent of config.agents) {
      if (agent.watchFolders && agent.watchFolders.includes(folderId)) {
        return agent;
      }
    }
    // Default to first agent
    return config.agents[0];
  }

  // ── Process a single document ──

  async function processDocument(
    nodeId: number,
    nodeName: string,
    mimeType: string,
    folderId: number,
  ): Promise<LogEntry> {
    const startTime = Date.now();
    const agent = pickAgent(folderId);

    // Step 1: Download document text
    elog(`  [1/2] Downloading document...`);
    const documentText = await downloadDocument(client, nodeId);

    // Step 2: Run agentic loop
    const instructions = agent.instructions || "Determine the appropriate action for this document.";
    const baseSystemPrompt = agent.systemPrompt || config.systemPrompt || "You are an autonomous document processing agent for OpenText Content Server.";
    const systemPrompt = baseSystemPrompt + "\n\nBe concise. Output only the classification and a 1-2 sentence summary. Do not use markdown headers, bullet points, or verbose explanations.";
    const toolFilter = agent.tools || config.tools;

    const userMessage = [
      `New document uploaded: "${nodeName}" (ID: ${nodeId}, MIME: ${mimeType}).`,
      `Document text (first 8000 chars):\n${documentText.slice(0, 8000)}`,
      `\nInstructions:\n${instructions}`,
    ].join("\n\n");

    elog(`  [2/2] Running agentic loop (agent: "${agent.name}")...`);
    const agentResult = await runAgentLoop(
      client,
      config.anthropicApiKey,
      [{ role: "user", content: userMessage }],
      systemPrompt,
      config.maxAgentRounds,
      config.anthropicModel,
      toolFilter,
    );

    const durationMs = Date.now() - startTime;
    const docCost = computeCost(
      agentResult.usage.inputTokens,
      agentResult.usage.outputTokens,
      agentResult.usage.cacheReadTokens,
      agentResult.usage.cacheWriteTokens,
    );

    sessionUsage.inputTokens += agentResult.usage.inputTokens;
    sessionUsage.outputTokens += agentResult.usage.outputTokens;
    sessionUsage.cacheReadTokens += agentResult.usage.cacheReadTokens;
    sessionUsage.cacheWriteTokens += agentResult.usage.cacheWriteTokens;
    sessionUsage.cost += docCost;
    sessionUsage.documentsProcessed++;

    const totalTokens = agentResult.usage.inputTokens + agentResult.usage.outputTokens;
    elog(`  Done in ${durationMs}ms — ${agentResult.rounds} round(s), ${totalTokens} tokens, cost=$${docCost.toFixed(4)}`);

    return {
      timestamp: new Date().toISOString(),
      nodeId,
      nodeName,
      action: agent.name,
      toolCalls: agentResult.toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
        result: tc.result.slice(0, 500),
      })),
      result: agentResult.finalText.slice(0, 1000),
      durationMs,
      usage: {
        inputTokens: agentResult.usage.inputTokens,
        outputTokens: agentResult.usage.outputTokens,
        cacheReadTokens: agentResult.usage.cacheReadTokens,
        cacheWriteTokens: agentResult.usage.cacheWriteTokens,
        cost: docCost,
      },
    };
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

    elog(`  ${newItems.length} new item(s) found in folder ${folderId} (concurrency: ${config.concurrency})`);

    await pMap(newItems, async (item) => {
      const nodeId = item.id as number;
      const nodeName = (item.name as string) || `Node ${nodeId}`;
      const mimeType = (item.mime_type as string) || "unknown";

      elog(`  Processing: ${nodeName} (ID: ${nodeId})`);

      try {
        const entry = await processDocument(nodeId, nodeName, mimeType, folderId);
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
    }, config.concurrency);

    // Save current wall-clock time AFTER processing is complete.
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

      elog(`Engine starting — ${config.agents.length} agent(s), ${config.watchFolders.length} folder(s), poll every ${config.pollIntervalMs / 1000}s`);

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
        agentsCount: config.agents.length,
        pollIntervalMs: config.pollIntervalMs,
        lastPollAt,
        recentLogs: [...recentLogs],
      };
    },
  };
}
