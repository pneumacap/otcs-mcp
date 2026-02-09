import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships, agents } from '@/db/schema';
import { updateAgentSchema, parseOrError } from '@/lib/validations';

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

// GET — get a single agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { id } = await params;

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.orgId, orgId)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json(agent);
}

// PUT — update an agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseOrError(updateAgentSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const data = parsed.data;

  const [updated] = await db
    .update(agents)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, id), eq(agents.orgId, orgId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE — delete an agent
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { id } = await params;

  await db
    .delete(agents)
    .where(and(eq(agents.id, id), eq(agents.orgId, orgId)));

  return NextResponse.json({ success: true });
}
