#!/usr/bin/env node
/**
 * Chat API timing test — chains multiple prompts and logs detailed timing
 * for each round-trip, tool call, and total conversation.
 *
 * Usage: node test-chat-timing.mjs
 */

const BASE_URL = "http://localhost:3000";

// Conversation state — accumulates messages across prompts
const conversationMessages = [];

// Timing log
const timingLog = [];

/**
 * Send a prompt to the chat API and collect the full SSE response.
 * Returns structured data about what happened.
 */
async function sendPrompt(prompt, promptIndex) {
  conversationMessages.push({ role: "user", content: prompt });

  const t0 = Date.now();
  let firstTokenTime = null;
  const toolCalls = [];
  let currentToolCall = null;
  let fullText = "";
  let stopReason = "";
  let error = null;
  const usageEvents = [];

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationMessages }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        let event;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        const now = Date.now();

        switch (event.type) {
          case "text_delta":
            if (!firstTokenTime) firstTokenTime = now;
            fullText += event.text;
            break;

          case "tool_call_start":
            currentToolCall = {
              name: event.name,
              args: event.args,
              startTime: now,
              endTime: null,
              result: null,
              isError: false,
              durationMs: 0,
            };
            break;

          case "tool_result":
            if (currentToolCall) {
              currentToolCall.endTime = now;
              currentToolCall.durationMs = now - currentToolCall.startTime;
              currentToolCall.isError = event.isError || false;
              // Truncate result for logging
              const resultStr = event.result || "";
              currentToolCall.resultLength = resultStr.length;
              currentToolCall.resultPreview = resultStr.slice(0, 200);
              toolCalls.push(currentToolCall);
              currentToolCall = null;
            }
            break;

          case "usage":
            usageEvents.push(event.usage);
            break;

          case "done":
            stopReason = event.stopReason;
            break;

          case "error":
            error = event.message;
            break;
        }
      }
    }
  } catch (err) {
    error = err.message;
  }

  const totalTime = Date.now() - t0;
  const ttft = firstTokenTime ? firstTokenTime - t0 : null;
  const totalToolTime = toolCalls.reduce((sum, tc) => sum + tc.durationMs, 0);

  // Add assistant response to conversation for next round
  if (fullText) {
    conversationMessages.push({ role: "assistant", content: fullText });
  }

  const result = {
    promptIndex,
    prompt,
    totalTimeMs: totalTime,
    timeToFirstTokenMs: ttft,
    totalToolTimeMs: totalToolTime,
    aiThinkingTimeMs: totalTime - totalToolTime,
    toolCallCount: toolCalls.length,
    toolCalls: toolCalls.map((tc) => ({
      name: tc.name,
      args: summarizeArgs(tc.args),
      durationMs: tc.durationMs,
      isError: tc.isError,
      resultLength: tc.resultLength,
    })),
    responseLength: fullText.length,
    responsePreview: fullText.slice(0, 300),
    stopReason,
    error,
    usageEvents,
  };

  timingLog.push(result);
  return result;
}

function summarizeArgs(args) {
  if (!args) return {};
  const summary = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && v.length > 100) {
      summary[k] = v.slice(0, 100) + "...";
    } else {
      summary[k] = v;
    }
  }
  return summary;
}

function printResult(result) {
  const divider = "═".repeat(80);
  const thinDivider = "─".repeat(80);

  console.log(`\n${divider}`);
  console.log(`PROMPT #${result.promptIndex + 1}: "${result.prompt}"`);
  console.log(divider);

  if (result.error) {
    console.log(`  ❌ ERROR: ${result.error}`);
    return;
  }

  console.log(`  ⏱  Total time:          ${(result.totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`  ⏱  Time to first token: ${result.timeToFirstTokenMs ? (result.timeToFirstTokenMs / 1000).toFixed(2) + "s" : "N/A"}`);
  console.log(`  ⏱  AI thinking time:    ${(result.aiThinkingTimeMs / 1000).toFixed(2)}s`);
  console.log(`  ⏱  Tool execution time: ${(result.totalToolTimeMs / 1000).toFixed(2)}s`);
  console.log(`  🔧 Tool calls:          ${result.toolCallCount}`);
  console.log(`  📝 Response length:     ${result.responseLength} chars`);
  console.log(`  🏁 Stop reason:         ${result.stopReason}`);

  if (result.usageEvents && result.usageEvents.length > 0) {
    console.log(`\n  Token usage (per API round):`);
    console.log(`  ${thinDivider}`);
    for (let i = 0; i < result.usageEvents.length; i++) {
      const u = result.usageEvents[i];
      const cached = u.cache_read_input_tokens || 0;
      const created = u.cache_creation_input_tokens || 0;
      console.log(
        `  Round ${i + 1}: input=${u.input_tokens} output=${u.output_tokens} cache_read=${cached} cache_create=${created}`
      );
    }
  }

  if (result.toolCalls.length > 0) {
    console.log(`\n  Tool call breakdown:`);
    console.log(`  ${thinDivider}`);
    for (const tc of result.toolCalls) {
      const status = tc.isError ? "❌" : "✅";
      const argsStr = JSON.stringify(tc.args);
      console.log(`  ${status} ${tc.name} (${tc.durationMs}ms) — ${tc.resultLength} bytes`);
      console.log(`     args: ${argsStr.slice(0, 120)}`);
    }
  }

  console.log(`\n  Response preview:`);
  console.log(`  ${thinDivider}`);
  const preview = result.responsePreview.replace(/\n/g, "\n  ");
  console.log(`  ${preview}${result.responseLength > 300 ? "..." : ""}`);
}

function printSummary() {
  const divider = "═".repeat(80);
  console.log(`\n\n${divider}`);
  console.log("TIMING SUMMARY");
  console.log(divider);

  const totalConversationTime = timingLog.reduce((s, r) => s + r.totalTimeMs, 0);
  const totalToolCalls = timingLog.reduce((s, r) => s + r.toolCallCount, 0);
  const totalToolTime = timingLog.reduce((s, r) => s + r.totalToolTimeMs, 0);
  const totalAITime = timingLog.reduce((s, r) => s + r.aiThinkingTimeMs, 0);

  console.log(`\n  Total conversation time: ${(totalConversationTime / 1000).toFixed(2)}s`);
  console.log(`  Total AI thinking time:  ${(totalAITime / 1000).toFixed(2)}s (${((totalAITime / totalConversationTime) * 100).toFixed(0)}%)`);
  console.log(`  Total tool exec time:    ${(totalToolTime / 1000).toFixed(2)}s (${((totalToolTime / totalConversationTime) * 100).toFixed(0)}%)`);
  console.log(`  Total tool calls:        ${totalToolCalls}`);

  console.log(`\n  Per-prompt breakdown:`);
  console.log(`  ${"#".padEnd(3)} ${"Prompt".padEnd(45)} ${"Total".padEnd(10)} ${"AI".padEnd(10)} ${"Tools".padEnd(10)} ${"#TC".padEnd(5)}`);
  console.log(`  ${"-".repeat(83)}`);

  for (const r of timingLog) {
    const promptShort = r.prompt.length > 43 ? r.prompt.slice(0, 40) + "..." : r.prompt;
    console.log(
      `  ${String(r.promptIndex + 1).padEnd(3)} ${promptShort.padEnd(45)} ${((r.totalTimeMs / 1000).toFixed(1) + "s").padEnd(10)} ${((r.aiThinkingTimeMs / 1000).toFixed(1) + "s").padEnd(10)} ${((r.totalToolTimeMs / 1000).toFixed(1) + "s").padEnd(10)} ${String(r.toolCallCount).padEnd(5)}`
    );
  }

  // Identify bottlenecks
  console.log(`\n  Slowest tool calls:`);
  const allToolCalls = timingLog.flatMap((r, i) =>
    r.toolCalls.map((tc) => ({ ...tc, promptIndex: i + 1 }))
  );
  allToolCalls
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5)
    .forEach((tc) => {
      console.log(
        `    ${tc.durationMs}ms — ${tc.name} (prompt #${tc.promptIndex}) ${JSON.stringify(tc.args).slice(0, 80)}`
      );
    });
}

// ============================================================
// Test scenarios
// ============================================================

const TEST_PROMPTS = [
  // Prompt 1: Browse root — should be a single otcs_browse call
  "Show me the contents of the Enterprise Workspace",

  // Prompt 2: Navigate deeper — should use ID from prompt 1 (no search)
  "Open the first folder you found and list its contents",

  // Prompt 3: Search — should be a single otcs_search call
  "Search for all invoices in the repository",

  // Prompt 4: Follow-up using IDs from context — should NOT need to re-search
  "Read the content of the first invoice you found and tell me the total amount",

  // Prompt 5: Action — should use ID from context directly
  "What is the description of that document? Update it to say 'Reviewed by AI assistant'",
];

async function main() {
  console.log("🚀 Starting chat API timing test...");
  console.log(`   Server: ${BASE_URL}`);
  console.log(`   Prompts: ${TEST_PROMPTS.length}`);
  console.log("");

  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    console.log(`\n⏳ Sending prompt #${i + 1}...`);
    const result = await sendPrompt(TEST_PROMPTS[i], i);
    printResult(result);
  }

  printSummary();

  // Write full log to file
  const logPath = new URL("./test-chat-timing-results.json", import.meta.url).pathname;
  const fs = await import("fs");
  fs.writeFileSync(logPath, JSON.stringify(timingLog, null, 2));
  console.log(`\n📄 Full timing log written to: ${logPath}`);
}

main().catch(console.error);
