/**
 * Format adapters for tool definitions.
 *
 * Tool schemas are stored once in definitions.ts as protocol-neutral objects.
 * This module converts them to the format each consumer needs:
 * - MCP SDK uses `inputSchema` (camelCase)
 * - Anthropic SDK uses `input_schema` (snake_case)
 */

import { TOOL_SCHEMAS, type ToolSchema } from './definitions';

// ── MCP format ──

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export function toMCPTools(schemas?: ToolSchema[]): MCPTool[] {
  return (schemas ?? TOOL_SCHEMAS).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: 'object' as const,
      properties: t.schema.properties,
      ...(t.schema.required ? { required: t.schema.required } : {}),
    },
  }));
}

// ── Anthropic format ──

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  cache_control?: { type: 'ephemeral' };
}

export function toAnthropicTools(schemas?: ToolSchema[]): AnthropicTool[] {
  const items = schemas ?? TOOL_SCHEMAS;
  return items.map((t, i) => {
    const tool: AnthropicTool = {
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        properties: t.schema.properties,
        ...(t.schema.required ? { required: t.schema.required } : {}),
      },
    };
    // Mark the last tool for Anthropic prompt caching
    if (i === items.length - 1) {
      tool.cache_control = { type: 'ephemeral' } as const;
    }
    return tool;
  });
}
