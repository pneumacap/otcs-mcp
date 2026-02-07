import { NextRequest } from "next/server";
import { OTCSClient } from "@otcs/core/client";
import { runAgenticLoop } from "@/lib/ai-orchestrator";

// Single shared client instance (MVP)
let sharedClient: OTCSClient | null = null;

function getClient(): OTCSClient {
  if (!sharedClient) {
    sharedClient = new OTCSClient({
      baseUrl: process.env.OTCS_BASE_URL!,
      username: process.env.OTCS_USERNAME,
      password: process.env.OTCS_PASSWORD,
      domain: process.env.OTCS_DOMAIN,
    });
  }
  return sharedClient;
}

export async function POST(request: NextRequest) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { messages: Array<{ role: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = getClient();

  // Auto-authenticate if not already
  if (!client.isAuthenticated()) {
    try {
      await client.authenticate();
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: `OTCS authentication failed: ${err.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Convert frontend messages to Anthropic format
  const anthropicMessages = body.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const usageTotals = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
      let rounds = 0;
      try {
        for await (const event of runAgenticLoop(
          client,
          anthropicApiKey,
          anthropicMessages
        )) {
          if (event.type === "usage") {
            rounds++;
            const u = event.usage;
            usageTotals.input += u.input_tokens || 0;
            usageTotals.output += u.output_tokens || 0;
            usageTotals.cache_read += u.cache_read_input_tokens || 0;
            usageTotals.cache_write += u.cache_creation_input_tokens || 0;
          }
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err: any) {
        const errorEvent = `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      }

      // Log usage summary
      if (rounds > 0) {
        const cost =
          Math.max(0, usageTotals.input - usageTotals.cache_read - usageTotals.cache_write) * (3 / 1_000_000) +
          usageTotals.output * (15 / 1_000_000) +
          usageTotals.cache_read * (0.30 / 1_000_000) +
          usageTotals.cache_write * (3.75 / 1_000_000);
        console.log(
          `[USAGE] input=${usageTotals.input} output=${usageTotals.output} cache_read=${usageTotals.cache_read} cache_write=${usageTotals.cache_write} rounds=${rounds} cost=$${cost.toFixed(4)}`
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
