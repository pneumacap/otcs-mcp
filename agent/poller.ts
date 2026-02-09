#!/usr/bin/env npx tsx
/**
 * Autonomous Polling Agent — CLI entry point.
 *
 * Reads agent-config.json, creates an OTCS client, and starts the
 * polling engine. This is the manual / standalone path.
 *
 * For the web-driven path, see /api/agents/run which uses the same
 * engine but reads config from the database.
 *
 * Usage: npx tsx agent/poller.ts
 */

import "dotenv/config";
import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { loadConfig } from "./config.js";
import { createEngine } from "./engine.js";
import { log, logError } from "./logger.js";

async function main(): Promise<void> {
  log("Starting autonomous agent (CLI mode)...");

  const config = loadConfig();

  if (!config.enabled) {
    log("Agent is disabled in config. Set enabled: true to start.");
    process.exit(0);
  }

  log(`Watching folders: [${config.watchFolders.join(", ")}]`);
  log(`Poll interval: ${config.pollIntervalMs / 1000}s`);
  log(`Rules: ${config.rules.length}`);
  log(`Model: ${config.anthropicModel}`);

  // Create OTCS client and authenticate
  const client = new OTCSClient({
    baseUrl: config.otcsBaseUrl,
    username: config.otcsUsername,
    password: config.otcsPassword,
    tlsSkipVerify: config.tlsSkipVerify,
  });

  try {
    const ticket = await client.authenticate(config.otcsUsername, config.otcsPassword);
    log(`Authenticated as ${config.otcsUsername} (ticket: ${ticket.slice(0, 8)}...)`);
  } catch (err: any) {
    logError(`Authentication failed: ${err.message}`);
    process.exit(1);
  }

  // Create and start the engine
  const processExisting = process.env.AGENT_PROCESS_EXISTING === "true";
  if (processExisting) {
    log("Process-existing mode enabled — will process all documents in watched folders.");
  }
  const engine = createEngine(config, client, { processExisting });
  await engine.start();

  // Keep process alive and handle graceful shutdown
  process.on("SIGINT", () => {
    log("Shutting down...");
    engine.stop();
    const s = engine.status();
    log(`Final stats: ${s.documentsProcessed} docs, ${s.pollCount} polls, $${s.totalCost.toFixed(4)} total cost`);
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log("Shutting down...");
    engine.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
