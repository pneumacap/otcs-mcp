/**
 * GET /api/agents/config
 *
 * Returns a full AgentConfig object (same shape as agent-config.json)
 * by merging DB-stored agents with the org's OTCS connection.
 * Strips secrets for HTTP response safety.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships } from '@/db/schema';
import { buildConfigForOrg } from '@/lib/agent-config';

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  try {
    const config = await buildConfigForOrg(orgId);
    // Strip secrets from the HTTP response
    const { anthropicApiKey, otcsPassword, ...safeConfig } = config;
    return NextResponse.json({
      ...safeConfig,
      hasApiKey: !!anthropicApiKey,
      hasOtcsPassword: !!otcsPassword,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
