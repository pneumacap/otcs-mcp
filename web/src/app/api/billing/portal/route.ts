import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { db } from '@/db';
import { orgMemberships, subscriptions } from '@/db/schema';

export async function POST() {
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

  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account. Upgrade to Pro first.' },
      { status: 400 },
    );
  }

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
