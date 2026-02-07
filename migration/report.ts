/**
 * Report module — Chain of custody report generation and upload.
 * Generates structured JSON report, optionally creates an executive summary via LLM,
 * and uploads to OTCS if configured.
 */

import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { MigrationJob, MigrationConfig } from "./config.js";
import { MigrationManifest } from "./discovery.js";
import { TransferSummary, TransferResult } from "./transfer.js";
import { VerificationReport } from "./verify.js";
import { log, logPhase, getLogsDir } from "./logger.js";

// ── Report data structure ───────────────────────────────────────────────
export interface MigrationReport {
  jobName: string;
  direction: string;
  startTime: string;
  endTime: string;
  duration: string;
  source: string;
  destination: string;
  summary: {
    totalFiles: number;
    transferred: number;
    skipped: number;
    failed: number;
    verified: number;
    verificationFailed: number;
    totalBytes: number;
    avgThroughput: string;
  };
  files: Array<{
    name: string;
    sourcePath: string;
    destPath: string;
    size: number;
    status: "transferred" | "skipped" | "failed" | "verified";
    timestamp: string;
    error?: string;
    sourceId?: number;
    destId?: number;
  }>;
  conflicts: Array<{
    name: string;
    resolution: string;
    reason: string;
  }>;
  verification: {
    passed: number;
    failed: number;
    details: string[];
  };
}

export interface ReportResult {
  jsonPath: string;
  textPath?: string;
  uploadedNodeId?: number;
}

// ── Generate report ─────────────────────────────────────────────────────
export function generateReport(
  job: MigrationJob,
  manifest: MigrationManifest,
  transferSummary: TransferSummary,
  verification: VerificationReport | null,
  startTime: Date,
  endTime: Date
): MigrationReport {
  const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);
  const avgThroughput =
    transferSummary.stats.durationSec > 0
      ? `${transferSummary.stats.filesPerSec.toFixed(2)} files/sec, ${transferSummary.stats.mbPerSec.toFixed(2)} MB/sec`
      : "N/A";

  // Build files list
  const files: MigrationReport["files"] = transferSummary.results.map((result) => {
    const source = result.item.source;
    let status: "transferred" | "skipped" | "failed" | "verified" = result.action;

    // Check if verified
    if (verification && result.action === "transferred") {
      const verifyItem = verification.items.find((v) => v.file === source.relativePath);
      if (verifyItem?.passed) {
        status = "verified";
      }
    }

    return {
      name: source.name,
      sourcePath: source.relativePath,
      destPath: source.relativePath, // Same relative path in destination
      size: source.size,
      status,
      timestamp: new Date().toISOString(),
      error: result.error,
      sourceId: source.type === "otcs" ? (source as any).nodeId : undefined,
      destId: result.destId,
    };
  });

  // Build conflicts list
  const conflicts: MigrationReport["conflicts"] = manifest.items
    .filter((item) => item.status === "modified")
    .map((item) => ({
      name: item.source.name,
      resolution: job.conflictStrategy,
      reason: item.conflictReason || "Modified file",
    }));

  // Build verification details
  const verificationDetails: string[] = [];
  if (verification) {
    for (const item of verification.items.filter((v) => !v.passed)) {
      verificationDetails.push(`${item.file}: ${item.error}`);
    }
  }

  return {
    jobName: job.name,
    direction: job.direction,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: `${duration}s`,
    source: String(job.source),
    destination: String(job.destination),
    summary: {
      totalFiles: manifest.summary.totalSource,
      transferred: transferSummary.stats.completed,
      skipped: transferSummary.stats.skipped,
      failed: transferSummary.stats.failed,
      verified: verification?.summary.passed || 0,
      verificationFailed: verification?.summary.failed || 0,
      totalBytes: transferSummary.stats.transferredBytes,
      avgThroughput,
    },
    files,
    conflicts,
    verification: {
      passed: verification?.summary.passed || 0,
      failed: verification?.summary.failed || 0,
      details: verificationDetails,
    },
  };
}

// ── Save report as JSON ─────────────────────────────────────────────────
function saveJsonReport(report: MigrationReport): string {
  const safeName = report.jobName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `report-${safeName}-${timestamp}.json`;
  const filepath = path.join(getLogsDir(), filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filepath;
}

// ── Generate executive summary via LLM ──────────────────────────────────
async function generateExecutiveSummary(
  report: MigrationReport,
  anthropicApiKey: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const prompt = `You are a document migration specialist. Generate a concise executive summary report for this migration job.

Migration Report Data:
${JSON.stringify(report, null, 2)}

Generate a professional chain of custody report that includes:
1. Executive Summary (2-3 sentences)
2. Migration Statistics (bullet points)
3. Key Findings (any issues or notable items)
4. Recommendations (if any failures or issues)

Format it as a clean text document suitable for business stakeholders. Be concise and factual.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "Unable to generate summary";
}

// ── Save text report ────────────────────────────────────────────────────
function saveTextReport(report: MigrationReport, summary: string): string {
  const safeName = report.jobName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `report-${safeName}-${timestamp}.txt`;
  const filepath = path.join(getLogsDir(), filename);

  const content = `
================================================================================
CHAIN OF CUSTODY REPORT
================================================================================

Job Name: ${report.jobName}
Direction: ${report.direction}
Source: ${report.source}
Destination: ${report.destination}
Start Time: ${report.startTime}
End Time: ${report.endTime}
Duration: ${report.duration}

--------------------------------------------------------------------------------
EXECUTIVE SUMMARY
--------------------------------------------------------------------------------

${summary}

--------------------------------------------------------------------------------
DETAILED STATISTICS
--------------------------------------------------------------------------------

Total Files:         ${report.summary.totalFiles}
Transferred:         ${report.summary.transferred}
Skipped:             ${report.summary.skipped}
Failed:              ${report.summary.failed}
Verified:            ${report.summary.verified}
Verification Failed: ${report.summary.verificationFailed}
Total Data:          ${(report.summary.totalBytes / 1024 / 1024).toFixed(2)} MB
Throughput:          ${report.summary.avgThroughput}

--------------------------------------------------------------------------------
CONFLICTS (${report.conflicts.length})
--------------------------------------------------------------------------------

${report.conflicts.length > 0 ? report.conflicts.map((c) => `- ${c.name}: ${c.resolution} (${c.reason})`).join("\n") : "No conflicts"}

--------------------------------------------------------------------------------
VERIFICATION FAILURES (${report.verification.failed})
--------------------------------------------------------------------------------

${report.verification.details.length > 0 ? report.verification.details.join("\n") : "No verification failures"}

--------------------------------------------------------------------------------
FILE MANIFEST (showing first 100 files)
--------------------------------------------------------------------------------

${report.files.slice(0, 100).map((f) => `[${f.status.toUpperCase().padEnd(11)}] ${f.sourcePath} (${(f.size / 1024).toFixed(1)} KB)${f.error ? ` - ERROR: ${f.error}` : ""}`).join("\n")}
${report.files.length > 100 ? `\n... and ${report.files.length - 100} more files` : ""}

================================================================================
Generated: ${new Date().toISOString()}
================================================================================
`;

  fs.writeFileSync(filepath, content);
  return filepath;
}

// ── Upload report to OTCS ───────────────────────────────────────────────
async function uploadReport(
  client: OTCSClient,
  reportPath: string,
  destinationId: number
): Promise<number> {
  const content = fs.readFileSync(reportPath);
  const filename = path.basename(reportPath);
  const mimeType = reportPath.endsWith(".json") ? "application/json" : "text/plain";

  const result = await client.uploadDocument(destinationId, filename, content, mimeType);
  return result.id;
}

// ── Main report function ────────────────────────────────────────────────
export async function createReport(
  client: OTCSClient,
  config: MigrationConfig,
  job: MigrationJob,
  manifest: MigrationManifest,
  transferSummary: TransferSummary,
  verification: VerificationReport | null,
  startTime: Date,
  endTime: Date
): Promise<ReportResult> {
  logPhase({ phase: "report", status: "start", summary: `Generating report for job: ${job.name}` });

  // Generate structured report
  const report = generateReport(job, manifest, transferSummary, verification, startTime, endTime);

  // Save JSON report (always)
  const jsonPath = saveJsonReport(report);
  log(`JSON report saved: ${jsonPath}`);

  const result: ReportResult = { jsonPath };

  // Generate executive summary if API key is available
  if (config.anthropicApiKey && job.generateReport) {
    try {
      log("Generating executive summary via LLM...");
      const summary = await generateExecutiveSummary(report, config.anthropicApiKey);
      const textPath = saveTextReport(report, summary);
      result.textPath = textPath;
      log(`Text report saved: ${textPath}`);

      // Upload to OTCS if configured
      if (job.reportDestination) {
        try {
          const nodeId = await uploadReport(client, textPath, job.reportDestination);
          result.uploadedNodeId = nodeId;
          log(`Report uploaded to OTCS (node ID: ${nodeId})`);
        } catch (err: any) {
          log(`Failed to upload report: ${err.message}`);
        }
      }
    } catch (err: any) {
      log(`Failed to generate executive summary: ${err.message}`);
      // Still save a basic text report without LLM summary
      const textPath = saveTextReport(report, "Unable to generate executive summary.");
      result.textPath = textPath;
    }
  } else {
    // Save basic text report without LLM summary
    const textPath = saveTextReport(report, "No executive summary (ANTHROPIC_API_KEY not configured).");
    result.textPath = textPath;
    log(`Text report saved: ${textPath}`);
  }

  logPhase({ phase: "report", status: "complete", summary: `Report generated at ${jsonPath}` });

  return result;
}

// ── Print final summary to console ──────────────────────────────────────
export function printSummary(report: MigrationReport): void {
  console.log(`
  Migration Complete
  ─────────────────────────────────────
  Job:          ${report.jobName}
  Direction:    ${report.direction}
  Duration:     ${report.duration}
  ─────────────────────────────────────
  Transferred:  ${report.summary.transferred}
  Skipped:      ${report.summary.skipped}
  Failed:       ${report.summary.failed}
  Verified:     ${report.summary.verified}/${report.summary.transferred}
  Total Data:   ${(report.summary.totalBytes / 1024 / 1024).toFixed(1)} MB
  Throughput:   ${report.summary.avgThroughput}
  ─────────────────────────────────────
`);
}
