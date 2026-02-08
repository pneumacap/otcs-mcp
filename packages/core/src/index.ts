/**
 * @otcs/core — shared foundation for all OTCS consumers.
 *
 * Exports:
 *   - OTCSClient: REST API wrapper
 *   - Types: all TypeScript interfaces and constants
 *   - Tools: definitions, handler, formats, utilities
 *   - LLM: cost computation
 */

// Client
export { OTCSClient } from './client/otcs-client';

// Types (re-export everything)
export * from './types';

// Tools
export {
  TOOL_SCHEMAS,
  type ToolSchema,
  handleToolCall,
  extractText,
  getMimeType,
  getSuggestion,
  compactToolResult,
  pickKeys,
  toMCPTools,
  toAnthropicTools,
  type MCPTool,
  type AnthropicTool,
} from './tools/index';

// LLM utilities
export { computeCost } from './llm/cost';
