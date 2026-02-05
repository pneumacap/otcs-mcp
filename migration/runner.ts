#!/usr/bin/env tsx
/**
 * Migration Runner — Main orchestrator for bi-directional OTCS/Local migration.
 *
 * Phases:
 *   1. Initialize — Load config, authenticate to OTCS, setup logging
 *   2. Discover — Scan source, scan destination, compute diff
 *   3. Resolve Conflicts — Apply conflict strategy (skip/overwrite/rename/agent)
 *   4. Transfer — Execute uploads/downloads with concurrency control
 *   5. Verify — Run verification pass on all transferred files
 *   6. Report — Generate chain of custody report
 *   7. Cleanup — Save final checkpoint, logout from OTCS
 *
 * Usage:
 *   tsx migration/runner.ts --job "Upload statements to OTCS"
 *   tsx migration/runner.ts --all
 *   tsx migration/runner.ts --job "Upload statements" --dry-run
 *   tsx migration/runner.ts --job "Upload statements" --concurrency 100
 *   tsx migration/runner.ts --job "Upload statements" --resume
 */

import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "../src/client/otcs-client.js";
import {
  loadConfig,
  parseCLIArgs,
  getJob,
  MigrationConfig,
  MigrationJob,
  CLIOptions,
} from "./config.js";
import { discover, MigrationManifest, ManifestItem } from "./discovery.js";
import { transfer, TransferSummary } from "./transfer.js";
import { verify, VerificationReport } from "./verify.js";
import { createReport, printSummary, generateReport, MigrationReport } from "./report.js";
import { log, logError, logPhase, logWarn } from "./logger.js";

// ── Conflict Resolution via Agent (1 LLM call for all conflicts) ────────
async function resolveConflictsWithAgent(
  conflicts: ManifestItem[],
  job: MigrationJob,
  anthropicApiKey: string
): Promise<Map<string, string>> {
  log(`Resolving ${conflicts.length} conflicts via LLM agent...`);

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const conflictList = conflicts.map((c) => ({
    file: c.source.relativePath,
    sourceSize: c.source.size,
    sourceDate: c.source.modifiedDate.toISOString(),
    destSize: c.dest?.size,
    destDate: c.dest?.modifiedDate.toISOString(),
    reason: c.conflictReason,
  }));

  const prompt = `You are a document migration specialist. Review these file conflicts and decide how to handle each one.

Migration Job: ${job.name}
Direction: ${job.direction}
Source: ${job.source}
Destination: ${job.destination}

Conflicts:
${JSON.stringify(conflictList, null, 2)}

For each file, respond with a JSON array where each entry has:
- "file": the relative file path
- "decision": one of "skip", "overwrite", or "rename:newname.ext"

Consider:
- If the source is newer, "overwrite" is usually appropriate
- If the destination is newer, "skip" preserves the newer version
- If both versions should be kept, use "rename:filename_backup.ext"
- For important documents, prefer "rename" to avoid data loss

Respond ONLY with a valid JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("No text response from agent");
  }

  // Parse JSON response
  try {
    const decisions = JSON.parse(textBlock.text) as Array<{ file: string; decision: string }>;
    const decisionMap = new Map<string, string>();
    for (const d of decisions) {
      decisionMap.set(d.file, d.decision);
    }
    log(`Agent resolved ${decisionMap.size} conflicts`);
    return decisionMap;
  } catch (err) {
    logError(`Failed to parse agent response: ${textBlock.text}`);
    throw new Error("Invalid agent response format");
  }
}

// ── Run a single job ────────────────────────────────────────────────────
async function runJob(
  client: OTCSClient,
  config: MigrationConfig,
  job: MigrationJob,
  options: CLIOptions
): Promise<void> {
  const startTime = new Date();
  log(`\n${"=".repeat(60)}`);
  log(`Starting job: ${job.name}`);
  log(`Direction: ${job.direction}`);
  log(`Source: ${job.source}`);
  log(`Destination: ${job.destination}`);
  log(`${"=".repeat(60)}\n`);

  // Phase 1: Initialize
  logPhase({ phase: "init", status: "start", summary: "Initializing migration job" });

  // Apply CLI overrides
  const effectiveJob = { ...job };
  if (options.concurrency) {
    effectiveJob.concurrency = options.concurrency;
  }

  logPhase({ phase: "init", status: "complete", summary: "Initialization complete" });

  // Phase 2: Discover
  const manifest = await discover(client, effectiveJob);

  // Dry run: just report what would happen
  if (options.dryRun) {
    log("\n=== DRY RUN MODE ===");
    log(`Would transfer: ${manifest.summary.new} new files`);
    log(`Would skip: ${manifest.summary.existing} existing files`);
    log(`Conflicts: ${manifest.summary.modified} modified files`);
    log(`Orphans: ${manifest.summary.orphans} (destination only)`);
    log(`Total data: ${(manifest.summary.totalBytes / 1024 / 1024).toFixed(1)} MB`);

    if (manifest.items.filter((i) => i.status === "new").length > 0) {
      log("\nNew files (first 20):");
      for (const item of manifest.items.filter((i) => i.status === "new").slice(0, 20)) {
        log(`  + ${item.source.relativePath} (${(item.source.size / 1024).toFixed(1)} KB)`);
      }
    }

    if (manifest.items.filter((i) => i.status === "modified").length > 0) {
      log("\nConflicts (first 20):");
      for (const item of manifest.items.filter((i) => i.status === "modified").slice(0, 20)) {
        log(`  ~ ${item.source.relativePath}: ${item.conflictReason}`);
      }
    }

    return;
  }

  // Phase 3: Resolve Conflicts
  let agentDecisions: Map<string, string> | undefined;
  const conflicts = manifest.items.filter((i) => i.status === "modified");

  if (conflicts.length > 0) {
    logPhase({ phase: "resolve", status: "start", summary: `Resolving ${conflicts.length} conflicts` });

    if (effectiveJob.conflictStrategy === "agent") {
      if (!config.anthropicApiKey) {
        logWarn("ANTHROPIC_API_KEY not set, falling back to 'skip' strategy for conflicts");
        effectiveJob.conflictStrategy = "skip";
      } else {
        agentDecisions = await resolveConflictsWithAgent(conflicts, effectiveJob, config.anthropicApiKey);
      }
    }

    logPhase({
      phase: "resolve",
      status: "complete",
      summary: `Conflict strategy: ${effectiveJob.conflictStrategy}`,
    });
  }

  // Phase 4: Transfer
  const transferSummary = await transfer(client, manifest, {
    dryRun: false,
    resume: options.resume,
    concurrencyOverride: options.concurrency,
    agentDecisions,
  });

  // Phase 5: Verify
  let verificationReport: VerificationReport | null = null;
  if (effectiveJob.verify && transferSummary.stats.completed > 0) {
    verificationReport = await verify(client, effectiveJob, transferSummary.results);
  }

  // Phase 6: Report
  const endTime = new Date();
  const reportResult = await createReport(
    client,
    config,
    effectiveJob,
    manifest,
    transferSummary,
    verificationReport,
    startTime,
    endTime
  );

  // Print final summary
  const report = generateReport(
    effectiveJob,
    manifest,
    transferSummary,
    verificationReport,
    startTime,
    endTime
  );
  printSummary(report);

  if (reportResult.uploadedNodeId) {
    log(`Report uploaded to OTCS: node ID ${reportResult.uploadedNodeId}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const options = parseCLIArgs();
  let config: MigrationConfig;

  try {
    config = loadConfig();
  } catch (err: any) {
    logError(err.message);
    process.exit(1);
  }

  // Validate job selection
  if (!options.job && !options.all) {
    logError("Please specify --job <name> or --all");
    process.exit(1);
  }

  // Phase 1: Initialize OTCS client
  logPhase({ phase: "init", status: "start", summary: "Connecting to OTCS" });

  const client = new OTCSClient({
    baseUrl: config.otcsBaseUrl,
    username: config.otcsUsername,
    password: config.otcsPassword,
  });

  try {
    await client.authenticate();
    log(`Authenticated to OTCS as ${config.otcsUsername}`);
  } catch (err: any) {
    logError(`Failed to authenticate: ${err.message}`);
    process.exit(1);
  }

  logPhase({ phase: "init", status: "complete", summary: "OTCS connection established" });

  // Determine jobs to run
  const jobsToRun: MigrationJob[] = [];

  if (options.all) {
    jobsToRun.push(...config.jobs);
  } else if (options.job) {
    const job = getJob(config, options.job);
    if (!job) {
      logError(`Job not found: ${options.job}`);
      log("Available jobs:");
      for (const j of config.jobs) {
        log(`  - ${j.name}`);
      }
      process.exit(1);
    }
    jobsToRun.push(job);
  }

  // Run jobs
  try {
    for (const job of jobsToRun) {
      await runJob(client, config, job, options);
    }
  } catch (err: any) {
    logError(`Migration failed: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    // Phase 7: Cleanup
    logPhase({ phase: "cleanup", status: "start", summary: "Cleaning up" });
    try {
      await client.logout();
      log("Logged out from OTCS");
    } catch {
      // Ignore logout errors
    }
    logPhase({ phase: "cleanup", status: "complete", summary: "Cleanup complete" });
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  log("\nReceived SIGINT, saving checkpoint and exiting...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("\nReceived SIGTERM, saving checkpoint and exiting...");
  process.exit(0);
});

main().catch((err) => {
  logError(`Fatal error: ${err.message || err}`);
  process.exit(1);
});
