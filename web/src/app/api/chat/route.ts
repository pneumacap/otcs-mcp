import { NextRequest } from 'next/server';
import { OTCSClient } from '@otcs/core/client';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { runAgenticLoop } from '@/lib/ai-orchestrator';
import { chatRequestSchema, parseOrError } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { checkQuota, recordUsage } from '@/lib/quota';
import { db } from '@/db';
import { orgMemberships, otcsConnections } from '@/db/schema';
import { decrypt } from '@/lib/crypto';

// Cache clients per-org to avoid re-auth on every request
const clientCache = new Map<string, { client: OTCSClient; expiresAt: number }>();

async function getClientForOrg(orgId: string): Promise<OTCSClient> {
  // Check cache (15-min TTL)
  const cached = clientCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  // Fetch org's OTCS connection
  const [conn] = await db
    .select()
    .from(otcsConnections)
    .where(eq(otcsConnections.orgId, orgId))
    .limit(1);

  if (!conn) {
    throw new Error('NO_CONNECTION');
  }

  const password = decrypt(conn.passwordEncrypted);

  const client = new OTCSClient({
    baseUrl: conn.baseUrl,
    username: conn.username,
    password,
    domain: conn.domain ?? undefined,
    tlsSkipVerify: conn.tlsSkipVerify ?? false,
  });

  await client.authenticate();

  clientCache.set(orgId, { client, expiresAt: Date.now() + 15 * 60 * 1000 });
  return client;
}

export async function POST(request: NextRequest) {
  // --- Auth check ---
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userId = session.user.id;

  // --- Rate limit: 60 req/min per user ---
  const rl = rateLimit(`chat:${userId}`, 60, 60_000);
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.max(1, retryAfter)),
        },
      },
    );
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseOrError(chatRequestSchema, rawBody);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages } = parsed.data;

  // Get user's org
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);

  if (!membership) {
    return new Response(
      JSON.stringify({ error: 'No organization found. Please contact support.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Quota check
  const quota = await checkQuota(membership.orgId);
  if (!quota.allowed) {
    return new Response(
      JSON.stringify({
        error: `Monthly message limit reached (${quota.used}/${quota.limit}). Upgrade to Pro for unlimited messages.`,
        quota,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Get or create OTCS client for this org
  let client: OTCSClient;
  try {
    client = await getClientForOrg(membership.orgId);
  } catch (err: any) {
    if (err.message === 'NO_CONNECTION') {
      return new Response(
        JSON.stringify({
          error: 'No OTCS connection configured. Go to Settings > Connections to add one.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: `OTCS authentication failed: ${err.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Convert frontend messages to Anthropic format
  const anthropicMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const usageTotals = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
      let rounds = 0;
      try {
        for await (const event of runAgenticLoop(client, anthropicApiKey, anthropicMessages)) {
          if (event.type === 'usage') {
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
        const errorEvent = `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      }

      // Log + persist usage
      if (rounds > 0) {
        // Pricing per MTok by model
        const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
        const isHaiku = model.includes('haiku');
        const pricing = isHaiku
          ? { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 } // Haiku default
          : { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }; // Sonnet
        const cost =
          Math.max(0, usageTotals.input - usageTotals.cache_read - usageTotals.cache_write) *
            (pricing.input / 1_000_000) +
          usageTotals.output * (pricing.output / 1_000_000) +
          usageTotals.cache_read * (pricing.cacheRead / 1_000_000) +
          usageTotals.cache_write * (pricing.cacheWrite / 1_000_000);
        console.log(
          `[USAGE] user=${userId} org=${membership.orgId} input=${usageTotals.input} output=${usageTotals.output} cache_read=${usageTotals.cache_read} cache_write=${usageTotals.cache_write} rounds=${rounds} cost=$${cost.toFixed(4)}`,
        );

        // Persist to database (fire-and-forget)
        recordUsage({
          orgId: membership.orgId,
          userId: userId,
          inputTokens: usageTotals.input,
          outputTokens: usageTotals.output,
          cacheTokens: usageTotals.cache_read + usageTotals.cache_write,
          toolCalls: rounds,
          costUsd: cost,
        }).catch((err) => console.error('[USAGE] Failed to persist:', err.message));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
