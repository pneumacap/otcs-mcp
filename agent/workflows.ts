/**
 * Generic workflow engine — 1 LLM call for classification/extraction,
 * then config-driven programmatic actions via direct API calls.
 *
 * Flow: download → classify (1 LLM call) → match rule → execute actions (free)
 *
 * The LLM only reads the document. Everything else is free.
 */

import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { handleToolCall } from "../packages/core/src/tools/handler.js";
import { log } from "./logger.js";

// ── Types ──

/** Extracted fields from the LLM — any key/value pairs (including arrays for search queries) */
export type Extraction = Record<string, string | number | string[] | null>;

/** A single programmatic action to execute */
export interface Action {
  type: "search" | "smart_search" | "ensure_hold" | "apply_hold" | "copy" | "share" | "move" | "categorize" | "update_description" | "create_folder" | "start_workflow" | "get_workflow_tasks" | "complete_task" | "get_workflow_form" | "workflow_status" | "manage_workflow";
  [key: string]: unknown;
}

/** Rule with optional programmatic actions */
export interface WorkflowRule {
  name: string;
  match: Record<string, string>;
  actions?: Action[];
  extractFields?: string[] | Record<string, string>; // Array or { field: hint } for custom prompts
  excludePatterns?: string[];
  instructions?: string;
  shareEmail?: string;
}

export interface WorkflowResult {
  rule: WorkflowRule | null;          // Which rule matched (null = no match)
  steps: { name: string; args: Record<string, unknown>; result: string }[];
  extraction: Extraction;
  finalSummary: string;
  llmTokens: { input: number; output: number };
  durationMs: number;
}

// ── Template resolver: replaces {{field}} with extracted values ──

function resolve(template: string, data: Extraction): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ""));
}

function resolveAny(value: unknown, data: Extraction): unknown {
  if (typeof value === "string") return resolve(value, data);
  if (Array.isArray(value)) return value.map((v) => resolveAny(v, data));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveAny(v, data);
    }
    return out;
  }
  return value;
}

// ── Text filtering helpers (shared by search and smart_search) ──

/** Normalize text for keyword matching: split camelCase, replace separators with spaces */
function normalizeText(s: string): string {
  return s.toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")   // camelCase → camel Case
    .replace(/[_\-./]/g, " ")               // separators → spaces
    .replace(/\s+/g, " ");
}

/** Check if a keyword phrase matches text (word-level: any word ≥3 chars must appear) */
function keywordMatchesText(kw: string, text: string): boolean {
  const words = kw.split(/\s+/).filter((w) => w.length >= 3);
  return words.some((word) => text.includes(word));
}

/** Parse a raw extraction value into a string array (handles arrays, JSON strings, CSV) */
function parseStringArray(raw: string | number | string[] | null): string[] {
  if (Array.isArray(raw)) return raw.map((k) => String(k).toLowerCase());
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((k: unknown) => String(k).toLowerCase());
      } catch {
        // fall through to CSV split
      }
    }
    return trimmed.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

// ── Download document text (free) ──

export async function downloadDocument(
  client: OTCSClient,
  nodeId: number,
): Promise<string> {
  const docResult = await handleToolCall(client, "otcs_download_content", { node_id: nodeId });
  const text = (docResult as any)?.text_content || "";
  if (!text) throw new Error("No text content extracted");
  return text;
}

// ── LLM classification & extraction (single call, no tools) ──

const CLASSIFY_PROMPT = `Analyze this document and return ONLY valid JSON with the following fields:

{
  "documentType": "the type of document (e.g. subpoena, invoice, contract, report, memo, policy, etc.)",
  "summary": "one sentence summary of what this document is about",
EXTRA_FIELDS}

Be precise. Return ONLY the JSON object, no explanation.

Document text:
`;

export async function classifyAndExtract(
  anthropicApiKey: string,
  model: string,
  documentText: string,
  extraFields?: Record<string, string>,
): Promise<{ extraction: Extraction; usage: { input: number; output: number; cacheRead: number; cacheWrite: number } }> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  // Build dynamic extraction fields from config — supports custom hints per field
  let fieldLines = "";
  if (extraFields) {
    for (const [field, hint] of Object.entries(extraFields)) {
      fieldLines += `  "${field}": "${hint}",\n`;
    }
  }

  const prompt = CLASSIFY_PROMPT.replace("EXTRA_FIELDS", fieldLines) + documentText.slice(0, 8000);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("LLM did not return valid JSON");

  return {
    extraction: JSON.parse(jsonMatch[0]),
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: (response.usage as any).cache_read_input_tokens || 0,
      cacheWrite: (response.usage as any).cache_creation_input_tokens || 0,
    },
  };
}

// ── Rule matching against extraction output ──
// Case-insensitive substring match: if extraction.documentType contains "subpoena", it matches.

export function matchRule(
  extraction: Extraction,
  rules: WorkflowRule[],
  fileInfo?: { name: string; mimeType: string },
): WorkflowRule | null {
  for (const rule of rules) {
    // Skip catch-all rules (empty match) — they're used as fallback
    if (!rule.match || Object.keys(rule.match).length === 0) continue;

    let matches = true;
    for (const [key, pattern] of Object.entries(rule.match)) {
      const target = pattern.toLowerCase();

      // Special keys match against file properties, not extraction
      if (key === "fileExtension") {
        const name = (fileInfo?.name ?? "").toLowerCase();
        // Support comma-separated extensions: ".tif,.tiff"
        const exts = target.split(",").map((e) => e.trim());
        if (!exts.some((ext) => name.endsWith(ext))) {
          matches = false;
          break;
        }
        continue;
      }
      if (key === "mimeType") {
        const mime = (fileInfo?.mimeType ?? "").toLowerCase();
        if (!mime.includes(target)) {
          matches = false;
          break;
        }
        continue;
      }

      const extracted = String(extraction[key] ?? "").toLowerCase();
      // Support comma-separated OR: "agreement,contract,mou" matches any
      const targets = target.split(",").map((t) => t.trim()).filter(Boolean);
      if (!targets.some((t) => extracted.includes(t))) {
        matches = false;
        break;
      }
    }
    if (matches) return rule;
  }

  // Fall back to first catch-all rule (empty match)
  for (const rule of rules) {
    if (!rule.match || Object.keys(rule.match).length === 0) return rule;
  }

  return null;
}

// ── Collect all extractFields from all rules (so 1 LLM call extracts everything) ──

export function collectAllExtractFields(rules: WorkflowRule[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const rule of rules) {
    if (!rule.extractFields) continue;
    if (Array.isArray(rule.extractFields)) {
      // Simple array: use generic hint
      for (const f of rule.extractFields) {
        if (!fields[f]) fields[f] = "extract if present, or null";
      }
    } else {
      // Object with custom hints: merge (first hint wins)
      for (const [f, hint] of Object.entries(rule.extractFields)) {
        if (!fields[f]) fields[f] = hint;
      }
    }
  }
  return fields;
}

// ── Execute actions programmatically ──

export async function executeActions(
  client: OTCSClient,
  actions: Action[],
  extraction: Extraction,
  nodeId: number,
  nodeName: string,
): Promise<{ steps: WorkflowResult["steps"]; documentIds: number[] }> {
  const steps: WorkflowResult["steps"] = [];
  let documentIds: number[] = [];
  let holdId: number | null = null;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const stepNum = i + 1;

    switch (action.type) {
      // ── Search for related documents ──
      case "search": {
        const query = resolve(action.query as string, extraction);
        const filterType = (action.filter as string) || "documents";
        const exclude = (action.exclude as string[]) || [];
        const filterFieldName = action.filterField as string | undefined;
        log(`  [${stepNum}/${actions.length}] Searching: "${query}"...`);

        const result = await client.search({
          query,
          lookfor: "anywords",
          filter_type: filterType as any,
          limit: 100,
        });

        // Phase 1: Filter out unwanted results by exclude patterns
        const candidates: { id: number; name: string; description: string }[] = [];
        for (const item of result.results) {
          const name = (item.name || "").toLowerCase();
          if (item.id === nodeId) continue; // skip the trigger document
          let excluded = false;
          for (const pattern of exclude) {
            if (name.includes(pattern.toLowerCase())) { excluded = true; break; }
          }
          if (!excluded) {
            candidates.push({
              id: item.id,
              name: item.name || "",
              description: (item as any).description || "",
            });
          }
        }

        // Phase 2: Filter by responsive keywords (if filterField is set)
        if (filterFieldName && extraction[filterFieldName]) {
          const filterKeywords = parseStringArray(extraction[filterFieldName]);
          if (filterKeywords.length > 0 && candidates.length > 0) {
            log(`  Filtering ${candidates.length} documents against ${filterKeywords.length} keywords...`);
            documentIds = [];
            const rejected: string[] = [];

            for (const doc of candidates) {
              const text = normalizeText(`${doc.name} ${doc.description}`);
              const matched = filterKeywords.some((kw) => keywordMatchesText(kw, text));
              if (matched) {
                documentIds.push(doc.id);
              } else {
                rejected.push(doc.name);
              }
            }

            if (rejected.length > 0) {
              log(`    Excluded ${rejected.length} non-responsive: ${rejected.join(", ")}`);
            }
            log(`    → ${documentIds.length} responsive document(s)`);
          } else {
            documentIds = candidates.map((d) => d.id);
          }
        } else {
          documentIds = candidates.map((d) => d.id);
        }

        steps.push({
          name: "search",
          args: { query, filter: filterType },
          result: `${result.total_count} found, ${documentIds.length} after filtering`,
        });
        log(`  → ${documentIds.length} document(s) after filtering`);
        break;
      }

      // ── Smart search: precise LQL query + LLM-driven keyword filtering ──
      // Phase 1: Run LQL queries (e.g. OTName:EMP12345*) to scope to the right documents
      // Phase 2: Filter results against LLM-extracted keywords for responsive doc types only
      case "smart_search": {
        const queriesField = action.queriesField as string || "searchQueries";
        const filterField = action.filterField as string || "filterKeywords";
        const rawQueries = extraction[queriesField];
        const rawFilters = extraction[filterField];

        // Parse queries — special handling to preserve original case for search
        let queries: string[];
        if (Array.isArray(rawQueries)) {
          queries = rawQueries;
        } else if (typeof rawQueries === "string") {
          const trimmed = rawQueries.trim();
          if (trimmed.startsWith("[")) {
            try {
              const parsed = JSON.parse(trimmed);
              queries = Array.isArray(parsed) ? parsed.map(String) : [rawQueries];
            } catch {
              queries = [rawQueries];
            }
          } else {
            queries = [rawQueries];
          }
        } else {
          queries = [];
        }

        const filterKeywords = parseStringArray(rawFilters);

        if (queries.length === 0) {
          log(`  [${stepNum}/${actions.length}] No search queries generated by LLM`);
          steps.push({ name: "smart_search", args: {}, result: "No queries" });
          break;
        }

        const filterType = (action.filter as string) || "documents";
        const exclude = (action.exclude as string[]) || [];
        const seen = new Set<number>();
        const allResults: { id: number; name: string; description: string }[] = [];

        // Phase 1: Run search queries
        // Detect LQL vs natural language: LQL contains operators like AND, OR, :, *
        const isLQL = (q: string) => /\b(AND|OR|NOT)\b|[*:]/.test(q);
        log(`  [${stepNum}/${actions.length}] Phase 1: Running ${queries.length} search query(s)...`);

        for (const query of queries) {
          const lookfor = isLQL(query) ? "complexquery" : "allwords";
          log(`    → "${query}" (${lookfor})...`);
          try {
            const result = await client.search({
              query,
              lookfor,
              filter_type: filterType as any,
              limit: 100,
            });

            for (const item of result.results) {
              if (item.id === nodeId) continue;
              if (seen.has(item.id)) continue;
              const name = (item.name || "").toLowerCase();
              let excluded = false;
              for (const pattern of exclude) {
                if (name.includes(pattern.toLowerCase())) { excluded = true; break; }
              }
              if (!excluded) {
                seen.add(item.id);
                allResults.push({
                  id: item.id,
                  name: item.name || "",
                  description: (item as any).description || "",
                });
              }
            }
            log(`      ${result.total_count} results, ${allResults.length} unique after exclusions`);
          } catch (err: any) {
            log(`      Error: ${err.message}`);
          }
        }

        // Phase 2: Filter by responsive keywords (if provided)
        if (filterKeywords.length > 0 && allResults.length > 0) {
          log(`  Phase 2: Filtering ${allResults.length} documents against ${filterKeywords.length} keywords...`);
          documentIds = [];
          const rejected: string[] = [];

          for (const doc of allResults) {
            const text = normalizeText(`${doc.name} ${doc.description}`);
            const matched = filterKeywords.some((kw) => keywordMatchesText(kw, text));
            if (matched) {
              documentIds.push(doc.id);
            } else {
              rejected.push(doc.name);
            }
          }

          if (rejected.length > 0) {
            log(`    Excluded ${rejected.length} non-responsive: ${rejected.join(", ")}`);
          }
          log(`    → ${documentIds.length} responsive document(s)`);
        } else {
          // No filter keywords — keep all results
          documentIds = allResults.map((d) => d.id);
        }

        steps.push({
          name: "smart_search",
          args: { queries: queries.length, filterKeywords: filterKeywords.length, total: allResults.length },
          result: `${allResults.length} employee docs → ${documentIds.length} responsive`,
        });
        log(`  → ${documentIds.length} responsive document(s) from ${allResults.length} total`);
        break;
      }

      // ── Ensure a legal hold exists (find or create) ──
      case "ensure_hold": {
        const holdName = resolve(action.name as string, extraction);
        const holdType = (action.holdType as string) || "Legal";
        const comment = action.comment ? resolve(action.comment as string, extraction) : "";
        log(`  [${stepNum}/${actions.length}] Ensuring hold: "${holdName}"...`);

        const holdsResult = await client.listRMHolds();
        const nameUpper = holdName.toUpperCase();

        for (const h of holdsResult.holds) {
          if ((h.name || "").toUpperCase().includes(nameUpper)) {
            holdId = h.id;
            break;
          }
        }

        if (holdId) {
          steps.push({ name: "ensure_hold", args: { name: holdName }, result: `Existing hold ID: ${holdId}` });
          log(`  → Found existing hold (ID: ${holdId})`);
        } else {
          const newHold = await client.createRMHold({ name: holdName, type: holdType as any, comment });
          holdId = newHold.id;
          steps.push({ name: "ensure_hold", args: { name: holdName }, result: `Created hold ID: ${holdId}` });
          log(`  → Created hold (ID: ${holdId})`);
        }
        break;
      }

      // ── Apply hold to collected documents ──
      case "apply_hold": {
        if (!holdId) { log(`  [${stepNum}] Skipping apply_hold — no hold ID`); break; }
        if (documentIds.length === 0) { log(`  [${stepNum}] Skipping apply_hold — no documents`); break; }
        log(`  [${stepNum}/${actions.length}] Applying hold to ${documentIds.length} document(s)...`);

        try {
          const result = await client.applyRMHoldBatch(documentIds, holdId);
          steps.push({
            name: "apply_hold",
            args: { hold_id: holdId, count: documentIds.length },
            result: `Applied: ${result.count}, Already held: ${result.failed.length}`,
          });
          log(`  → ${result.count} applied, ${result.failed.length} already held`);
        } catch (err: any) {
          steps.push({ name: "apply_hold", args: { hold_id: holdId }, result: `Error: ${err.message}` });
          log(`  → Error: ${err.message}`);
        }
        break;
      }

      // ── Copy collected documents to a folder ──
      case "copy": {
        const destId = typeof action.destination === "string"
          ? parseInt(resolve(action.destination as string, extraction), 10)
          : action.destination as number;
        const ids = documentIds.length > 0 ? documentIds : [nodeId];
        log(`  [${stepNum}/${actions.length}] Copying ${ids.length} document(s) to folder ${destId}...`);

        let copied = 0;
        let failed = 0;
        for (const id of ids) {
          try {
            await handleToolCall(client, "otcs_node_action", {
              action: "copy",
              node_id: id,
              destination_id: destId,
            });
            copied++;
          } catch (err: any) {
            failed++;
            log(`    Failed to copy ${id}: ${err.message}`);
          }
        }
        steps.push({
          name: "copy",
          args: { destination: destId, count: ids.length },
          result: `Copied: ${copied}, Failed: ${failed}`,
        });
        log(`  → ${copied} copied, ${failed} failed`);
        break;
      }

      // ── Share documents with an email ──
      case "share": {
        const email = resolve((action.email as string) || "", extraction);
        const perm = ((action.perm as number) || 1) as 1 | 2 | 3 | 4;
        const ids = documentIds.length > 0 ? documentIds : [nodeId];
        const message = action.message ? resolve(action.message as string, extraction) : undefined;
        log(`  [${stepNum}/${actions.length}] Sharing ${ids.length} document(s) with ${email}...`);

        try {
          const result = await client.createShare({
            node_ids: ids,
            invitees: [{ business_email: email, perm }],
            sharing_message: message,
          });
          steps.push({
            name: "share",
            args: { email, count: ids.length },
            result: result.success ? "Shared" : "Partial",
          });
          log(`  → ${result.success ? "Success" : "Partial"}`);
        } catch (err: any) {
          steps.push({ name: "share", args: { email }, result: `Error: ${err.message}` });
          log(`  → Error: ${err.message}`);
        }
        break;
      }

      // ── Move the trigger document to a folder ──
      case "move": {
        const destId = typeof action.destination === "string"
          ? parseInt(resolve(action.destination, extraction), 10)
          : action.destination as number;
        log(`  [${stepNum}/${actions.length}] Moving document to folder ${destId}...`);

        try {
          await handleToolCall(client, "otcs_node_action", {
            action: "move",
            node_id: nodeId,
            destination_id: destId,
          });
          steps.push({ name: "move", args: { destination: destId }, result: "Moved" });
          log(`  → Moved to ${destId}`);
        } catch (err: any) {
          steps.push({ name: "move", args: { destination: destId }, result: `Error: ${err.message}` });
          log(`  → Error: ${err.message}`);
        }
        break;
      }

      // ── Apply a category to the trigger document ──
      case "categorize": {
        const categoryName = resolve(action.category as string, extraction);
        let categoryId = action.category_id as number | undefined;
        const attributes = action.attributes
          ? resolveAny(action.attributes, extraction) as Record<string, unknown>
          : undefined;
        const fallbackToDesc = action.fallbackToDescription === true;
        log(`  [${stepNum}/${actions.length}] Categorizing as "${categoryName}"...`);

        // If no numeric category_id, try to find the category by name via search
        if (!categoryId && categoryName) {
          try {
            const searchResult = await client.search({
              query: `OTName:"${categoryName}" AND OTSubType:131`,
              lookfor: "complexquery",
              limit: 5,
            });
            const match = searchResult.results.find(
              (r) => r.name.toLowerCase() === categoryName.toLowerCase(),
            );
            if (match) {
              categoryId = match.id;
              log(`  → Resolved "${categoryName}" to category ID ${categoryId}`);
            }
          } catch {
            // Search failed — will fall through to fallback
          }
        }

        if (categoryId) {
          try {
            await client.addCategory(nodeId, categoryId, attributes);
            steps.push({ name: "categorize", args: { category: categoryName, id: categoryId }, result: "Applied" });
            log(`  → Applied category "${categoryName}" (ID: ${categoryId})`);
            break;
          } catch (err: any) {
            log(`  → Failed to apply category: ${err.message}`);
            if (!fallbackToDesc) {
              steps.push({ name: "categorize", args: { category: categoryName }, result: `Error: ${err.message}` });
              break;
            }
            // Fall through to description fallback
          }
        }

        // Fallback: write attributes to node description
        if (fallbackToDesc && attributes) {
          log(`  → Category not found, falling back to description...`);
          const lines: string[] = [`[${categoryName}]`];
          for (const [key, value] of Object.entries(attributes)) {
            if (value !== null && value !== undefined && value !== "") {
              lines.push(`${key}: ${value}`);
            }
          }
          const description = lines.join("\n");
          try {
            await handleToolCall(client, "otcs_node_action", {
              action: "update_description",
              node_id: nodeId,
              description,
            });
            steps.push({ name: "categorize", args: { category: categoryName }, result: `Fallback: wrote ${Object.keys(attributes).length} attrs to description` });
            log(`  → Wrote ${Object.keys(attributes).length} attribute(s) to description as fallback`);
          } catch (err: any) {
            steps.push({ name: "categorize", args: { category: categoryName }, result: `Fallback error: ${err.message}` });
            log(`  → Fallback error: ${err.message}`);
          }
        } else if (!categoryId) {
          steps.push({ name: "categorize", args: { category: categoryName }, result: "Category not found, no fallback" });
          log(`  → Category "${categoryName}" not found and no fallback configured`);
        }
        break;
      }

      // ── Update node description with formatted extraction data ──
      case "update_description": {
        const template = action.template as string | undefined;
        const fields = (action.fields as string[]) || Object.keys(extraction).filter(k => k !== "documentType" && k !== "summary");
        const separator = (action.separator as string) || "\n";

        let description: string;
        if (template) {
          description = resolve(template, extraction);
        } else {
          // Auto-format: build key: value pairs from extraction fields
          const lines: string[] = [];
          for (const field of fields) {
            const value = extraction[field];
            if (value === null || value === undefined) continue;
            // Pretty-print field name: camelCase → Title Case
            const label = field.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
            const formatted = Array.isArray(value) ? value.join("; ") : String(value);
            lines.push(`${label}: ${formatted}`);
          }
          description = lines.join(separator);
        }

        log(`  [${stepNum}/${actions.length}] Updating description (${description.length} chars)...`);

        try {
          await handleToolCall(client, "otcs_node_action", {
            action: "update_description",
            node_id: nodeId,
            description,
          });
          steps.push({
            name: "update_description",
            args: { fields: fields.length, chars: description.length },
            result: "Updated",
          });
          log(`  → Description updated (${fields.length} fields)`);
        } catch (err: any) {
          steps.push({ name: "update_description", args: {}, result: `Error: ${err.message}` });
          log(`  → Error: ${err.message}`);
        }
        break;
      }

      // ── Create a folder (idempotent — finds existing or creates new) ──
      case "create_folder": {
        const folderName = resolve(action.name as string, extraction);
        const parentId = typeof action.parent === "string"
          ? parseInt(resolve(action.parent as string, extraction), 10)
          : action.parent as number;
        log(`  [${stepNum}/${actions.length}] Creating folder "${folderName}" in parent ${parentId}...`);

        try {
          const existing = await client.findChildByName(parentId, folderName);
          if (existing) {
            extraction.createdFolderId = existing.id;
            steps.push({ name: "create_folder", args: { name: folderName, parent: parentId }, result: `Exists: ID ${existing.id}` });
            log(`  → Folder already exists (ID: ${existing.id})`);
          } else {
            const created = await client.createFolder(parentId, folderName);
            extraction.createdFolderId = created.id;
            steps.push({ name: "create_folder", args: { name: folderName, parent: parentId }, result: `Created: ID ${created.id}` });
            log(`  → Created folder (ID: ${created.id})`);
          }
        } catch (err: any) {
          steps.push({ name: "create_folder", args: { name: folderName, parent: parentId }, result: `Error: ${err.message}` });
          log(`  → Error: ${err.message}`);
        }
        break;
      }

      // ── Start an OTCS workflow with the trigger document attached ──
      case "start_workflow": {
        const wfId = typeof action.workflow_id === "string"
          ? parseInt(resolve(action.workflow_id as string, extraction), 10)
          : action.workflow_id as number;
        const mode = (action.mode as string) || "direct";
        const comment = action.comment
          ? resolve(action.comment as string, extraction)
          : undefined;

        log(`  [${stepNum}/${actions.length}] Starting workflow ${wfId} (mode: ${mode})...`);

        try {
          const result = await handleToolCall(client, "otcs_start_workflow", {
            workflow_id: wfId,
            doc_ids: String(nodeId),
            mode,
            ...(comment ? { comment } : {}),
          }) as { work_id?: number; draftprocess_id?: number; message?: string };

          const instanceId = result.work_id ?? result.draftprocess_id;
          // Store for downstream actions
          extraction.workflowWorkId = instanceId ?? null;
          if (result.draftprocess_id) {
            extraction.workflowDraftId = result.draftprocess_id;
          }

          log(`  → Workflow started (instance: ${instanceId})`);
          steps.push({
            name: "start_workflow",
            args: { workflow_id: wfId, mode, doc_id: nodeId },
            result: result.message ?? `Started: ${instanceId}`,
          });
        } catch (err: any) {
          log(`  → Error: ${err.message}`);
          steps.push({
            name: "start_workflow",
            args: { workflow_id: wfId, mode },
            result: `Error: ${err.message}`,
          });
        }
        break;
      }

      // ── Get pending tasks for a workflow instance ──
      case "get_workflow_tasks": {
        const processId = typeof action.process_id === "string"
          ? parseInt(resolve(action.process_id as string, extraction), 10)
          : (action.process_id as number) ?? (extraction.workflowWorkId as number);

        log(`  [${stepNum}/${actions.length}] Getting workflow tasks for process ${processId}...`);

        try {
          const result = await handleToolCall(client, "otcs_workflow_tasks", {
            process_id: processId,
          }) as { tasks?: { current?: any[]; completed?: any[]; next?: any[] }; summary?: any };

          const currentTasks = result.tasks?.current || [];
          if (currentTasks.length > 0) {
            const task = currentTasks[0];
            extraction.workflowProcessId = task.process_id ?? processId;
            extraction.workflowSubprocessId = task.subprocess_id ?? 1;
            extraction.workflowTaskId = task.task_id ?? task.id;
            log(`  → Found ${currentTasks.length} current task(s), using task ${extraction.workflowTaskId}`);
          } else {
            log(`  → No current tasks found`);
          }

          steps.push({
            name: "get_workflow_tasks",
            args: { process_id: processId },
            result: `Current: ${currentTasks.length}, Completed: ${result.tasks?.completed?.length ?? 0}`,
          });
        } catch (err: any) {
          log(`  → Error: ${err.message}`);
          steps.push({
            name: "get_workflow_tasks",
            args: { process_id: processId },
            result: `Error: ${err.message}`,
          });
        }
        break;
      }

      // ── Get workflow task form schema ──
      case "get_workflow_form": {
        const pId = typeof action.process_id === "string"
          ? parseInt(resolve(action.process_id as string, extraction), 10)
          : (action.process_id as number) ?? (extraction.workflowProcessId as number);
        const spId = typeof action.subprocess_id === "string"
          ? parseInt(resolve(action.subprocess_id as string, extraction), 10)
          : (action.subprocess_id as number) ?? (extraction.workflowSubprocessId as number) ?? 1;
        const tId = typeof action.task_id === "string"
          ? parseInt(resolve(action.task_id as string, extraction), 10)
          : (action.task_id as number) ?? (extraction.workflowTaskId as number);

        log(`  [${stepNum}/${actions.length}] Getting form for task ${tId}...`);

        try {
          const result = await handleToolCall(client, "otcs_workflow_form", {
            process_id: pId,
            subprocess_id: spId,
            task_id: tId,
            detailed: true,
          }) as { title?: string; fields?: Record<string, any>; actions?: any[] };

          // Store available actions for complete_task
          extraction.workflowFormTitle = result.title ?? null;

          log(`  → Form: "${result.title}", ${Object.keys(result.fields ?? {}).length} field(s)`);
          steps.push({
            name: "get_workflow_form",
            args: { process_id: pId, subprocess_id: spId, task_id: tId },
            result: `Title: ${result.title}, Fields: ${Object.keys(result.fields ?? {}).length}`,
          });
        } catch (err: any) {
          log(`  → Error: ${err.message}`);
          steps.push({
            name: "get_workflow_form",
            args: { process_id: pId, subprocess_id: spId, task_id: tId },
            result: `Error: ${err.message}`,
          });
        }
        break;
      }

      // ── Complete (send) a workflow task with form data ──
      case "complete_task": {
        const pId = typeof action.process_id === "string"
          ? parseInt(resolve(action.process_id as string, extraction), 10)
          : (action.process_id as number) ?? (extraction.workflowProcessId as number);
        const spId = typeof action.subprocess_id === "string"
          ? parseInt(resolve(action.subprocess_id as string, extraction), 10)
          : (action.subprocess_id as number) ?? (extraction.workflowSubprocessId as number) ?? 1;
        const tId = typeof action.task_id === "string"
          ? parseInt(resolve(action.task_id as string, extraction), 10)
          : (action.task_id as number) ?? (extraction.workflowTaskId as number);
        const disposition = action.disposition
          ? resolve(action.disposition as string, extraction)
          : undefined;
        const customAction = action.custom_action
          ? resolve(action.custom_action as string, extraction)
          : undefined;
        const taskComment = action.comment
          ? resolve(action.comment as string, extraction)
          : undefined;

        // Build form_data: resolve {{field}} templates in each value
        // Skip empty/null resolved values — OTCS rejects blanks for typed fields (e.g. integer)
        const formData: Record<string, string> = {};
        if (action.form_data && typeof action.form_data === "object") {
          for (const [key, val] of Object.entries(action.form_data as Record<string, string>)) {
            const resolved = resolve(String(val), extraction);
            if (resolved && resolved !== "null" && resolved !== "undefined") {
              formData[key] = resolved;
            }
          }
        }

        const actionLabel = customAction || disposition || "SendOn";
        log(`  [${stepNum}/${actions.length}] Completing task ${tId} (action: ${actionLabel})...`);
        if (Object.keys(formData).length > 0) {
          log(`  → form_data: ${JSON.stringify(formData)}`);
        }

        try {
          const result = await handleToolCall(client, "otcs_workflow_task", {
            process_id: pId,
            subprocess_id: spId,
            task_id: tId,
            action: "send",
            ...(disposition ? { disposition } : {}),
            ...(customAction ? { custom_action: customAction } : {}),
            ...(taskComment ? { comment: taskComment } : {}),
            ...(Object.keys(formData).length > 0 ? { form_data: formData } : {}),
          }) as { success?: boolean; message?: string };

          log(`  → Task completed: ${result.message}`);
          steps.push({
            name: "complete_task",
            args: { process_id: pId, task_id: tId, disposition, form_fields: Object.keys(formData).length },
            result: result.message ?? "Completed",
          });
        } catch (err: any) {
          log(`  → Error: ${err.message}`);
          steps.push({
            name: "complete_task",
            args: { process_id: pId, task_id: tId, disposition },
            result: `Error: ${err.message}`,
          });
        }
        break;
      }

      // ── Query workflow status ──
      case "workflow_status": {
        const mode = (action.mode as string) || "active";
        const mapId = typeof action.map_id === "string"
          ? parseInt(resolve(action.map_id as string, extraction), 10)
          : action.map_id as number | undefined;

        log(`  [${stepNum}/${actions.length}] Querying workflow status (mode: ${mode})...`);

        try {
          const result = await handleToolCall(client, "otcs_workflow_status", {
            mode,
            ...(mapId ? { map_id: mapId } : {}),
            ...(action.status ? { status: action.status } : {}),
          }) as { workflows?: any[]; count?: number };

          log(`  → Found ${result.count ?? 0} workflow(s)`);
          steps.push({
            name: "workflow_status",
            args: { mode, map_id: mapId },
            result: `Found: ${result.count ?? 0}`,
          });
        } catch (err: any) {
          log(`  → Error: ${err.message}`);
          steps.push({
            name: "workflow_status",
            args: { mode },
            result: `Error: ${err.message}`,
          });
        }
        break;
      }

      // ── Manage workflow lifecycle (suspend, resume, stop, archive, delete) ──
      case "manage_workflow": {
        const mAction = resolve(action.action as string, extraction);
        const processId = typeof action.process_id === "string"
          ? parseInt(resolve(action.process_id as string, extraction), 10)
          : (action.process_id as number) ?? (extraction.workflowWorkId as number);

        log(`  [${stepNum}/${actions.length}] Managing workflow ${processId}: ${mAction}...`);

        try {
          const result = await handleToolCall(client, "otcs_manage_workflow", {
            action: mAction,
            process_id: processId,
          }) as { success?: boolean; message?: string };

          log(`  → ${result.message}`);
          steps.push({
            name: "manage_workflow",
            args: { action: mAction, process_id: processId },
            result: result.message ?? `${mAction} done`,
          });
        } catch (err: any) {
          log(`  → Error: ${err.message}`);
          steps.push({
            name: "manage_workflow",
            args: { action: mAction, process_id: processId },
            result: `Error: ${err.message}`,
          });
        }
        break;
      }

      default:
        log(`  [${stepNum}] Unknown action type: ${action.type}`);
    }
  }

  return { steps, documentIds };
}
