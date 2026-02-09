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

// ── Classify & extract (single LLM call) ──

const CLASSIFY_PROMPT = `Analyze this document and return ONLY valid JSON with the following fields:

{
  "documentType": "the type of document (e.g. subpoena, invoice, contract, report, memo, policy, etc.)",
  "summary": "one sentence summary of what this document is about",
EXTRA_FIELDS}

Be precise. Return ONLY the JSON object, no explanation.

Document text:
`;

async function classifyDocument(
  documentText: string,
  extractFields: Record<string, string>,
  model: string,
) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  let fieldLines = '';
  for (const [field, hint] of Object.entries(extractFields)) {
    fieldLines += `  "${field}": "${hint}",\n`;
  }

  const prompt = CLASSIFY_PROMPT.replace('EXTRA_FIELDS', fieldLines) + documentText.slice(0, 8000);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON');

  return {
    extraction: JSON.parse(jsonMatch[0]) as Record<string, unknown>,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

// ── Rule matching ──

function doesRuleMatch(
  extraction: Record<string, unknown>,
  match: Record<string, unknown>,
): boolean {
  if (!match || Object.keys(match).length === 0) return true;

  for (const [key, pattern] of Object.entries(match)) {
    const extracted = String(extraction[key] ?? '').toLowerCase();
    const target = String(pattern).toLowerCase();
    if (!extracted.includes(target)) return false;
  }
  return true;
}

// ── Agentic loop (live execution) ──

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

  let body: { nodeId: number; mode?: 'dry' | 'live' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.nodeId || typeof body.nodeId !== 'number') {
    return NextResponse.json({ error: 'nodeId (number) is required' }, { status: 400 });
  }

  const mode = body.mode || 'dry';
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

    // Step 4: Classify & extract
    const classifyStart = Date.now();
    const extractFields = (agent.extractFields as Record<string, string>) || {};
    let extraction: Record<string, unknown>;
    let classifyUsage: { inputTokens: number; outputTokens: number };
    try {
      const result = await classifyDocument(documentText, extractFields, agent.model);
      extraction = result.extraction;
      classifyUsage = result.usage;
      steps.push({ step: 'Classify & extract (LLM)', status: 'success', detail: `Type: ${extraction.documentType} | ${classifyUsage.inputTokens + classifyUsage.outputTokens} tokens`, durationMs: Date.now() - classifyStart });
    } catch (err: any) {
      steps.push({ step: 'Classify & extract (LLM)', status: 'error', detail: err.message, durationMs: Date.now() - classifyStart });
      return NextResponse.json({ steps, totalDurationMs: Date.now() - startTime });
    }

    // Step 5: Rule matching
    const matchStart = Date.now();
    const agentMatch = (agent.match as Record<string, unknown>) || {};
    const matched = doesRuleMatch(extraction, agentMatch);
    steps.push({
      step: 'Rule matching',
      status: matched ? 'success' : 'warning',
      detail: matched
        ? `Matched: ${JSON.stringify(agentMatch)}`
        : `No match. Extracted: ${JSON.stringify(extraction.documentType)} vs rule: ${JSON.stringify(agentMatch)}`,
      durationMs: Date.now() - matchStart,
    });

    // Step 6: Execute or dry-run
    const actions = (agent.actions as Record<string, unknown>[]) || [];
    let agentToolCalls: ToolCallRecord[] | undefined;
    let agentFinalText: string | undefined;
    let agentRounds: number | undefined;
    let agentUsage: { inputTokens: number; outputTokens: number } | undefined;

    if (!matched) {
      steps.push({ step: 'Actions (skipped)', status: 'warning', detail: 'Rule did not match — agent would skip this document', durationMs: 0 });
    } else if (mode === 'dry') {
      // Dry run — just report what would happen
      if (actions.length > 0) {
        const actionSummary = actions.map((a, i) => `${i + 1}. ${a.type}`).join(', ');
        steps.push({ step: 'Actions (dry run)', status: 'info', detail: `Would execute ${actions.length} action(s): ${actionSummary}`, durationMs: 0 });
      } else if (agent.instructions) {
        steps.push({ step: 'Agentic mode (dry run)', status: 'info', detail: `Would run AI agent loop with ${agent.maxRounds} max rounds using instructions`, durationMs: 0 });
      }
    } else if (matched && actions.length > 0) {
      // Live run — PROGRAMMATIC path (cheap: 0 LLM calls)
      // Template resolver: replaces {{field}} with extracted values
      const resolve = (tmpl: string) => tmpl.replace(/\{\{(\w+)\}\}/g, (_, key) => String(extraction[key] ?? ''));
      const resolveAny = (value: unknown): unknown => {
        if (typeof value === 'string') return resolve(value);
        if (Array.isArray(value)) return value.map(resolveAny);
        if (value && typeof value === 'object') {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(value)) out[k] = resolveAny(v);
          return out;
        }
        return value;
      };

      agentToolCalls = [];
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const actionType = action.type as string;
        const execStart = Date.now();

        if (actionType === 'update_description') {
          const fields = (action.fields as string[]) || Object.keys(extraction).filter(k => k !== 'documentType' && k !== 'summary');
          const separator = (action.separator as string) || '\n';
          const template = action.template as string | undefined;

          let description: string;
          if (template) {
            description = resolve(template);
          } else {
            const lines: string[] = [];
            for (const field of fields) {
              const value = extraction[field];
              if (value === null || value === undefined) continue;
              const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
              const formatted = Array.isArray(value) ? value.join('; ') : String(value);
              lines.push(`${label}: ${formatted}`);
            }
            description = lines.join(separator);
          }

          try {
            await handleToolCall(client, 'otcs_node_action', {
              action: 'update_description',
              node_id: body.nodeId,
              description,
            });
            agentToolCalls.push({ name: 'update_description', args: { fields: fields.length }, result: `Updated (${description.length} chars)`, isError: false });
            steps.push({ step: `Action ${i + 1}: update_description`, status: 'success', detail: `${fields.length} fields → ${description.length} chars`, durationMs: Date.now() - execStart });
          } catch (err: any) {
            agentToolCalls.push({ name: 'update_description', args: {}, result: err.message, isError: true });
            steps.push({ step: `Action ${i + 1}: update_description`, status: 'error', detail: err.message, durationMs: Date.now() - execStart });
          }
        } else if (actionType === 'categorize') {
          const categoryName = resolve((action.category as string) || '');
          let categoryId = action.category_id as number | undefined;
          const attributes = action.attributes ? resolveAny(action.attributes) as Record<string, unknown> : undefined;
          const fallbackToDesc = action.fallbackToDescription === true;

          // Try to find category by name via search
          if (!categoryId && categoryName) {
            try {
              const searchResult = await client.search({
                query: `OTName:"${categoryName}" AND OTSubType:131`,
                lookfor: 'complexquery',
                limit: 5,
              });
              const match = searchResult.results.find(
                (r) => r.name.toLowerCase() === categoryName.toLowerCase(),
              );
              if (match) categoryId = match.id;
            } catch { /* fall through */ }
          }

          let applied = false;
          if (categoryId) {
            try {
              await client.addCategory(body.nodeId, categoryId, attributes);
              agentToolCalls.push({ name: 'categorize', args: { category: categoryName, id: categoryId }, result: 'Applied', isError: false });
              steps.push({ step: `Action ${i + 1}: categorize`, status: 'success', detail: `Applied "${categoryName}" (ID: ${categoryId})`, durationMs: Date.now() - execStart });
              applied = true;
            } catch (err: any) {
              if (!fallbackToDesc) {
                agentToolCalls.push({ name: 'categorize', args: { category: categoryName }, result: err.message, isError: true });
                steps.push({ step: `Action ${i + 1}: categorize`, status: 'error', detail: err.message, durationMs: Date.now() - execStart });
                applied = true; // skip fallback
              }
            }
          }

          if (!applied && fallbackToDesc && attributes) {
            const lines = [`[${categoryName}]`];
            for (const [key, value] of Object.entries(attributes)) {
              if (value !== null && value !== undefined && value !== '') lines.push(`${key}: ${value}`);
            }
            try {
              await handleToolCall(client, 'otcs_node_action', {
                action: 'update_description',
                node_id: body.nodeId,
                description: lines.join('\n'),
              });
              agentToolCalls.push({ name: 'categorize', args: { category: categoryName }, result: `Fallback: wrote ${Object.keys(attributes).length} attrs to description`, isError: false });
              steps.push({ step: `Action ${i + 1}: categorize`, status: 'warning', detail: `Category not found — wrote ${Object.keys(attributes).length} attrs to description`, durationMs: Date.now() - execStart });
            } catch (err: any) {
              agentToolCalls.push({ name: 'categorize', args: { category: categoryName }, result: err.message, isError: true });
              steps.push({ step: `Action ${i + 1}: categorize`, status: 'error', detail: `Fallback error: ${err.message}`, durationMs: Date.now() - execStart });
            }
          } else if (!applied) {
            agentToolCalls.push({ name: 'categorize', args: { category: categoryName }, result: 'Category not found, no fallback', isError: true });
            steps.push({ step: `Action ${i + 1}: categorize`, status: 'error', detail: `Category "${categoryName}" not found`, durationMs: Date.now() - execStart });
          }
        } else if (actionType === 'create_folder') {
          const folderName = resolve((action.name as string) || '');
          const parentId = typeof action.parent === 'string'
            ? parseInt(resolve(action.parent as string), 10)
            : action.parent as number;

          try {
            const existing = await client.findChildByName(parentId, folderName);
            if (existing) {
              extraction.createdFolderId = existing.id;
              agentToolCalls.push({ name: 'create_folder', args: { name: folderName, parent: parentId }, result: `Exists: ID ${existing.id}`, isError: false });
              steps.push({ step: `Action ${i + 1}: create_folder`, status: 'success', detail: `"${folderName}" already exists (ID: ${existing.id})`, durationMs: Date.now() - execStart });
            } else {
              const created = await client.createFolder(parentId, folderName);
              extraction.createdFolderId = created.id;
              agentToolCalls.push({ name: 'create_folder', args: { name: folderName, parent: parentId }, result: `Created: ID ${created.id}`, isError: false });
              steps.push({ step: `Action ${i + 1}: create_folder`, status: 'success', detail: `Created "${folderName}" (ID: ${created.id})`, durationMs: Date.now() - execStart });
            }
          } catch (err: any) {
            agentToolCalls.push({ name: 'create_folder', args: { name: folderName, parent: parentId }, result: err.message, isError: true });
            steps.push({ step: `Action ${i + 1}: create_folder`, status: 'error', detail: err.message, durationMs: Date.now() - execStart });
          }
        } else if (actionType === 'move') {
          const destId = typeof action.destination === 'string'
            ? parseInt(resolve(action.destination as string), 10)
            : action.destination as number;

          try {
            await handleToolCall(client, 'otcs_node_action', {
              action: 'move',
              node_id: body.nodeId,
              destination_id: destId,
            });
            agentToolCalls.push({ name: 'move', args: { destination: destId }, result: 'Moved', isError: false });
            steps.push({ step: `Action ${i + 1}: move`, status: 'success', detail: `Moved to folder ${destId}`, durationMs: Date.now() - execStart });
          } catch (err: any) {
            agentToolCalls.push({ name: 'move', args: { destination: destId }, result: err.message, isError: true });
            steps.push({ step: `Action ${i + 1}: move`, status: 'error', detail: err.message, durationMs: Date.now() - execStart });
          }
        } else {
          steps.push({ step: `Action ${i + 1}: ${actionType}`, status: 'info', detail: 'Action type not yet supported in live test', durationMs: 0 });
        }
      }
      agentFinalText = `Executed ${actions.length} programmatic action(s) — 0 additional LLM calls.`;
    } else {
      // Live run — AGENTIC fallback (expensive: multiple LLM rounds)
      const execStart = Date.now();
      try {
        const instructions = agent.instructions || 'Determine the appropriate action for this document.';
        const systemPrompt = agent.systemPrompt || 'You are an autonomous document processing agent for OpenText Content Server.';
        const toolFilter = (agent.tools as string[]) || [];

        const userMessage = [
          `New document uploaded: "${nodeName}" (ID: ${body.nodeId}, type: ${mimeType}).`,
          `Classification: ${JSON.stringify(extraction)}`,
          instructions,
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
          step: 'Agent execution (LIVE)',
          status: errorCount > 0 ? 'warning' : 'success',
          detail: `${result.rounds} round(s), ${result.toolCalls.length} tool call(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}, ${result.usage.inputTokens + result.usage.outputTokens} tokens`,
          durationMs: Date.now() - execStart,
        });
      } catch (err: any) {
        steps.push({ step: 'Agent execution (LIVE)', status: 'error', detail: err.message, durationMs: Date.now() - execStart });
      }
    }

    // Combine usage + compute cost
    const totalInput = classifyUsage!.inputTokens + (agentUsage?.inputTokens || 0);
    const totalOutput = classifyUsage!.outputTokens + (agentUsage?.outputTokens || 0);
    const costUsd = totalInput * (3 / 1_000_000) + totalOutput * (15 / 1_000_000);
    const totalUsage = { inputTokens: totalInput, outputTokens: totalOutput, costUsd };

    return NextResponse.json({
      steps,
      extraction,
      matched,
      nodeName,
      mode,
      usage: totalUsage,
      // Live-run only fields
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
