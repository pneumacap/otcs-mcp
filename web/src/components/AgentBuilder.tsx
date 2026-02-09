'use client';

import { useState } from 'react';
import Link from 'next/link';

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
}

interface AgentBuilderProps {
  agent: Agent | null;
  onSave: (data: Partial<Agent>) => Promise<void>;
  onCancel: () => void;
}

type Step = 'describe' | 'review' | 'configure';

export default function AgentBuilder({ agent, onSave, onCancel }: AgentBuilderProps) {
  const isEditing = !!agent;

  // Step management
  const [step, setStep] = useState<Step>(isEditing ? 'review' : 'describe');

  // Step 1: Describe
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Step 2: Review AI-generated config
  const [match, setMatch] = useState<Record<string, unknown>>(agent?.match ?? {});
  const [instructions, setInstructions] = useState(agent?.instructions ?? '');
  const [extractFields, setExtractFields] = useState<Record<string, string>>(
    agent?.extractFields ?? {},
  );
  const [actions, setActions] = useState<Record<string, unknown>[]>(
    (agent?.actions as Record<string, unknown>[]) ?? [],
  );
  const [tools, setTools] = useState<string[]>((agent?.tools as string[]) ?? []);
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? '');

  // Step 3: Configure
  const [watchFoldersInput, setWatchFoldersInput] = useState(
    (agent?.watchFolders as number[])?.join(', ') ?? '',
  );
  const [model, setModel] = useState(agent?.model ?? 'claude-sonnet-4-5-20250929');
  const [maxRounds, setMaxRounds] = useState(agent?.maxRounds ?? 15);
  const [pollInterval, setPollInterval] = useState((agent?.pollIntervalMs ?? 30000) / 1000);
  const [enabled, setEnabled] = useState(agent?.enabled ?? true);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleGenerate() {
    if (!name.trim() || !description.trim()) return;
    setGenerating(true);
    setGenError('');

    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || 'Generation failed');
        return;
      }

      const g = data.generated;
      setMatch(g.match || {});
      setInstructions(g.instructions || '');
      setExtractFields(g.extractFields || {});
      setActions(g.actions || []);
      setTools(g.tools || []);
      setSystemPrompt(g.systemPrompt || '');
      setStep('review');
    } catch (err: any) {
      setGenError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');

    const watchFolders = watchFoldersInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        enabled,
        match,
        instructions,
        extractFields,
        actions,
        watchFolders,
        tools,
        systemPrompt,
        model,
        maxRounds,
        pollIntervalMs: pollInterval * 1000,
      });
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Field editor helpers ──

  function addExtractField() {
    const key = prompt('Field name (e.g., "contractValue"):');
    if (!key) return;
    const hint = prompt('Extraction hint (what should AI look for?):') || 'extract if present';
    setExtractFields((prev) => ({ ...prev, [key]: hint }));
  }

  function removeExtractField(key: string) {
    setExtractFields((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addAction() {
    setActions((prev) => [...prev, { type: 'search', query: '' }]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAction(index: number, value: string) {
    try {
      const parsed = JSON.parse(value);
      setActions((prev) => prev.map((a, i) => (i === index ? parsed : a)));
    } catch {
      // Don't update on invalid JSON
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:border-blue-500 dark:focus:bg-gray-800';

  const textareaClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px] font-mono outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:border-blue-500 dark:focus:bg-gray-800 resize-y';

  const labelClass = 'mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-xs font-bold text-white"
            >
              A
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Agent' : 'Create Agent'}
            </h1>
          </div>
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Steps indicator */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl">
          {(['describe', 'review', 'configure'] as Step[]).map((s, i) => (
            <button
              key={s}
              onClick={() => {
                if (s === 'describe') setStep(s);
                else if (s === 'review' && (instructions || Object.keys(extractFields).length > 0)) setStep(s);
                else if (s === 'configure' && (instructions || Object.keys(extractFields).length > 0)) setStep(s);
              }}
              className={`flex-1 border-b-2 px-4 py-3 text-center text-xs font-medium transition-colors ${
                step === s
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold dark:bg-gray-800">
                {i + 1}
              </span>
              {s === 'describe' ? 'Describe' : s === 'review' ? 'Review & Edit' : 'Configure & Save'}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* ── Step 1: Describe ── */}
        {step === 'describe' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Describe what you want this agent to do in plain English. Altius will generate the
                matching criteria, extraction fields, and action sequence automatically.
              </p>
            </div>

            <div>
              <label className={labelClass}>Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Invoice Processing, Contract Reviewer, Legal Hold Manager"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>What should this agent do?</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Describe the automation in detail. For example:\n\n"When a new invoice is uploaded, extract the vendor name, invoice number, amount, and due date. Then categorize the document and move it to the Accounts Payable folder. If the amount exceeds $10,000, start the high-value approval workflow."\n\nThe more detail you provide, the better the generated config will be.`}
                rows={8}
                className={textareaClass}
              />
            </div>

            {genError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {genError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={!name.trim() || !description.trim() || generating}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                    </svg>
                    Generate with AI
                  </>
                )}
              </button>

              {isEditing && (
                <button
                  onClick={() => setStep('review')}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Skip to Edit
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Review & Edit ── */}
        {step === 'review' && (
          <div className="space-y-6">
            {/* Match criteria */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Match Criteria</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Document classification must match these values to trigger this agent
                  </p>
                </div>
              </div>
              <textarea
                value={JSON.stringify(match, null, 2)}
                onChange={(e) => {
                  try {
                    setMatch(JSON.parse(e.target.value));
                  } catch { /* ignore invalid JSON while typing */ }
                }}
                rows={3}
                className={textareaClass}
                placeholder='{ "documentType": "invoice" }'
              />
            </section>

            {/* Extract fields */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Extraction Fields
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Fields the AI will extract from each document
                  </p>
                </div>
                <button
                  onClick={addExtractField}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  + Add Field
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(extractFields).map(([key, hint]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-semibold text-gray-900 dark:text-white">
                        {key}
                      </code>
                      <input
                        type="text"
                        value={hint}
                        onChange={(e) =>
                          setExtractFields((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="mt-1 w-full rounded border-0 bg-gray-50 px-2 py-1 text-xs text-gray-600 outline-none focus:ring-1 focus:ring-blue-400/30 dark:bg-gray-800 dark:text-gray-300"
                      />
                    </div>
                    <button
                      onClick={() => removeExtractField(key)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {Object.keys(extractFields).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No extraction fields defined</p>
                )}
              </div>
            </section>

            {/* Actions */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Programmatic Actions
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Actions executed automatically after extraction (no extra LLM calls)
                  </p>
                </div>
                <button
                  onClick={addAction}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  + Add Action
                </button>
              </div>
              <div className="space-y-2">
                {actions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                          {i + 1}
                        </span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {(action.type as string) || 'action'}
                        </span>
                      </div>
                      <textarea
                        value={JSON.stringify(action, null, 2)}
                        onChange={(e) => updateAction(i, e.target.value)}
                        rows={4}
                        className={textareaClass}
                      />
                    </div>
                    <button
                      onClick={() => removeAction(i)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {actions.length === 0 && (
                  <p className="text-xs text-gray-400 italic">
                    No programmatic actions — agent will use the AI loop with instructions
                  </p>
                )}
              </div>
            </section>

            {/* Instructions (for agentic fallback) */}
            <section>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  AI Instructions
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {actions.length > 0
                    ? 'Used as fallback if programmatic actions fail'
                    : 'Step-by-step instructions for the AI agent loop'}
                </p>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={6}
                className={textareaClass}
                placeholder="Detailed instructions for the AI agent..."
              />
            </section>

            {/* System prompt */}
            <section>
              <label className={labelClass}>System Prompt</label>
              <input
                type="text"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className={inputClass}
                placeholder="A concise description of the agent's role"
              />
            </section>

            {/* Tools */}
            <section>
              <label className={labelClass}>
                Allowed Tools <span className="font-normal text-gray-400">(comma-separated, empty = all)</span>
              </label>
              <input
                type="text"
                value={tools.join(', ')}
                onChange={(e) => setTools(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                className={inputClass}
                placeholder="otcs_search, otcs_download_content, otcs_get_node, ..."
              />
            </section>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setStep('describe')}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={() => setStep('configure')}
                className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
              >
                Next: Configure & Save
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Configure & Save ── */}
        {step === 'configure' && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{name}</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {match && Object.keys(match).length > 0 && (
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                    matches: {JSON.stringify(match)}
                  </span>
                )}
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                  {Object.keys(extractFields).length} fields
                </span>
                <span className="rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                  {actions.length} actions
                </span>
              </div>
            </div>

            {/* Watch folders */}
            <div>
              <label className={labelClass}>
                Watch Folder IDs{' '}
                <span className="font-normal text-gray-400">(comma-separated OTCS folder IDs)</span>
              </label>
              <input
                type="text"
                value={watchFoldersInput}
                onChange={(e) => setWatchFoldersInput(e.target.value)}
                className={inputClass}
                placeholder="e.g., 181144, 180922"
              />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                The agent will monitor these folders for new document uploads
              </p>
            </div>

            {/* Model */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={inputClass}
                >
                  <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-3-5-haiku-20241022">Claude Haiku 3.5</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Max Rounds</label>
                <input
                  type="number"
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(parseInt(e.target.value, 10) || 15)}
                  min={1}
                  max={50}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Poll Interval (seconds)</label>
                <input
                  type="number"
                  value={pollInterval}
                  onChange={(e) => setPollInterval(parseInt(e.target.value, 10) || 30)}
                  min={5}
                  max={600}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Enabled toggle */}
            <label className="flex items-center gap-3 text-sm">
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                    enabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="text-gray-700 dark:text-gray-300">
                {enabled ? 'Agent enabled — will process documents' : 'Agent disabled'}
              </span>
            </label>

            {/* Errors */}
            {saveError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {saveError}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setStep('review')}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  'Create Agent'
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
