/**
 * POST /api/agents/run — Start or stop the polling agent
 * GET  /api/agents/run — Get current agent status
 *
 * Spawns the agent/poller.ts as a child process with config exported
 * from the database. This reuses 100% of the tested poller engine
 * with zero import compatibility issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn, execSync, type ChildProcess } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships } from '@/db/schema';
import { buildConfigForOrg } from '@/lib/agent-config';

// ── PID file management ──
// Persists the poller's PID to disk so we can kill it even after
// Next.js hot reload clears the in-memory agentState singleton.

const AGENT_DIR = resolve(process.cwd(), '..', 'agent');
const LOGS_DIR = resolve(AGENT_DIR, 'logs');
const PID_FILE = resolve(LOGS_DIR, '.poller-pid');

function savePid(pid: number): void {
  try {
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(PID_FILE, String(pid), 'utf-8');
  } catch { /* non-critical */ }
}

function loadPid(): number | null {
  try {
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
      return isNaN(pid) ? null : pid;
    }
  } catch { /* ignore */ }
  return null;
}

function clearPid(): void {
  try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch { /* ignore */ }
}

/**
 * Kill ALL poller processes using three layers:
 *
 * 1. Process group kill via saved PID (kills npm + tsx + node atomically)
 * 2. In-memory process reference (if agentState survived hot reload)
 * 3. pgrep/pkill fallback (catches anything that slipped through)
 *
 * Uses SIGTERM first, then SIGKILL for stragglers.
 */
function killAllPollers(): void {
  // Layer 1: Kill the saved process group (most reliable across hot reloads)
  const savedPid = loadPid();
  if (savedPid) {
    // Negative PID kills the entire process group (npm + tsx + node)
    try { process.kill(-savedPid, 'SIGTERM'); } catch { /* already dead */ }
  }

  // Layer 2: Kill in-memory tracked process
  if (agentState) {
    try { agentState.process.kill('SIGTERM'); } catch { /* already dead */ }
  }

  // Layer 3: pkill fallback for any strays
  try {
    execSync("pkill -f 'agent/poller\\.ts'", { encoding: 'utf-8' });
  } catch { /* exit code 1 = no matches — expected */ }

  // Brief pause then SIGKILL any survivors
  try {
    execSync('sleep 0.3', { encoding: 'utf-8' });
  } catch { /* ignore */ }
  if (savedPid) {
    try { process.kill(-savedPid, 'SIGKILL'); } catch { /* already dead */ }
  }
  try {
    execSync("pkill -9 -f 'agent/poller\\.ts'", { encoding: 'utf-8' });
  } catch { /* no matches */ }

  clearPid();
}

/**
 * Check if a saved PID is still alive (for GET status after hot reload).
 */
function isPollerAlive(): boolean {
  const pid = loadPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    // Process doesn't exist — stale PID file
    clearPid();
    return false;
  }
}

// ── Auth helper ──

async function getUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);
  return membership?.orgId ?? null;
}

// ── Singleton state ──

interface AgentProcess {
  process: ChildProcess;
  startedAt: string;
  orgId: string;
  recentLogs: string[];
  documentsProcessed: number;
  pollCount: number;
  totalCost: number;
}

let agentState: AgentProcess | null = null;

function parseLogLine(line: string): void {
  if (!agentState || !line.trim()) return;

  agentState.recentLogs.push(line);
  if (agentState.recentLogs.length > 100) agentState.recentLogs.shift();

  // Parse stats from log lines
  if (line.includes('Poll #')) {
    agentState.pollCount++;
  }
  if (line.includes('Done (programmatic)') || line.includes('Done (agentic)')) {
    agentState.documentsProcessed++;
    // Extract cost from "cost=$0.0031"
    const costMatch = line.match(/cost=\$([0-9.]+)/);
    if (costMatch) {
      agentState.totalCost += parseFloat(costMatch[1]);
    }
  }
}

// ── POST: start / stop ──

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await getUserOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  let body: { action: 'start' | 'stop'; processExisting?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'stop') {
    const stats = {
      documentsProcessed: agentState?.documentsProcessed ?? 0,
      pollCount: agentState?.pollCount ?? 0,
      totalCost: agentState?.totalCost ?? 0,
    };
    killAllPollers();
    agentState = null;
    return NextResponse.json({ status: 'stopped', ...stats });
  }

  if (body.action === 'start') {
    // Always kill everything first — no zombies
    killAllPollers();
    agentState = null;

    // Build config from DB
    let config;
    try {
      config = await buildConfigForOrg(orgId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (!config.enabled || config.rules.length === 0) {
      return NextResponse.json({ error: 'No enabled agents found. Create and enable at least one agent.' }, { status: 400 });
    }

    if (config.watchFolders.length === 0) {
      return NextResponse.json({ error: 'No watch folders configured. Add watch folders to your agents.' }, { status: 400 });
    }

    // Write config to agent-config.json (the poller reads this file)
    const configPath = resolve(AGENT_DIR, 'agent-config.json');
    const lastPollPath = resolve(LOGS_DIR, '.last-poll');

    // Only clear last-poll when explicitly asked to reprocess existing docs
    if (body.processExisting) {
      try {
        if (existsSync(lastPollPath)) {
          writeFileSync(lastPollPath, '', 'utf-8');
        }
      } catch {
        // Ignore — non-critical
      }
    }

    // Build the JSON shape the poller expects (strip credentials — those come from env vars)
    const pollerConfig = {
      enabled: true,
      pollIntervalMs: config.pollIntervalMs,
      maxAgentRounds: config.maxAgentRounds,
      model: config.anthropicModel,
      watchFolders: config.watchFolders,
      systemPrompt: config.systemPrompt,
      rules: config.rules,
      ...(config.tools ? { tools: config.tools } : {}),
    };

    writeFileSync(configPath, JSON.stringify(pollerConfig, null, 2), 'utf-8');

    // Spawn poller in its own process group (detached: true) so we can
    // kill the entire tree (npm + tsx + node) with a single kill(-pid).
    const child = spawn('npx', ['tsx', resolve(AGENT_DIR, 'poller.ts')], {
      cwd: AGENT_DIR,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: config.anthropicApiKey,
        OTCS_BASE_URL: config.otcsBaseUrl,
        OTCS_USERNAME: config.otcsUsername,
        OTCS_PASSWORD: config.otcsPassword,
        OTCS_TLS_SKIP_VERIFY: config.tlsSkipVerify ? 'true' : 'false',
        ...(body.processExisting ? { AGENT_PROCESS_EXISTING: 'true' } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    // Persist PID so it survives Next.js hot reloads
    if (child.pid) {
      savePid(child.pid);
    }

    agentState = {
      process: child,
      startedAt: new Date().toISOString(),
      orgId,
      recentLogs: [],
      documentsProcessed: 0,
      pollCount: 0,
      totalCost: 0,
    };

    // Capture stdout/stderr
    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) parseLogLine(line.trim());
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) parseLogLine(`[stderr] ${line.trim()}`);
      }
    });

    child.on('exit', (code) => {
      if (agentState?.process === child) {
        agentState.recentLogs.push(`[system] Process exited with code ${code}`);
        agentState = null;
      }
      clearPid();
    });

    child.on('error', (err) => {
      if (agentState?.process === child) {
        agentState.recentLogs.push(`[system] Process error: ${err.message}`);
        agentState = null;
      }
      clearPid();
    });

    return NextResponse.json({
      status: 'started',
      startedAt: agentState.startedAt,
      watchFolders: config.watchFolders,
      rulesCount: config.rules.length,
      pollIntervalMs: config.pollIntervalMs,
      pid: child.pid,
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use "start" or "stop".' }, { status: 400 });
}

// ── GET: status ──

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If agentState was lost (hot reload) but the poller is still alive,
  // report it as running so the user can still stop it.
  if (!agentState && isPollerAlive()) {
    return NextResponse.json({
      status: 'running',
      running: true,
      startedAt: null,
      documentsProcessed: 0,
      pollCount: 0,
      totalCost: 0,
      recentLogs: ['[system] Poller running (recovered after hot reload)'],
      pid: loadPid(),
    });
  }

  if (!agentState) {
    return NextResponse.json({
      status: 'stopped',
      running: false,
    });
  }

  return NextResponse.json({
    status: 'running',
    running: true,
    startedAt: agentState.startedAt,
    documentsProcessed: agentState.documentsProcessed,
    pollCount: agentState.pollCount,
    totalCost: agentState.totalCost,
    recentLogs: agentState.recentLogs.slice(-20),
    pid: agentState.process.pid,
  });
}
