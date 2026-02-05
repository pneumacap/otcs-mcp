/**
 * Verification module — Post-transfer verification pass.
 * Confirms transferred files exist and match expected sizes.
 */

import * as fs from "fs";
import * as path from "path";
import { OTCSClient } from "../src/client/otcs-client.js";
import { MigrationJob, expandPath } from "./config.js";
import { TransferResult } from "./transfer.js";
import { log, logFile, logPhase } from "./logger.js";

export interface VerificationItem {
  file: string;
  expected: {
    size: number;
    nodeId?: number;
  };
  actual?: {
    exists: boolean;
    size?: number;
  };
  passed: boolean;
  error?: string;
}

export interface VerificationReport {
  job: MigrationJob;
  items: VerificationItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Verify transferred files by checking existence and size match.
 * Note: OTCS doesn't provide checksums, so we can only verify size.
 */
export async function verify(
  client: OTCSClient,
  job: MigrationJob,
  transferResults: TransferResult[]
): Promise<VerificationReport> {
  logPhase({ phase: "verify", status: "start", summary: `Verifying transfer for job: ${job.name}` });

  const items: VerificationItem[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Only verify successfully transferred files
  const transferredItems = transferResults.filter((r) => r.action === "transferred" && r.success);

  for (const result of transferredItems) {
    const file = result.item.source.relativePath;
    const expectedSize = result.item.source.size;

    try {
      if (job.direction === "local-to-otcs") {
        // Verify upload: check OTCS node exists and size matches
        if (!result.destId) {
          items.push({
            file,
            expected: { size: expectedSize },
            passed: false,
            error: "No destination node ID recorded",
          });
          failed++;
          continue;
        }

        const node = await client.getNode(result.destId);
        const actualSize = node.size || 0;
        const sizeMatch = actualSize === expectedSize;

        items.push({
          file,
          expected: { size: expectedSize, nodeId: result.destId },
          actual: { exists: true, size: actualSize },
          passed: sizeMatch,
          error: sizeMatch ? undefined : `Size mismatch: expected ${expectedSize}, got ${actualSize}`,
        });

        if (sizeMatch) {
          passed++;
          logFile({ file, action: "verify", status: "success", size: actualSize });
        } else {
          failed++;
          logFile({
            file,
            action: "verify",
            status: "failed",
            size: actualSize,
            error: `Size mismatch: expected ${expectedSize}, got ${actualSize}`,
          });
        }
      } else {
        // Verify download: check local file exists and size matches
        const destPath = path.join(expandPath(job.destination), file);

        if (!fs.existsSync(destPath)) {
          items.push({
            file,
            expected: { size: expectedSize },
            actual: { exists: false },
            passed: false,
            error: "File does not exist",
          });
          failed++;
          logFile({ file, action: "verify", status: "failed", error: "File does not exist" });
          continue;
        }

        const stat = fs.statSync(destPath);
        const actualSize = stat.size;
        const sizeMatch = actualSize === expectedSize;

        items.push({
          file,
          expected: { size: expectedSize },
          actual: { exists: true, size: actualSize },
          passed: sizeMatch,
          error: sizeMatch ? undefined : `Size mismatch: expected ${expectedSize}, got ${actualSize}`,
        });

        if (sizeMatch) {
          passed++;
          logFile({ file, action: "verify", status: "success", size: actualSize });
        } else {
          failed++;
          logFile({
            file,
            action: "verify",
            status: "failed",
            size: actualSize,
            error: `Size mismatch: expected ${expectedSize}, got ${actualSize}`,
          });
        }
      }
    } catch (err: any) {
      items.push({
        file,
        expected: { size: expectedSize },
        passed: false,
        error: err.message || String(err),
      });
      failed++;
      logFile({ file, action: "verify", status: "failed", error: err.message || String(err) });
    }
  }

  // Count skipped (non-transferred) files
  skipped = transferResults.filter((r) => r.action === "skipped").length;

  const summary = {
    total: transferredItems.length,
    passed,
    failed,
    skipped,
  };

  log(`Verification complete: ${passed}/${summary.total} passed, ${failed} failed`);
  logPhase({
    phase: "verify",
    status: "complete",
    summary: `${passed}/${summary.total} passed, ${failed} failed`,
    details: summary,
  });

  return {
    job,
    items,
    summary,
  };
}
