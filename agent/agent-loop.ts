/**
 * Headless (non-streaming) agentic loop for the autonomous agent.
 *
 * Simplified version of web/src/lib/ai-orchestrator.ts that collects
 * results into a structured response instead of streaming SSE events.
 * Reuses handleToolCall/getSuggestion from otcs-bridge and OTCS_TOOLS
 * from tool-definitions via the bridge wrapper.
 */

import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { toAnthropicTools } from "../packages/core/src/tools/formats.js";
import { handleToolCall } from "../packages/core/src/tools/handler.js";
import { getSuggestion, compactToolResult } from "../packages/core/src/tools/utils.js";
import { log } from "./logger.js";

// ── Types ──

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  isError: boolean;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AgentResult {
  toolCalls: ToolCallRecord[];
  finalText: string;
  rounds: number;
  usage: AgentUsage;
}

// ── Agent loop ──

export async function runAgentLoop(
  client: OTCSClient,
  anthropicApiKey: string,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  maxRounds: number,
  model: string,
  toolFilter?: string[],
): Promise<AgentResult> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  let tools = toAnthropicTools();
  if (toolFilter && toolFilter.length > 0) {
    const allowed = new Set(toolFilter);
    tools = tools.filter((t) => allowed.has(t.name));
  }
  const allToolCalls: ToolCallRecord[] = [];
  const currentMessages = [...messages];
  let finalText = "";
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let round = 0;

  while (round < maxRounds) {
    round++;

    // Retry on transient errors (overloaded, rate limit)
    let response: Anthropic.Message;
    const MAX_RETRIES = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: tools as Anthropic.Tool[],
          messages: currentMessages,
        });
        break;
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode;
        const isRetryable = status === 429 || status === 529 || status === 503;
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = attempt * 5000;
          log(`  → API ${status}, retrying in ${delay / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    // Accumulate usage (including cache tokens)
    if (response.usage) {
      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;
      totalCacheRead += (response.usage as any).cache_read_input_tokens || 0;
      totalCacheWrite += (response.usage as any).cache_creation_input_tokens || 0;
    }

    // Collect text blocks
    for (const block of response.content) {
      if (block.type === "text") {
        finalText += block.text;
      }
    }

    // Extract tool_use blocks
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    // If no tool use, we're done
    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      break;
    }

    // Execute all tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolArgs = block.input as Record<string, unknown>;
      log(`  → Tool: ${block.name}(${JSON.stringify(toolArgs).slice(0, 120)})`);

      let resultContent: string;
      let isError = false;
      try {
        const result = await handleToolCall(client, block.name, toolArgs);
        resultContent = compactToolResult(block.name, result);
      } catch (err: any) {
        isError = true;
        const errorMsg = err.message || String(err);
        resultContent = JSON.stringify({
          error: true,
          message: errorMsg,
          suggestion: getSuggestion(errorMsg),
        });
        log(`  → Error: ${errorMsg}`);
      }

      allToolCalls.push({ name: block.name, args: toolArgs, result: resultContent, isError });

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: resultContent,
        is_error: isError,
      });
    }

    // Append assistant message and tool results for next round
    currentMessages.push({ role: "assistant", content: response.content });
    currentMessages.push({ role: "user", content: toolResults });
  }

  const usage: AgentUsage = {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCacheRead,
    cacheWriteTokens: totalCacheWrite,
  };

  // Log usage summary
  const nonCachedInput = Math.max(0, totalInput - totalCacheRead - totalCacheWrite);
  const cost =
    nonCachedInput * (3 / 1_000_000) +
    totalOutput * (15 / 1_000_000) +
    totalCacheRead * (0.3 / 1_000_000) +
    totalCacheWrite * (3.75 / 1_000_000);
  log(`  [USAGE] input=${totalInput} output=${totalOutput} cache_read=${totalCacheRead} cache_write=${totalCacheWrite} rounds=${round} cost=$${cost.toFixed(4)}`);

  return { toolCalls: allToolCalls, finalText, rounds: round, usage };
}
