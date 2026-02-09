import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { generateAgentSchema, parseOrError } from '@/lib/validations';

const GENERATION_PROMPT = `You are an expert at configuring document automation agents for OpenText Content Server. Given a user's description of what they want automated, generate a complete agent configuration.

IMPORTANT COST MODEL:
- The ONLY LLM call is document classification + extraction (step 2). This costs ~$0.003.
- Programmatic actions (step 4) cost $0 — they are pure API calls, no AI.
- Agentic mode (fallback) costs $0.02-0.05+ per document — it runs multiple LLM rounds with tool calls.
- ALWAYS prefer programmatic actions. Only use agentic mode for tasks that genuinely require multi-step reasoning that cannot be pre-defined.

The agent system works like this:
1. It monitors OTCS folders for new document uploads
2. When a document arrives, it downloads and classifies it using AI (1 LLM call — this is the ONLY LLM call in the programmatic path)
3. It matches the document against rules using extracted fields (programmatic, free)
4. It executes programmatic actions in order (programmatic, free) OR falls back to agentic AI loop (expensive, last resort)

Available programmatic action types (PREFER THESE — they are free):
- "search": Run a search query. Fields: query (string with {{field}} templates), filter ("documents"|"folders"), exclude (string[] of patterns to exclude), filterField (optional — name of an extraction field containing keyword phrases to filter results for responsiveness). For employee/person lookups, prefer a simple ID-based query like "{{employeeId}} {{personName}}" with filterField for document-type filtering, rather than smart_search with AI-generated queries.
- "smart_search": Run multiple LQL queries + keyword filtering. Fields: queriesField (field name containing queries), filterField (field name containing filter keywords), filter, exclude. Only use when you need multiple distinct query strategies — prefer "search" with filterField for simpler cases.
- "copy": Copy collected documents (from search results) to a folder. Fields: destination (folder ID or {{field}} template — use {{createdFolderId}} to copy into the most recently created folder). Copies all documentIds found by a prior search action.
- "ensure_hold": Find or create a legal hold. Fields: name (string with {{field}} templates), holdType ("Legal"|"Administrative"), comment
- "apply_hold": Apply the hold from ensure_hold to search results
- "share": Share documents via email. Fields: email, perm (1=Viewer, 2=Collaborator, 3=Manager, 4=Owner), message
- "create_folder": Find or create a folder (idempotent). Fields: name (string with {{field}} templates), parent (folder ID or {{field}} template). Stores the folder ID in {{createdFolderId}} for subsequent actions.
- "move": Move the trigger document. Fields: destination (folder ID or {{field}} template — use {{createdFolderId}} if preceded by create_folder)
- "categorize": Apply a category by name. Fields: category (name), category_id (optional numeric ID), attributes (mapped from extraction), fallbackToDescription (boolean — if true and the category doesn't exist on the server, writes attributes to the node description instead). Always set fallbackToDescription: true unless you know the category exists.
- "update_description": Format extracted fields as key:value pairs and update the document description. Fields: fields (optional string[] of field names to include — defaults to all extracted fields except documentType/summary), template (optional string with {{field}} placeholders for custom format), separator (optional, default "\\n")
- "start_workflow": Start an OTCS workflow with the trigger document attached. Fields: workflow_id (number — the workflow map node ID in OTCS), mode (optional: "direct" (default), "draft", "initiate"), comment (optional string with {{field}} templates). Stores {{workflowWorkId}} for downstream actions. The user MUST provide the workflow_id — ask them for it if not specified. Never guess a workflow ID.
- "get_workflow_tasks": Get pending tasks for a workflow instance. Fields: process_id (optional — defaults to {{workflowWorkId}} from start_workflow). Stores {{workflowProcessId}}, {{workflowSubprocessId}}, {{workflowTaskId}} for complete_task.
- "get_workflow_form": Get the form schema for a workflow task. Fields: process_id, subprocess_id, task_id (all optional — default to stored values from get_workflow_tasks).
- "complete_task": Fill form data and advance a workflow task. Fields: process_id, subprocess_id, task_id (all optional — default to stored values), disposition (for standard actions like "SendOn"), custom_action (for custom disposition buttons like "Approve" or "Reject" — use {{field}} templates to let AI decide), comment (optional {{field}} template), form_data (object mapping WorkflowForm_N keys to {{field}} templates from extraction).
- "workflow_status": Query workflows by status. Fields: mode ("active" or "by_status"), map_id (optional), status (optional).
- "manage_workflow": Manage workflow lifecycle. Fields: action ("suspend"|"resume"|"stop"|"archive"|"delete"), process_id (optional — defaults to {{workflowWorkId}}).
- Common workflow chain: start_workflow → get_workflow_tasks → complete_task (with form_data mapped from extraction fields)

Available OTCS tools for agentic mode (LAST RESORT — expensive, multiple LLM calls):
otcs_search, otcs_download_content, otcs_get_node, otcs_browse, otcs_node_action, otcs_rm_holds, otcs_share, otcs_categories, otcs_start_workflow, otcs_workflow_task, otcs_workflow_form, otcs_get_assignments, otcs_workflow_tasks, otcs_upload, otcs_create_folder, otcs_permissions, otcs_members, otcs_versions, otcs_rm_classification, otcs_rm_rsi, otcs_rm_xref

Return ONLY a valid JSON object with these fields:
{
  "match": { "documentType": "...", "fileExtension": ".pdf,.docx", "mimeType": "application/pdf" },
  "instructions": "Only needed if actions array is empty. Step-by-step instructions for the AI agent.",
  "extractFields": { "fieldName": "extraction hint for the AI — describe what to look for" },
  "actions": [ { "type": "...", ... } ],
  "tools": ["tool1", "tool2"],
  "systemPrompt": "A concise system prompt describing the agent's role"
}

Rules:
- ALWAYS use programmatic actions when possible. This is critical for cost efficiency.
- Most use cases (tagging, categorizing, moving, sharing, legal holds) can be done 100% programmatically after extraction.
- "update_description" is the go-to action for annotating documents with extracted metadata.
- "categorize" is for applying OTCS categories with attribute values from extraction.
- Only use agentic mode (empty actions + instructions + tools) when the task genuinely requires multi-step reasoning that varies per document.
- extractFields should capture everything needed by the actions
- match.documentType should be lowercase document type keywords for classification matching. Supports comma-separated OR values: "agreement,contract,mou" matches any document type containing "agreement" OR "contract" OR "mou"
- match supports special file-level keys: "fileExtension" (e.g. ".tif,.tiff" or ".pdf") matches the file name, "mimeType" (e.g. "application/pdf") matches the MIME type. Use these to restrict an agent to specific file types. All match keys must pass (AND logic).
- When an agent targets specific file formats (e.g. TIF/TIFF images), use fileExtension instead of an empty catch-all match
- The systemPrompt should be 1-2 sentences describing the agent's purpose
- If using agentic mode, instructions must be detailed step-by-step; tools should list only needed OTCS tools
- Use {{fieldName}} template syntax in action parameters to reference extracted fields
- When the user mentions "tag", "annotate", "label", or "update description" — use the "update_description" action
- When the user mentions "categorize" or "apply category" — use the "categorize" action
- When the user mentions "organize into folders", "file by", or "move to folder" — use create_folder + move in sequence. The create_folder stores {{createdFolderId}} which move can reference.
- A common pattern for document processing: categorize (with fallbackToDescription) → update_description → create_folder → move`;

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
      model: 'claude-sonnet-4-5-20250929',
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
