import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships, agents } from '@/db/schema';
import { createAgentSchema, parseOrError } from '@/lib/validations';

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

// GET — list agents for current org
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const results = await db
    .select()
    .from(agents)
    .where(eq(agents.orgId, orgId))
    .orderBy(agents.createdAt);

  return NextResponse.json(results);
}

// POST — create a new agent
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseOrError(createAgentSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const data = parsed.data;

  const [agent] = await db
    .insert(agents)
    .values({
      orgId,
      name: data.name,
      description: data.description,
      enabled: data.enabled,
      instructions: data.instructions,
      watchFolders: data.watchFolders,
      tools: data.tools,
      systemPrompt: data.systemPrompt,
      model: data.model,
      maxRounds: data.maxRounds,
      pollIntervalMs: data.pollIntervalMs,
    })
    .returning();

  return NextResponse.json(agent, { status: 201 });
}
