import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, accounts } from '@/db/schema';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  providers: [
    // --- Google OAuth ---
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),

    // --- Email / Password ---
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),

    // --- OTDS (OpenText Directory Services) ---
    Credentials({
      id: 'otds',
      name: 'OpenText',
      credentials: {
        otdsUrl: { label: 'OTDS URL', type: 'url' },
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const otdsUrl = (credentials?.otdsUrl as string)?.replace(/\/+$/, '');
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!otdsUrl || !username || !password) return null;

        try {
          // Authenticate against OTDS REST API
          const authRes = await fetch(`${otdsUrl}/authentication/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_login: username,
              password,
            }),
          });

          if (!authRes.ok) return null;

          const authData = await authRes.json();
          const ticket = authData?.ticket;
          if (!ticket) return null;

          // Get user profile from OTDS
          let name = username;
          let email = `${username}@otds`;
          try {
            const profileRes = await fetch(`${otdsUrl}/users/${encodeURIComponent(username)}`, {
              headers: { OTDSTicket: ticket },
            });
            if (profileRes.ok) {
              const profile = await profileRes.json();
              name = profile.name || profile.display_name || username;
              email = profile.email || email;
            }
          } catch {
            // Profile fetch is best-effort
          }

          // Find or create local user
          let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

          if (!user) {
            [user] = await db
              .insert(users)
              .values({ name, email })
              .returning();
          }

          // Upsert OTDS account link
          const [existingAccount] = await db
            .select()
            .from(accounts)
            .where(eq(accounts.userId, user.id))
            .limit(1);

          if (!existingAccount) {
            await db.insert(accounts).values({
              userId: user.id,
              type: 'credentials',
              provider: 'otds',
              providerAccountId: username,
              accessToken: ticket,
            });
          }

          return { id: user.id, name: user.name, email: user.email, image: user.image };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      // On first sign-in, persist user info to token and ensure org exists
      if (user?.id) {
        token.id = user.id;
        const { ensureUserHasOrg } = await import('@/db/queries/users');
        await ensureUserHasOrg(user.id);
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
  },
});
