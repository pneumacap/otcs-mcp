import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { generateAgentSchema, parseOrError } from '@/lib/validations';

const GENERATION_PROMPT = `You are an expert at configuring agentic document processing agents for OpenText Content Server (OTCS).

Given a user's description of what they want automated, generate an agent configuration. The agent system works like this:
1. It monitors OTCS folders for new document uploads
2. When a document arrives, it downloads the text content
3. It runs an AI agent loop with the configured instructions and available OTCS tools
4. The agent uses tool calls to interact with OTCS (search, create folders, apply holds, categorize, etc.)

Available OTCS tools the agent can use:
otcs_search, otcs_download_content, otcs_get_node, otcs_browse, otcs_node_action, otcs_rm_holds, otcs_share, otcs_categories, otcs_start_workflow, otcs_workflow_task, otcs_workflow_form, otcs_get_assignments, otcs_workflow_tasks, otcs_upload, otcs_create_folder, otcs_permissions, otcs_members, otcs_versions, otcs_rm_classification, otcs_rm_rsi, otcs_rm_xref

Return ONLY a valid JSON object with these fields:
{
  "instructions": "Detailed step-by-step instructions for the AI agent. Be specific about what to do with each document.",
  "systemPrompt": "A concise system prompt describing the agent's role (1-2 sentences)",
  "tools": ["tool1", "tool2"]
}

Rules:
- instructions must be detailed, step-by-step, and specific to the use case
- tools should list only the OTCS tools needed for this workflow (from the list above)
- systemPrompt should be concise — it sets the agent's persona/context
- The agent receives the full document text, so it can analyze content, extract fields, make decisions, and take actions all within the agentic loop
- When the user mentions workflows, include the relevant workflow tools (otcs_start_workflow, otcs_workflow_task, otcs_workflow_form, etc.)
- When the user mentions legal holds, include otcs_rm_holds
- When the user mentions sharing, include otcs_share
- When the user mentions categorization, include otcs_categories`;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseOrError(generateAgentSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, description } = parsed.data;

  try {
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: GENERATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Agent name: "${name}"\n\nDescription of what the user wants automated:\n${description}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to generate agent configuration. Please try again.' },
        { status: 500 },
      );
    }

    const generated = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      generated,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (err: any) {
    console.error('Agent generation error:', err);
    return NextResponse.json(
      { error: `Generation failed: ${err.message}` },
      { status: 500 },
    );
  }
}
