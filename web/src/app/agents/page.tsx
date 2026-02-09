'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AgentBuilder from '@/components/AgentBuilder';

interface Agent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  match: Record<string, unknown>;
  instructions: string;
  extractFields: Record<string, string>;
  actions: Record<string, unknown>[];
  watchFolders: number[];
  tools: string[];
  systemPrompt: string;
  model: string;
  maxRounds: number;
  pollIntervalMs: number;
  createdAt: string;
  updatedAt: string;
}

interface AgentRunStatus {
  status: 'running' | 'stopped';
  running: boolean;
  startedAt?: string;
  documentsProcessed?: number;
  pollCount?: number;
  totalCost?: number;
  recentLogs?: string[];
  pid?: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Agent runner state
  const [runStatus, setRunStatus] = useState<AgentRunStatus | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Test run state
  const [testingAgent, setTestingAgent] = useState<string | null>(null);
  const [testNodeId, setTestNodeId] = useState('');
  const [testMode, setTestMode] = useState<'dry' | 'live'>('dry');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    steps: { step: string; status: string; detail: string; durationMs: number }[];
    extraction?: Record<string, unknown>;
    matched?: boolean;
    nodeName?: string;
    mode?: string;
    usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
    agentToolCalls?: { name: string; args: Record<string, unknown>; result: string; isError: boolean }[];
    agentSummary?: string;
    agentRounds?: number;
    totalDurationMs: number;
    error?: string;
  } | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        setAgents(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll agent runner status
  const fetchRunStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/run');
      if (res.ok) {
        setRunStatus(await res.json());
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchRunStatus();
  }, [fetchAgents, fetchRunStatus]);

  // Auto-poll status when running
  useEffect(() => {
    if (runStatus?.running) {
      const interval = setInterval(fetchRunStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [runStatus?.running, fetchRunStatus]);

  async function handleStartAgent() {
    setRunLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start agent');
        setTimeout(() => setError(''), 5000);
      } else {
        setSuccess('Agent started! Polling watch folders...');
        setTimeout(() => setSuccess(''), 3000);
        fetchRunStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start agent');
      setTimeout(() => setError(''), 5000);
    } finally {
      setRunLoading(false);
    }
  }

  async function handleStopAgent() {
    setRunLoading(true);
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Agent stopped. Processed ${data.documentsProcessed ?? 0} docs, $${(data.totalCost ?? 0).toFixed(4)} total cost.`);
        setTimeout(() => setSuccess(''), 5000);
      }
      fetchRunStatus();
    } finally {
      setRunLoading(false);
    }
  }

  async function handleToggleEnabled(agent: Agent) {
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !agent.enabled }),
    });
    if (res.ok) {
      fetchAgents();
    }
  }

  async function handleDelete(agent: Agent) {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
    if (res.ok) {
      setSuccess(`Agent "${agent.name}" deleted.`);
      fetchAgents();
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  function handleEdit(agent: Agent) {
    setEditingAgent(agent);
    setShowBuilder(true);
  }

  function handleCreateNew() {
    setEditingAgent(null);
    setShowBuilder(true);
  }

  async function handleSave(agentData: Partial<Agent>) {
    setError('');

    try {
      let res: Response;
      if (editingAgent) {
        res = await fetch(`/api/agents/${editingAgent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData),
        });
      } else {
        res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save agent');
        return;
      }

      setSuccess(editingAgent ? 'Agent updated.' : 'Agent created!');
      setShowBuilder(false);
      setEditingAgent(null);
      fetchAgents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save agent');
    }
  }

  async function handleExport() {
    try {
      const res = await fetch('/api/agents/export');
      if (!res.ok) throw new Error('Export failed');
      const config = await res.json();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agent-config.json';
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Exported agent-config.json');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to export config');
    }
  }

  async function handleTestRun(agentId: string) {
    const nodeId = parseInt(testNodeId.trim(), 10);
    if (!nodeId || isNaN(nodeId)) {
      setError('Enter a valid OTCS document node ID');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (testMode === 'live' && !confirm('Live run will execute real actions on your content server. Continue?')) {
      return;
    }

    setTestRunning(true);
    setTestResult(null);
    setError('');

    try {
      const res = await fetch(`/api/agents/${agentId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, mode: testMode }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setError(err.message || 'Test failed');
    } finally {
      setTestRunning(false);
    }
  }

  if (showBuilder) {
    return (
      <AgentBuilder
        agent={editingAgent}
        onSave={handleSave}
        onCancel={() => {
          setShowBuilder(false);
          setEditingAgent(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-xs font-bold text-white"
            >
              A
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Automation Agents
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Create agents that automatically process documents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {agents.length > 0 && (
              <>
                {/* Start/Stop Agent Button */}
                {runStatus?.running ? (
                  <button
                    onClick={handleStopAgent}
                    disabled={runLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                  >
                    {runLoading ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    )}
                    Stop Agent
                  </button>
                ) : (
                  <button
                    onClick={handleStartAgent}
                    disabled={runLoading || agents.filter((a) => a.enabled).length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md disabled:opacity-50"
                  >
                    {runLoading ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    )}
                    Start Agent
                  </button>
                )}

                <button
                  onClick={handleExport}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Export Config
                </button>
              </>
            )}
            <Link
              href="/chat"
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Agent Runner Status Bar */}
        {runStatus?.running && (
          <div className="mb-6 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:border-green-900/50 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Agent Running
                </span>
                {runStatus.startedAt && (
                  <span className="text-xs text-green-600/70 dark:text-green-400/70">
                    since {new Date(runStatus.startedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-green-600/70 dark:text-green-400/70">Polls:</span>
                  <span className="font-semibold text-green-800 dark:text-green-300">{runStatus.pollCount ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-600/70 dark:text-green-400/70">Docs:</span>
                  <span className="font-semibold text-green-800 dark:text-green-300">{runStatus.documentsProcessed ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-600/70 dark:text-green-400/70">Cost:</span>
                  <span className="font-mono font-semibold text-green-800 dark:text-green-300">
                    ${(runStatus.totalCost ?? 0).toFixed(4)}
                  </span>
                </div>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-green-700 transition-colors hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
                >
                  {showLogs ? 'Hide Logs' : 'Show Logs'}
                </button>
              </div>
            </div>

            {/* Recent logs */}
            {showLogs && runStatus.recentLogs && runStatus.recentLogs.length > 0 && (
              <div className="border-t border-green-200/50 px-4 py-3 dark:border-green-900/30">
                <div className="max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-green-400">
                  {runStatus.recentLogs.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : agents.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              No agents yet
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm text-gray-500 dark:text-gray-400">
              Agents automatically process documents uploaded to your content server.
              Describe what you want automated and Altius will generate the configuration.
            </p>
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Your First Agent
            </button>
          </div>
        ) : (
          /* Agent list */
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {agents.filter((a) => a.enabled).length} of {agents.length} agent{agents.length !== 1 ? 's' : ''} enabled
              </p>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Agent
              </button>
            </div>

            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`rounded-xl border bg-white transition-all dark:bg-gray-900 ${
                    agent.enabled
                      ? 'border-gray-200 dark:border-gray-800'
                      : 'border-gray-200/60 opacity-60 dark:border-gray-800/60'
                  }`}
                >
                  {/* Agent header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Status indicator */}
                      <button
                        onClick={() => handleToggleEnabled(agent)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          agent.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        title={agent.enabled ? 'Click to disable' : 'Click to enable'}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                            agent.enabled ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </button>

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {agent.name}
                        </h3>
                        {agent.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                            {agent.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {/* Match badge */}
                      {agent.match && Object.keys(agent.match).length > 0 && (
                        <span className="rounded-md bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                          {Object.values(agent.match).join(', ')}
                        </span>
                      )}

                      {/* Actions count badge */}
                      {(agent.actions as unknown[]).length > 0 && (
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                          {(agent.actions as unknown[]).length} action{(agent.actions as unknown[]).length !== 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Agentic badge */}
                      {(agent.actions as unknown[]).length === 0 && agent.instructions && (
                        <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                          Agentic
                        </span>
                      )}

                      {/* Test */}
                      <button
                        onClick={() => {
                          setTestingAgent(testingAgent === agent.id ? null : agent.id);
                          setTestResult(null);
                          setTestNodeId('');
                        }}
                        className={`rounded-lg p-1.5 transition-colors ${
                          testingAgent === agent.id
                            ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'
                            : 'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950/30 dark:hover:text-green-400'
                        }`}
                        title="Test run agent"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                        </svg>
                      </button>

                      {/* Expand/collapse */}
                      <button
                        onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${expandedAgent === agent.id ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(agent)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                        title="Edit agent"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(agent)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        title="Delete agent"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Test run panel */}
                  {testingAgent === agent.id && (
                    <div className="border-t border-green-100 bg-green-50/30 px-4 pb-4 pt-3 dark:border-green-900/30 dark:bg-green-950/10">
                      <div className="mb-3 flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                        </svg>
                        <span className="text-xs font-semibold text-green-800 dark:text-green-300">
                          Test Run — dry run this agent against a document
                        </span>
                      </div>

                      {/* Mode toggle */}
                      <div className="mb-3 flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800 w-fit">
                        <button
                          onClick={() => setTestMode('dry')}
                          className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-all ${
                            testMode === 'dry'
                              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                          }`}
                        >
                          Dry Run
                        </button>
                        <button
                          onClick={() => setTestMode('live')}
                          className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-all ${
                            testMode === 'live'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                          }`}
                        >
                          Live Run
                        </button>
                      </div>

                      {testMode === 'live' && (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                          Live mode will execute real actions on your content server (update descriptions, apply categories, etc.)
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={testNodeId}
                          onChange={(e) => setTestNodeId(e.target.value)}
                          placeholder="Enter OTCS document node ID..."
                          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none placeholder:text-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-400/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !testRunning) handleTestRun(agent.id);
                          }}
                        />
                        <button
                          onClick={() => handleTestRun(agent.id)}
                          disabled={testRunning || !testNodeId.trim()}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 ${
                            testMode === 'live'
                              ? 'bg-amber-500 hover:bg-amber-600'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {testRunning ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              {testMode === 'live' ? 'Executing...' : 'Running...'}
                            </>
                          ) : testMode === 'live' ? (
                            'Execute Live'
                          ) : (
                            'Run Test'
                          )}
                        </button>
                      </div>

                      {/* Test results */}
                      {testResult && (
                        <div className="mt-4 space-y-2">
                          {/* Document name */}
                          {testResult.nodeName && (
                            <div className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Document: </span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">{testResult.nodeName}</span>
                            </div>
                          )}

                          {/* Step-by-step results */}
                          {testResult.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              {/* Status icon */}
                              <div className="mt-0.5 shrink-0">
                                {step.status === 'success' && (
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                                    <svg className="h-2.5 w-2.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                  </span>
                                )}
                                {step.status === 'error' && (
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                                    <svg className="h-2.5 w-2.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  </span>
                                )}
                                {step.status === 'warning' && (
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                                    <svg className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                  </span>
                                )}
                                {step.status === 'info' && (
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                                    <svg className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-gray-900 dark:text-white">{step.step}</span>
                                <span className="ml-1.5 text-gray-400">({step.durationMs}ms)</span>
                                <p className="mt-0.5 text-gray-600 dark:text-gray-400">{step.detail}</p>
                              </div>
                            </div>
                          ))}

                          {/* Extraction results */}
                          {testResult.extraction && (
                            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                Extracted Fields
                              </span>
                              <div className="mt-2 space-y-1.5">
                                {Object.entries(testResult.extraction).map(([k, v]) => (
                                  <div key={k} className="flex gap-2 text-xs">
                                    <span className="shrink-0 font-mono font-semibold text-gray-700 dark:text-gray-300">{k}:</span>
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {typeof v === 'object' ? JSON.stringify(v) : String(v ?? 'null')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tool calls from live run */}
                          {testResult.agentToolCalls && testResult.agentToolCalls.length > 0 && (
                            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                Tool Calls ({testResult.agentToolCalls.length})
                              </span>
                              <div className="mt-2 space-y-2">
                                {testResult.agentToolCalls.map((tc, i) => (
                                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${
                                    tc.isError
                                      ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
                                      : 'border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-mono font-semibold ${tc.isError ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        {tc.name}
                                      </span>
                                      {tc.isError && (
                                        <span className="rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400">ERROR</span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                      {JSON.stringify(tc.args).slice(0, 200)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-300 break-all">
                                      {tc.result.slice(0, 300)}{tc.result.length > 300 ? '...' : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Agent summary from live run */}
                          {testResult.agentSummary && (
                            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                                Agent Summary
                              </span>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">
                                {testResult.agentSummary}
                              </p>
                            </div>
                          )}

                          {/* Summary bar */}
                          <div className="mt-2 flex items-center gap-3 rounded-lg bg-gray-100 px-3 py-2 text-[11px] dark:bg-gray-800">
                            <span className={`font-semibold ${testResult.matched ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {testResult.matched ? 'MATCHED' : 'NO MATCH'}
                            </span>
                            {testResult.mode && (
                              <span className={`rounded px-1.5 py-0.5 font-bold ${
                                testResult.mode === 'live'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {testResult.mode === 'live' ? 'LIVE' : 'DRY'}
                              </span>
                            )}
                            {testResult.agentRounds !== undefined && (
                              <span className="text-gray-500 dark:text-gray-400">
                                {testResult.agentRounds} round(s)
                              </span>
                            )}
                            {testResult.usage && (
                              <span className="text-gray-500 dark:text-gray-400">
                                {testResult.usage.inputTokens + testResult.usage.outputTokens} tokens
                              </span>
                            )}
                            {testResult.usage?.costUsd !== undefined && (
                              <span className="font-mono text-gray-500 dark:text-gray-400">
                                ${testResult.usage.costUsd.toFixed(4)}
                              </span>
                            )}
                            <span className="text-gray-500 dark:text-gray-400">
                              {(testResult.totalDurationMs / 1000).toFixed(1)}s
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded details */}
                  {expandedAgent === agent.id && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {/* Match */}
                        {agent.match && Object.keys(agent.match).length > 0 && (
                          <div>
                            <span className="font-medium text-gray-500 dark:text-gray-400">Match criteria</span>
                            <pre className="mt-1 rounded-lg bg-gray-50 p-2 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {JSON.stringify(agent.match, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Extract fields */}
                        {agent.extractFields && Object.keys(agent.extractFields).length > 0 && (
                          <div>
                            <span className="font-medium text-gray-500 dark:text-gray-400">
                              Extract fields ({Object.keys(agent.extractFields).length})
                            </span>
                            <div className="mt-1 space-y-1">
                              {Object.entries(agent.extractFields).map(([k, v]) => (
                                <div key={k} className="rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-800">
                                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{k}</span>
                                  <span className="ml-1 text-gray-500 dark:text-gray-400">— {v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {(agent.actions as unknown[]).length > 0 && (
                          <div>
                            <span className="font-medium text-gray-500 dark:text-gray-400">Actions</span>
                            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-gray-50 p-2 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {JSON.stringify(agent.actions, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Instructions */}
                        {agent.instructions && (
                          <div className="col-span-2">
                            <span className="font-medium text-gray-500 dark:text-gray-400">Instructions</span>
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {agent.instructions}
                            </pre>
                          </div>
                        )}

                        {/* Watch folders */}
                        {(agent.watchFolders as number[]).length > 0 && (
                          <div>
                            <span className="font-medium text-gray-500 dark:text-gray-400">Watch folders</span>
                            <p className="mt-1 text-gray-700 dark:text-gray-300">
                              {(agent.watchFolders as number[]).join(', ')}
                            </p>
                          </div>
                        )}

                        {/* Model & settings */}
                        <div>
                          <span className="font-medium text-gray-500 dark:text-gray-400">Settings</span>
                          <p className="mt-1 text-gray-700 dark:text-gray-300">
                            {agent.model} / {agent.maxRounds} rounds / {agent.pollIntervalMs / 1000}s poll
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
