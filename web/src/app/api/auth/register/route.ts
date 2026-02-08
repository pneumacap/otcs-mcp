import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { registerSchema, parseOrError } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { findUserByEmail, createUserWithOrg } from '@/db/queries/users';

export async function POST(request: NextRequest) {
  // --- Rate limit: 10 req/min per IP ---
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = rateLimit(`register:${ip}`, 10, 60_000);
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseOrError(registerSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  // Check for existing user
  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 },
    );
  }

  // Hash password and create user + org + subscription
  const passwordHash = await bcrypt.hash(password, 12);
  await createUserWithOrg({ name, email, passwordHash });

  return NextResponse.json({ success: true }, { status: 201 });
}
