import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptions, usageRecords } from '@/db/schema';
import { PLANS, type PlanName } from './stripe';

export interface QuotaCheck {
  allowed: boolean;
  plan: PlanName;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check whether an org has remaining message quota for the current billing period.
 */
export async function checkQuota(orgId: string): Promise<QuotaCheck> {
  // Get subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  const plan = (sub?.plan as PlanName) || 'free';
  const planConfig = PLANS[plan];
  const limit = planConfig.messagesPerMonth;

  // Unlimited plan
  if (limit === Infinity) {
    return { allowed: true, plan, used: 0, limit: Infinity, remaining: Infinity };
  }

  // Count messages this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageRecords)
    .where(and(eq(usageRecords.orgId, orgId), gte(usageRecords.createdAt, startOfMonth)));

  const used = result?.count ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    plan,
    used,
    limit,
    remaining,
  };
}

/**
 * Record usage after a chat request completes.
 */
export async function recordUsage(data: {
  orgId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  toolCalls: number;
  costUsd: number;
}) {
  await db.insert(usageRecords).values({
    orgId: data.orgId,
    userId: data.userId,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    cacheTokens: data.cacheTokens,
    toolCalls: data.toolCalls,
    costUsd: data.costUsd.toFixed(6),
  });
}
