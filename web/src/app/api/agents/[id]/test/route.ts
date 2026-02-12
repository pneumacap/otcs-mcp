import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { eq, and } from 'drizzle-orm';
import { OTCSClient } from '@otcs/core/client';
import { handleToolCall } from '@otcs/core/tools/handler';
import { toAnthropicTools } from '@otcs/core/tools/formats';
import { getSuggestion, compactToolResult } from '@otcs/core/tools/utils';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { db } from '@/db';
import { orgMemberships, otcsConnections, agents } from '@/db/schema';
import { decrypt } from '@/lib/crypto';

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

async function getClientForOrg(orgId: string): Promise<OTCSClient> {
  const [conn] = await db
    .select()
    .from(otcsConnections)
    .where(eq(otcsConnections.orgId, orgId))
    .limit(1);

  if (!conn) throw new Error('No OTCS connection configured. Go to Settings > Connections first.');

  const password = decrypt(conn.passwordEncrypted);
  const client = new OTCSClient({
    baseUrl: conn.baseUrl,
    username: conn.username,
    password,
    domain: conn.domain ?? undefined,
    tlsSkipVerify: conn.tlsSkipVerify ?? false,
  });
  await client.authenticate();
  return client;
}

// ── Agentic loop ──

interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  isError: boolean;
}

async function runAgentLoop(
  client: OTCSClient,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  maxRounds: number,
  model: string,
  toolFilter?: string[],
): Promise<{ toolCalls: ToolCallRecord[]; finalText: string; rounds: number; usage: { inputTokens: number; outputTokens: number } }> {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let tools = toAnthropicTools();
  if (toolFilter && toolFilter.length > 0) {
    const allowed = new Set(toolFilter);
    tools = tools.filter((t) => allowed.has(t.name));
  }

  const allToolCalls: ToolCallRecord[] = [];
  const currentMessages = [...messages];
  let finalText = '';
  let totalInput = 0;
  let totalOutput = 0;
  let round = 0;

  while (round < maxRounds) {
    round++;

    let response: Anthropic.Message;
    const MAX_RETRIES = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          tools: tools as Anthropic.Tool[],
          messages: currentMessages,
        });
        break;
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode;
        const isRetryable = status === 429 || status === 529 || status === 503;
        if (isRetryable && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 5000));
          continue;
        }
        throw err;
      }
    }

    if (response.usage) {
      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;
    }

    for (const block of response.content) {
      if (block.type === 'text') finalText += block.text;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolArgs = block.input as Record<string, unknown>;
      let resultContent: string;
      let isError = false;

      try {
        const result = await handleToolCall(client, block.name, toolArgs);
        resultContent = compactToolResult(block.name, result);
      } catch (err: any) {
        isError = true;
        resultContent = JSON.stringify({
          error: true,
          message: err.message || String(err),
          suggestion: getSuggestion(err.message || ''),
        });
      }

      allToolCalls.push({ name: block.name, args: toolArgs, result: resultContent, isError });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: resultContent,
        is_error: isError,
      });
    }

    currentMessages.push({ role: 'assistant', content: response.content });
    currentMessages.push({ role: 'user', content: toolResults });
  }

  return {
    toolCalls: allToolCalls,
    finalText,
    rounds: round,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
  };
}

// ── POST /api/agents/[id]/test ──

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { id } = await params;

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.orgId, orgId)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  let body: { nodeId: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.nodeId || typeof body.nodeId !== 'number') {
    return NextResponse.json({ error: 'nodeId (number) is required' }, { status: 400 });
  }

  const startTime = Date.now();
  const steps: { step: string; status: string; detail: string; durationMs: number }[] = [];

  try {
    // Step 1: Connect to OTCS
    const stepStart = Date.now();
    let client: OTCSClient;
    try {
      client = await getClientForOrg(orgId);
      steps.push({
        step: 'Connect to OTCS',
        status: 'success',
        detail: 'Authenticated successfully',
        durationMs: Date.now() - stepStart,
      });
    } catch (err: any) {
      steps.push({ step: 'Connect to OTCS', status: 'error', detail: err.message, durationMs: Date.now() - stepStart });
      return NextResponse.json({ steps, totalDurationMs: Date.now() - startTime });
    }

    // Step 2: Get document info
    const infoStart = Date.now();
    let nodeName = `Node ${body.nodeId}`;
    let mimeType = 'unknown';
    try {
      const nodeInfo = await handleToolCall(client, 'otcs_get_node', { node_id: body.nodeId });
      nodeName = (nodeInfo as any)?.name || nodeName;
      mimeType = (nodeInfo as any)?.mime_type || mimeType;
      steps.push({ step: 'Get document info', status: 'success', detail: `"${nodeName}" (ID: ${body.nodeId})`, durationMs: Date.now() - infoStart });
    } catch (err: any) {
      steps.push({ step: 'Get document info', status: 'error', detail: err.message, durationMs: Date.now() - infoStart });
      return NextResponse.json({ steps, totalDurationMs: Date.now() - startTime });
    }

    // Step 3: Download document text
    const dlStart = Date.now();
    let documentText: string;
    try {
      const dlResult = await handleToolCall(client, 'otcs_download_content', { node_id: body.nodeId });
      documentText = (dlResult as any)?.text_content || '';
      if (!documentText) throw new Error('No text content extracted from document');
      steps.push({ step: 'Download & extract text', status: 'success', detail: `${documentText.length} characters extracted`, durationMs: Date.now() - dlStart });
    } catch (err: any) {
      steps.push({ step: 'Download & extract text', status: 'error', detail: err.message, durationMs: Date.now() - dlStart });
      return NextResponse.json({ steps, totalDurationMs: Date.now() - startTime });
    }

    // Step 4: Run agentic loop
    const execStart = Date.now();
    let agentToolCalls: ToolCallRecord[] | undefined;
    let agentFinalText: string | undefined;
    let agentRounds: number | undefined;
    let agentUsage: { inputTokens: number; outputTokens: number } | undefined;

    try {
      const instructions = agent.instructions || 'Determine the appropriate action for this document.';
      const systemPrompt = agent.systemPrompt || 'You are an autonomous document processing agent for OpenText Content Server.';
      const toolFilter = (agent.tools as string[]) || [];

      const userMessage = [
        `New document uploaded: "${nodeName}" (ID: ${body.nodeId}, MIME: ${mimeType}).`,
        `Document text (first 8000 chars):\n${documentText.slice(0, 8000)}`,
        `\nInstructions:\n${instructions}`,
      ].join('\n\n');

      const result = await runAgentLoop(
        client,
        [{ role: 'user', content: userMessage }],
        systemPrompt,
        agent.maxRounds,
        agent.model,
        toolFilter.length > 0 ? toolFilter : undefined,
      );

      agentToolCalls = result.toolCalls;
      agentFinalText = result.finalText;
      agentRounds = result.rounds;
      agentUsage = result.usage;

      const errorCount = result.toolCalls.filter((tc) => tc.isError).length;
      steps.push({
        step: 'Agent execution',
        status: errorCount > 0 ? 'warning' : 'success',
        detail: `${result.rounds} round(s), ${result.toolCalls.length} tool call(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}, ${result.usage.inputTokens + result.usage.outputTokens} tokens`,
        durationMs: Date.now() - execStart,
      });
    } catch (err: any) {
      steps.push({ step: 'Agent execution', status: 'error', detail: err.message, durationMs: Date.now() - execStart });
    }

    // Compute cost
    const totalInput = agentUsage?.inputTokens || 0;
    const totalOutput = agentUsage?.outputTokens || 0;
    const costUsd = totalInput * (3 / 1_000_000) + totalOutput * (15 / 1_000_000);
    const totalUsage = { inputTokens: totalInput, outputTokens: totalOutput, costUsd };

    return NextResponse.json({
      steps,
      nodeName,
      usage: totalUsage,
      ...(agentToolCalls && {
        agentToolCalls: agentToolCalls.map((tc) => ({
          name: tc.name,
          args: tc.args,
          result: tc.result.slice(0, 500),
          isError: tc.isError,
        })),
      }),
      ...(agentFinalText && { agentSummary: agentFinalText.slice(0, 2000) }),
      ...(agentRounds !== undefined && { agentRounds }),
      totalDurationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    return NextResponse.json(
      { steps, error: err.message, totalDurationMs: Date.now() - startTime },
      { status: 500 },
    );
  }
}
