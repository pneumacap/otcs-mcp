/**
 * Generic workflow engine — 1 LLM call for classification/extraction,
 * then config-driven programmatic actions via direct API calls.
 *
 * Flow: download → classify (1 LLM call) → match rule → execute actions (free)
 *
 * The LLM only reads the document. Everything else is free.
 */

import Anthropic from "@anthropic-ai/sdk";
import { OTCSClient } from "../src/client/otcs-client.js";
import { handleToolCall } from "./bridge.js";
import { log } from "./logger.js";

// ── Types ──

/** Extracted fields from the LLM — any key/value pairs (including arrays for search queries) */
export type Extraction = Record<string, string | number | string[] | null>;

/** A single programmatic action to execute */
export interface Action {
  type: "search" | "smart_search" | "ensure_hold" | "apply_hold" | "share" | "move" | "categorize";
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
): Promise<{ extraction: Extraction; usage: { input: number; output: number } }> {
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
    },
  };
}

// ── Rule matching against extraction output ──
// Case-insensitive substring match: if extraction.documentType contains "subpoena", it matches.

export function matchRule(
  extraction: Extraction,
  rules: WorkflowRule[],
): WorkflowRule | null {
  for (const rule of rules) {
    // Skip catch-all rules (empty match) — they're used as fallback
    if (!rule.match || Object.keys(rule.match).length === 0) continue;

    let matches = true;
    for (const [key, pattern] of Object.entries(rule.match)) {
      const extracted = String(extraction[key] ?? "").toLowerCase();
      const target = pattern.toLowerCase();
      if (!extracted.includes(target)) {
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
        log(`  [${stepNum}/${actions.length}] Searching: "${query}"...`);

        const result = await client.search({
          query,
          lookfor: "anywords",
          filter_type: filterType as any,
          limit: 100,
        });

        // Filter out unwanted results
        documentIds = [];
        for (const item of result.results) {
          const name = (item.name || "").toLowerCase();
          if (item.id === nodeId) continue; // skip the trigger document
          let excluded = false;
          for (const pattern of exclude) {
            if (name.includes(pattern.toLowerCase())) { excluded = true; break; }
          }
          if (!excluded) documentIds.push(item.id);
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

        const queries: string[] = Array.isArray(rawQueries)
          ? rawQueries
          : typeof rawQueries === "string"
            ? [rawQueries]
            : [];

        const filterKeywords: string[] = Array.isArray(rawFilters)
          ? rawFilters.map((k) => String(k).toLowerCase())
          : typeof rawFilters === "string"
            ? rawFilters.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
            : [];

        if (queries.length === 0) {
          log(`  [${stepNum}/${actions.length}] No search queries generated by LLM`);
          steps.push({ name: "smart_search", args: {}, result: "No queries" });
          break;
        }

        const filterType = (action.filter as string) || "documents";
        const exclude = (action.exclude as string[]) || [];
        const seen = new Set<number>();
        const allResults: { id: number; name: string; description: string }[] = [];

        // Phase 1: Run precise LQL queries
        log(`  [${stepNum}/${actions.length}] Phase 1: Running ${queries.length} LQL query(s)...`);

        for (const query of queries) {
          log(`    → "${query}"...`);
          try {
            const result = await client.search({
              query,
              lookfor: "complexquery",
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
            const text = `${doc.name} ${doc.description}`.toLowerCase();
            const matched = filterKeywords.some((kw) => text.includes(kw));
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
        const category = resolve(action.category as string, extraction);
        const attributes = action.attributes
          ? resolveAny(action.attributes, extraction) as Record<string, unknown>
          : undefined;
        log(`  [${stepNum}/${actions.length}] Categorizing as "${category}"...`);

        try {
          await handleToolCall(client, "otcs_categories", {
            action: "add",
            node_id: nodeId,
            category_name: category,
            attributes,
          });
          steps.push({ name: "categorize", args: { category }, result: "Applied" });
          log(`  → Applied category "${category}"`);
        } catch (err: any) {
          steps.push({ name: "categorize", args: { category }, result: `Error: ${err.message}` });
          log(`  → Error: ${err.message}`);
        }
        break;
      }

      default:
        log(`  [${stepNum}] Unknown action type: ${action.type}`);
    }
  }

  return { steps, documentIds };
}
