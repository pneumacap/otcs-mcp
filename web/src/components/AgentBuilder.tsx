'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  instructions: string;
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

type Step = 'describe' | 'configure';

export default function AgentBuilder({ agent, onSave, onCancel }: AgentBuilderProps) {
  const isEditing = !!agent;

  // Step management
  const [step, setStep] = useState<Step>(isEditing ? 'describe' : 'describe');

  // Step 1: Describe + AI-generated config
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [instructions, setInstructions] = useState(agent?.instructions ?? '');
  const [tools, setTools] = useState<string[]>((agent?.tools as string[]) ?? []);
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? '');

  // Step 2: Configure
  const [watchFoldersInput, setWatchFoldersInput] = useState(
    (agent?.watchFolders as number[])?.join(', ') ?? '',
  );
  const [model, setModel] = useState(agent?.model ?? 'claude-haiku-4-5-20251001');
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
      setInstructions(g.instructions || '');
      setTools(g.tools || []);
      setSystemPrompt(g.systemPrompt || '');
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
        instructions,
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

  const hasConfig = !!instructions;

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
          {(['describe', 'configure'] as Step[]).map((s, i) => (
            <button
              key={s}
              onClick={() => {
                if (s === 'describe') setStep(s);
                else if (s === 'configure' && hasConfig) setStep(s);
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
              {s === 'describe' ? 'Describe' : 'Configure & Save'}
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
                Describe what you want this agent to do in plain English. Altius will generate
                the instructions, system prompt, and tool list automatically.
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
                placeholder={`Describe the automation in detail. For example:\n\n"When a new subpoena is uploaded, read it, search for all referenced documents, place them on a legal hold, and share the results with the legal team."\n\nThe more detail you provide, the better the generated instructions will be.`}
                rows={6}
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
            </div>

            {/* Show generated/editable config inline after generation (or when editing) */}
            {hasConfig && (
              <div className="space-y-6 border-t border-gray-200 pt-6 dark:border-gray-800">
                {/* Instructions */}
                <section>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Agent Instructions
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Step-by-step instructions the AI agent will follow for each document
                    </p>
                  </div>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={10}
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
                    onClick={() => setStep('configure')}
                    className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
                  >
                    Next: Configure & Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Configure & Save ── */}
        {step === 'configure' && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{name}</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tools.length > 0 && (
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                    {tools.length} tool{tools.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  Agentic
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
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                  <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
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
                onClick={() => setStep('describe')}
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
