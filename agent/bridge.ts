/**
 * Re-export bridge functions and tool definitions for the agent.
 * Uses dynamic imports to handle CJS/ESM interop with tsx.
 */

import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "../src/client/otcs-client.js";

let _tools: Anthropic.Tool[];
let _handleToolCall: (client: OTCSClient, name: string, args: Record<string, unknown>) => Promise<unknown>;
let _getSuggestion: (error: string) => string;
let _initialized = false;

export async function initBridge() {
  if (_initialized) return;

  const toolDefs: any = await import("../web/src/lib/tool-definitions.js");
  const bridge: any = await import("../web/src/lib/otcs-bridge.js");

  // Handle CJS/ESM interop — exports may be under .default
  const td = toolDefs.OTCS_TOOLS ?? toolDefs.default?.OTCS_TOOLS;
  const htc = bridge.handleToolCall ?? bridge.default?.handleToolCall;
  const gs = bridge.getSuggestion ?? bridge.default?.getSuggestion;

  if (!td) throw new Error("Failed to load OTCS_TOOLS from tool-definitions");
  if (!htc) throw new Error("Failed to load handleToolCall from otcs-bridge");
  if (!gs) throw new Error("Failed to load getSuggestion from otcs-bridge");

  _tools = td;
  _handleToolCall = htc;
  _getSuggestion = gs;
  _initialized = true;
}

export function getTools(): Anthropic.Tool[] {
  return _tools;
}

export function handleToolCall(client: OTCSClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  return _handleToolCall(client, name, args);
}

export function getSuggestion(error: string): string {
  return _getSuggestion(error);
}
