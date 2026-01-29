import { NextRequest } from "next/server";
import { OTCSClient } from "@otcs/client";
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
      try {
        for await (const event of runAgenticLoop(
          client,
          anthropicApiKey,
          anthropicMessages
        )) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err: any) {
        const errorEvent = `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
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
