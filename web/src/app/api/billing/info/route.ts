import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { checkQuota } from '@/lib/quota';
import { db } from '@/db';
import { orgMemberships, subscriptions } from '@/db/schema';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, membership.orgId))
    .limit(1);

  const quota = await checkQuota(membership.orgId);

  return NextResponse.json({
    plan: sub?.plan || 'free',
    status: sub?.status || 'active',
    used: quota.used,
    limit: quota.limit === Infinity ? null : quota.limit,
    remaining: quota.remaining === Infinity ? null : quota.remaining,
    periodEnd: sub?.periodEnd?.toISOString() || null,
  });
}
