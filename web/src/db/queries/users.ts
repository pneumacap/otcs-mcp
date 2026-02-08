import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, organizations, orgMemberships, subscriptions } from '@/db/schema';

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/**
 * Create a new user with a personal org and free subscription.
 * Used by the registration endpoint (email/password sign-up).
 */
export async function createUserWithOrg(data: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  // Create user
  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
    })
    .returning();

  // Create personal org
  const slug =
    data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'user';
  const uniqueSlug = `${slug}-${user.id.slice(0, 8)}`;

  const [org] = await db
    .insert(organizations)
    .values({ name: `${data.name}'s Org`, slug: uniqueSlug })
    .returning();

  // Add user as owner
  await db.insert(orgMemberships).values({
    orgId: org.id,
    userId: user.id,
    role: 'owner',
  });

  // Create free subscription
  await db.insert(subscriptions).values({
    orgId: org.id,
    plan: 'free',
    status: 'active',
  });

  return { user, org };
}

/**
 * Ensure a user (from OAuth) has an org + subscription.
 * Called on first Google/OTDS sign-in when the adapter auto-creates the user.
 */
export async function ensureUserHasOrg(userId: string) {
  // Check if user already has an org
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);

  if (membership) return; // Already has an org

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const slug = `user-${userId.slice(0, 8)}`;
  const [org] = await db
    .insert(organizations)
    .values({ name: `${user.name}'s Org`, slug })
    .returning();

  await db.insert(orgMemberships).values({
    orgId: org.id,
    userId,
    role: 'owner',
  });

  await db.insert(subscriptions).values({
    orgId: org.id,
    plan: 'free',
    status: 'active',
  });
}
