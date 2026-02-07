#!/usr/bin/env node

/**
 * OTCS MCP Server — thin protocol adapter.
 *
 * All business logic (tool schemas, handler, utilities) lives in @otcs/core.
 * This file wires them into the MCP protocol (stdio transport).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ── Core imports ──
import { OTCSClient } from "../packages/core/src/client/otcs-client.js";
import { toMCPTools } from "../packages/core/src/tools/formats.js";
import { handleToolCall } from "../packages/core/src/tools/handler.js";
import { getSuggestion } from "../packages/core/src/tools/utils.js";

// ── OTCS client singleton ──

const config = {
  baseUrl:
    process.env.OTCS_BASE_URL ||
    "https://vm-geliopou.eimdemo.com/otcs/cs.exe/api",
  username: process.env.OTCS_USERNAME,
  password: process.env.OTCS_PASSWORD,
  domain: process.env.OTCS_DOMAIN,
};

const client = new OTCSClient(config);

// ── Auth tool definitions (MCP-only, not in core) ──

const AUTH_TOOLS: Tool[] = [
  {
    name: "otcs_authenticate",
    description:
      "Authenticate with OpenText Content Server. Uses environment credentials (OTCS_USERNAME, OTCS_PASSWORD) if not provided.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Login username (optional if env var set)",
        },
        password: {
          type: "string",
          description: "Login password (optional if env var set)",
        },
        domain: { type: "string", description: "Optional login domain" },
      },
    },
  },
  {
    name: "otcs_session_status",
    description: "Check if the current session is valid and authenticated.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "otcs_logout",
    description: "End the current authenticated session.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Tool profile system ──

const TOOL_PROFILES: Record<string, string[]> = {
  core: [
    "otcs_authenticate", "otcs_session_status",
    "otcs_get_node", "otcs_browse", "otcs_search",
    "otcs_create_folder", "otcs_node_action", "otcs_delete_nodes",
    "otcs_upload", "otcs_upload_folder", "otcs_upload_batch", "otcs_upload_with_metadata", "otcs_download_content",
    "otcs_versions",
    "otcs_search_workspaces", "otcs_get_workspace",
    "otcs_get_assignments", "otcs_workflow_form", "otcs_workflow_task",
    "otcs_members", "otcs_permissions", "otcs_categories",
    "otcs_share",
  ],
  workflow: [
    "otcs_authenticate", "otcs_session_status",
    "otcs_get_node", "otcs_browse", "otcs_search",
    "otcs_create_folder", "otcs_node_action", "otcs_delete_nodes",
    "otcs_upload", "otcs_upload_folder", "otcs_upload_batch", "otcs_upload_with_metadata", "otcs_download_content",
    "otcs_versions",
    "otcs_search_workspaces", "otcs_get_workspace", "otcs_workspace_types",
    "otcs_get_assignments", "otcs_workflow_status", "otcs_workflow_definition",
    "otcs_workflow_tasks", "otcs_workflow_activities", "otcs_workflow_form",
    "otcs_workflow_task", "otcs_start_workflow", "otcs_draft_workflow",
    "otcs_workflow_info", "otcs_manage_workflow",
    "otcs_members", "otcs_permissions", "otcs_categories",
  ],
  admin: [
    "otcs_authenticate", "otcs_session_status", "otcs_logout",
    "otcs_get_node", "otcs_browse", "otcs_search",
    "otcs_create_folder", "otcs_node_action", "otcs_delete_nodes",
    "otcs_upload", "otcs_upload_folder", "otcs_upload_batch", "otcs_upload_with_metadata", "otcs_download_content",
    "otcs_versions",
    "otcs_search_workspaces", "otcs_get_workspace", "otcs_create_workspace", "otcs_create_workspaces",
    "otcs_workspace_types", "otcs_workspace_relations", "otcs_workspace_roles",
    "otcs_get_assignments", "otcs_workflow_form", "otcs_workflow_task",
    "otcs_members", "otcs_group_membership",
    "otcs_permissions", "otcs_categories", "otcs_workspace_metadata",
    "otcs_rm_classification", "otcs_rm_holds", "otcs_rm_xref", "otcs_rm_rsi",
    "otcs_share",
  ],
  rm: [
    "otcs_authenticate", "otcs_session_status",
    "otcs_get_node", "otcs_browse", "otcs_search",
    "otcs_create_folder", "otcs_node_action", "otcs_delete_nodes",
    "otcs_upload", "otcs_upload_folder", "otcs_upload_batch", "otcs_upload_with_metadata", "otcs_download_content",
    "otcs_versions",
    "otcs_search_workspaces", "otcs_get_workspace",
    "otcs_members", "otcs_permissions", "otcs_categories",
    "otcs_rm_classification", "otcs_rm_holds", "otcs_rm_xref", "otcs_rm_rsi",
  ],
};

function getEnabledTools(allTools: Tool[]): Tool[] {
  const profile = process.env.OTCS_TOOL_PROFILE || "full";

  if (profile === "full") return allTools;

  const enabledNames = TOOL_PROFILES[profile];
  if (!enabledNames) {
    console.error(`Unknown profile "${profile}", using full`);
    return allTools;
  }

  return allTools.filter((t) => enabledNames.includes(t.name));
}

// ── Combine auth tools + core tools ──

const allTools: Tool[] = [...AUTH_TOOLS, ...toMCPTools() as Tool[]];
const enabledTools = getEnabledTools(allTools);

// ── Auth tool names (handled locally, not by core) ──

const AUTH_TOOL_NAMES = new Set(AUTH_TOOLS.map((t) => t.name));

// ── MCP Server ──

const server = new Server(
  { name: "otcs-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: enabledTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    if (AUTH_TOOL_NAMES.has(name)) {
      // Auth tools run locally — they mutate the module-level client state
      result = await handleAuthTool(name, args || {});
    } else {
      // All other tools delegate to core
      result = await handleToolCall(client, name, args || {});
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: true,
              message: errorMessage,
              suggestion: getSuggestion(errorMessage),
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

// ── Auth tool handler (MCP-only) ──

async function handleAuthTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "otcs_authenticate": {
      const { username, password, domain } = args as {
        username?: string;
        password?: string;
        domain?: string;
      };
      const ticket = await client.authenticate(username, password, domain);
      return {
        success: true,
        message: "Authentication successful",
        ticket_preview: ticket.substring(0, 20) + "...",
      };
    }

    case "otcs_session_status": {
      const isValid = await client.validateSession();
      return { authenticated: isValid, has_ticket: client.isAuthenticated() };
    }

    case "otcs_logout": {
      await client.logout();
      return { success: true, message: "Logged out successfully" };
    }

    default:
      throw new Error(`Unknown auth tool: ${name}`);
  }
}

// ── Startup ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const profile = process.env.OTCS_TOOL_PROFILE || "full";
  console.error(
    `OTCS MCP Server running (profile: ${profile}, tools: ${enabledTools.length})`,
  );

  if (config.username && config.password) {
    try {
      await client.authenticate();
      console.error("Auto-authenticated with environment credentials");
    } catch (error) {
      console.error(
        "Auto-authentication failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

main().catch(console.error);
