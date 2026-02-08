import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships, otcsConnections } from '@/db/schema';
import { otcsConnectionSchema, parseOrError } from '@/lib/validations';
import { encrypt } from '@/lib/crypto';
import { OTCSClient } from '@otcs/core/client';

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

// GET — list connections for current org
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const connections = await db
    .select({
      id: otcsConnections.id,
      baseUrl: otcsConnections.baseUrl,
      username: otcsConnections.username,
      domain: otcsConnections.domain,
      tlsSkipVerify: otcsConnections.tlsSkipVerify,
      createdAt: otcsConnections.createdAt,
    })
    .from(otcsConnections)
    .where(eq(otcsConnections.orgId, orgId));

  return NextResponse.json(connections);
}

// POST — create a new connection
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

  const parsed = parseOrError(otcsConnectionSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { baseUrl, username, password, domain, tlsSkipVerify } = parsed.data;

  // Test the connection first
  try {
    const testClient = new OTCSClient({
      baseUrl,
      username,
      password,
      domain,
      tlsSkipVerify: tlsSkipVerify ?? false,
    });
    await testClient.authenticate();
  } catch (err: any) {
    return NextResponse.json({ error: `Connection test failed: ${err.message}` }, { status: 422 });
  }

  // Encrypt password and store
  const passwordEncrypted = encrypt(password);

  const [connection] = await db
    .insert(otcsConnections)
    .values({
      orgId,
      baseUrl,
      username,
      passwordEncrypted,
      domain: domain ?? null,
      tlsSkipVerify: tlsSkipVerify ?? false,
    })
    .returning({ id: otcsConnections.id });

  return NextResponse.json({ id: connection.id, success: true }, { status: 201 });
}

// DELETE — remove a connection
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('id');
  if (!connectionId) {
    return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
  }

  await db
    .delete(otcsConnections)
    .where(and(eq(otcsConnections.id, connectionId), eq(otcsConnections.orgId, orgId)));

  return NextResponse.json({ success: true });
}
