import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { rateLimit } from '@/lib/rate-limit';

const { auth } = NextAuth(authConfig);

// ── Security headers applied to every response ──
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
};

/** Apply security headers to a response */
function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
}

/** Apply CORS headers for API routes (same-origin only) */
function applyCorsHeaders(response: NextResponse, origin: string | null, allowedOrigin: string): void {
  if (origin === allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const isApiRoute = nextUrl.pathname.startsWith('/api/');

  // Derive allowed origin from the request
  const origin = req.headers.get('origin');
  const allowedOrigin = `${nextUrl.protocol}//${nextUrl.host}`;

  // ── CORS preflight for API routes ──
  if (isApiRoute && req.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });
    applySecurityHeaders(preflightResponse);
    applyCorsHeaders(preflightResponse, origin, allowedOrigin);
    preflightResponse.headers.set('Access-Control-Max-Age', '86400');
    return preflightResponse;
  }

  // ── Rate limiting (auth endpoints: 10 req/min per IP) ──
  if (nextUrl.pathname.startsWith('/api/auth') && !nextUrl.pathname.includes('nextauth')) {
    const result = rateLimit(`auth:${ip}`, 10, 60_000);
    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      const response = new NextResponse(
        JSON.stringify({ error: 'Too many requests' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.max(1, retryAfter)),
          },
        },
      );
      return response;
    }
  }

  // ── Public routes -- always accessible ──
  const publicPaths = ['/', '/sign-in', '/sign-up', '/api/auth', '/api/webhooks', '/api/health'];
  const isPublic = publicPaths.some(
    (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + '/'),
  );

  if (isPublic) {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    if (isApiRoute) applyCorsHeaders(response, origin, allowedOrigin);
    return response;
  }

  // ── Protected routes -- redirect to sign-in if unauthenticated ──
  if (!isLoggedIn) {
    const signInUrl = new URL('/sign-in', nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return Response.redirect(signInUrl);
  }

  // ── Authenticated response ──
  const response = NextResponse.next();
  applySecurityHeaders(response);
  if (isApiRoute) applyCorsHeaders(response, origin, allowedOrigin);
  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
