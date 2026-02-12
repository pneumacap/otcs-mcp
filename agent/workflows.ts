/**
 * Minimal workflow helpers for the autonomous agent.
 * Only retains document download — all processing is handled by the agentic loop.
 */

import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { handleToolCall } from "../packages/core/src/tools/handler.js";

// ── Download document text ──

export async function downloadDocument(
  client: OTCSClient,
  nodeId: number,
): Promise<string> {
  const docResult = await handleToolCall(client, "otcs_download_content", { node_id: nodeId });
  const text = (docResult as any)?.text_content || "";
  if (!text) throw new Error("No text content extracted");
  return text;
}
