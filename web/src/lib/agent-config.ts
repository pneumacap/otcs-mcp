/**
 * Build a full AgentConfig from the database for a given org.
 *
 * Used by:
 *   - GET /api/agents/config (returns safe version to client)
 *   - POST /api/agents/run (feeds config to the poller child process)
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { agents, otcsConnections } from '@/db/schema';
import { decrypt } from '@/lib/crypto';
import { env } from '@/lib/env';

export interface AgentConfigFromDB {
  enabled: boolean;
  pollIntervalMs: number;
  maxAgentRounds: number;
  watchFolders: number[];
  systemPrompt: string;
  agents: {
    name: string;
    instructions: string;
    systemPrompt?: string;
    tools?: string[];
    watchFolders?: number[];
  }[];
  anthropicApiKey: string;
  anthropicModel: string;
  otcsBaseUrl: string;
  otcsUsername: string;
  otcsPassword: string;
  tlsSkipVerify: boolean;
  tools?: string[];
  concurrency: number;
}

export async function buildConfigForOrg(orgId: string): Promise<AgentConfigFromDB> {
  // Get OTCS connection
  const [conn] = await db
    .select()
    .from(otcsConnections)
    .where(eq(otcsConnections.orgId, orgId))
    .limit(1);

  if (!conn) {
    throw new Error('No OTCS connection configured. Go to Settings > Connections first.');
  }

  // Get enabled agents
  const agentList = await db.select().from(agents).where(eq(agents.orgId, orgId));
  const enabledAgents = agentList.filter((a) => a.enabled);

  // Merge into config shape
  const allWatchFolders = new Set<number>();
  const allTools = new Set<string>();
  const agentDefs: AgentConfigFromDB['agents'] = [];

  for (const agent of enabledAgents) {
    const watchFolders = agent.watchFolders as number[];
    for (const fid of watchFolders) allWatchFolders.add(fid);

    const tools = agent.tools as string[];
    for (const t of tools) allTools.add(t);

    agentDefs.push({
      name: agent.name,
      instructions: agent.instructions,
      systemPrompt: agent.systemPrompt || undefined,
      tools: tools.length > 0 ? tools : undefined,
      watchFolders: watchFolders.length > 0 ? watchFolders : undefined,
    });
  }

  const first = enabledAgents[0];

  return {
    enabled: enabledAgents.length > 0,
    pollIntervalMs: first?.pollIntervalMs ?? 30000,
    maxAgentRounds: first?.maxRounds ?? 15,
    watchFolders: [...allWatchFolders],
    systemPrompt:
      first?.systemPrompt ||
      'You are an autonomous document processing agent for OpenText Content Server.',
    agents: agentDefs,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: first?.model ?? 'claude-haiku-4-5-20251001',
    otcsBaseUrl: conn.baseUrl,
    otcsUsername: conn.username,
    otcsPassword: decrypt(conn.passwordEncrypted),
    tlsSkipVerify: conn.tlsSkipVerify ?? false,
    ...(allTools.size > 0 ? { tools: [...allTools] } : {}),
    concurrency: 3,
  };
}
