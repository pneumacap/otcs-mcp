import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getStripe, PLANS } from '@/lib/stripe';
import { db } from '@/db';
import { orgMemberships, subscriptions, users } from '@/db/schema';
import { checkoutSchema, parseOrError } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseOrError(checkoutSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { plan } = parsed.data;
  const planConfig = PLANS[plan];
  if (!('priceId' in planConfig) || !planConfig.priceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Get user's org
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, session.user.id))
    .limit(1);

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only org owners/admins can manage billing' },
      { status: 403 },
    );
  }

  // Get or create Stripe customer
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, membership.orgId))
    .limit(1);

  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

    const customer = await getStripe().customers.create({
      email: user?.email ?? undefined,
      name: user?.name ?? undefined,
      metadata: { orgId: membership.orgId },
    });

    customerId = customer.id;

    await db
      .update(subscriptions)
      .set({ stripeCustomerId: customerId })
      .where(eq(subscriptions.orgId, membership.orgId));
  }

  // Create Checkout Session
  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing?canceled=true`,
    metadata: { orgId: membership.orgId },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
