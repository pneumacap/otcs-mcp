/**
 * AI Orchestrator — streaming agentic loop using Anthropic SDK.
 *
 * Sends messages to Claude, detects tool_use blocks, executes them
 * via otcs-bridge, feeds tool_result back, and repeats.
 * Yields SSE events for the frontend.
 */

import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "@otcs/client";
import { OTCS_TOOLS } from "./tool-definitions";
import { handleToolCall, getSuggestion } from "./otcs-bridge";
import { SYSTEM_PROMPT } from "./system-prompt";

const MAX_TOOL_ROUNDS = 10;

// SSE event types
export type SSEEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: string; isError?: boolean }
  | { type: "done"; stopReason: string }
  | { type: "error"; message: string };

/**
 * Run the agentic streaming loop.
 * Yields SSE events as the model streams text and invokes tools.
 */
export async function* runAgenticLoop(
  client: OTCSClient,
  anthropicApiKey: string,
  messages: Anthropic.MessageParam[]
): AsyncGenerator<SSEEvent> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  let currentMessages = [...messages];
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    // Use streaming so text appears incrementally
    let stream: ReturnType<typeof anthropic.messages.stream>;
    try {
      stream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: OTCS_TOOLS,
        messages: currentMessages,
      });
    } catch (err: any) {
      yield { type: "error", message: `Anthropic API error: ${err.message}` };
      return;
    }

    // Track content blocks as they stream in
    const contentBlocks: Map<number, { type: string; id?: string; name?: string; input?: string; text?: string }> = new Map();

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          contentBlocks.set(event.index, { type: "text", text: "" });
        } else if (event.content_block.type === "tool_use") {
          contentBlocks.set(event.index, {
            type: "tool_use",
            id: event.content_block.id,
            name: event.content_block.name,
            input: "",
          });
        }
      } else if (event.type === "content_block_delta") {
        const block = contentBlocks.get(event.index);
        if (block && event.delta.type === "text_delta") {
          yield { type: "text_delta", text: event.delta.text };
          block.text = (block.text || "") + event.delta.text;
        } else if (block && event.delta.type === "input_json_delta") {
          block.input = (block.input || "") + event.delta.partial_json;
        }
      }
    }

    // Get the final message for stop_reason and full content
    const response = await stream.finalMessage();

    // Extract tool_use blocks from the final message (reliable source for parsed input)
    const toolUseBlocks = response.content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    // If no tool use, we're done
    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      yield { type: "done", stopReason: response.stop_reason || "end_turn" };
      return;
    }

    // Execute all tool calls and build results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolArgs = block.input as Record<string, unknown>;

      yield {
        type: "tool_call_start",
        id: block.id,
        name: block.name,
        args: toolArgs,
      };

      let resultContent: string;
      let isError = false;
      try {
        const result = await handleToolCall(client, block.name, toolArgs);
        resultContent = JSON.stringify(result, null, 2);
      } catch (err: any) {
        isError = true;
        const errorMsg = err.message || String(err);
        resultContent = JSON.stringify({
          error: true,
          message: errorMsg,
          suggestion: getSuggestion(errorMsg),
        });
      }

      yield {
        type: "tool_result",
        id: block.id,
        name: block.name,
        result: resultContent,
        isError,
      };

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: resultContent,
        is_error: isError,
      });
    }

    // Append assistant message and tool results for next round
    currentMessages.push({
      role: "assistant",
      content: response.content,
    });
    currentMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  yield { type: "done", stopReason: "max_tool_rounds" };
}
