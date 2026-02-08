/**
 * OTCS Tool Handler — single source of truth.
 *
 * Executes tool calls against the OTCS REST API via the provided client.
 * Protocol-agnostic: used by MCP server, web UI, agent, and migration.
 *
 * Re-exports from split domain handlers for backward compatibility.
 */

export { handleToolCall } from './handlers/index';
