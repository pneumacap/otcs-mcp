/**
 * Master handler dispatcher — merges all domain handlers into a single lookup.
 *
 * Each domain file exports a Record<string, HandlerFn> mapping tool names
 * to their implementation. This index merges them and exposes the same
 * `handleToolCall` signature the rest of the codebase depends on.
 */

import type { OTCSClient } from '../../client/otcs-client';
import { navigationHandlers } from './navigation';
import { documentHandlers } from './documents';
import { folderHandlers } from './folders';
import { nodeOpsHandlers } from './node-ops';
import { workflowHandlers } from './workflows';
import { workspaceHandlers } from './workspaces';
import { categoryHandlers } from './categories';
import { memberHandlers } from './members';
import { permissionHandlers } from './permissions';
import { sharingHandlers } from './sharing';
import { rmHandlers } from './rm';

export type HandlerFn = (client: OTCSClient, args: Record<string, unknown>) => Promise<unknown>;

const handlers: Record<string, HandlerFn> = {
  ...navigationHandlers,
  ...documentHandlers,
  ...folderHandlers,
  ...nodeOpsHandlers,
  ...workflowHandlers,
  ...workspaceHandlers,
  ...categoryHandlers,
  ...memberHandlers,
  ...permissionHandlers,
  ...sharingHandlers,
  ...rmHandlers,
};

export async function handleToolCall(
  client: OTCSClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(client, args);
}
