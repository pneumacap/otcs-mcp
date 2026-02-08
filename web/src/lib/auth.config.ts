import type { NextAuthConfig } from 'next-auth';

/**
 * Auth config that can run in the Edge runtime (middleware).
 * No native Node.js modules (bcrypt, pg) allowed here.
 * Providers that need Node.js are added in auth.ts instead.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/sign-in',
    newUser: '/chat',
  },
  providers: [], // Providers added in auth.ts (Node.js runtime)
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ['/', '/sign-in', '/sign-up', '/api/auth', '/api/webhooks', '/api/health'];
      const isPublic = publicPaths.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + '/'),
      );
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
