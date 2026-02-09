import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships, agents } from '@/db/schema';

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

// GET — export agents as agent-config.json format (for the standalone poller)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const agentList = await db
    .select()
    .from(agents)
    .where(eq(agents.orgId, orgId));

  const enabledAgents = agentList.filter((a) => a.enabled);

  // Merge all agents into a single agent-config.json format
  const allWatchFolders = new Set<number>();
  const allTools = new Set<string>();
  const rules: Record<string, unknown>[] = [];

  for (const agent of enabledAgents) {
    const watchFolders = agent.watchFolders as number[];
    for (const fid of watchFolders) allWatchFolders.add(fid);

    const tools = agent.tools as string[];
    for (const t of tools) allTools.add(t);

    rules.push({
      name: agent.name,
      match: agent.match,
      instructions: agent.instructions,
      extractFields: agent.extractFields,
      actions: agent.actions,
    });
  }

  // Use the first enabled agent's settings as defaults, or sensible defaults
  const first = enabledAgents[0];

  const config = {
    enabled: enabledAgents.length > 0,
    pollIntervalMs: first?.pollIntervalMs ?? 30000,
    maxAgentRounds: first?.maxRounds ?? 15,
    model: first?.model ?? 'claude-sonnet-4-5-20250929',
    watchFolders: [...allWatchFolders],
    tools: allTools.size > 0 ? [...allTools] : undefined,
    systemPrompt:
      first?.systemPrompt ||
      'You are an autonomous document processing agent for OpenText Content Server.',
    rules,
  };

  return NextResponse.json(config);
}
