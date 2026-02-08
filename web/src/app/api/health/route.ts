import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const checks: Record<string, string> = {};

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
  }

  const allHealthy = Object.values(checks).every((v) => v !== 'disconnected');

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  );
}
