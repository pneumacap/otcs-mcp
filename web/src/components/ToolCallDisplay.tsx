"use client";

import { useState } from "react";

interface ToolCallDisplayProps {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isLoading?: boolean;
}

export default function ToolCallDisplay({
  name,
  args,
  result,
  isError,
  isLoading,
}: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = name.replace("otcs_", "").replace(/_/g, " ");

  // Build a compact summary of args
  const argSummary = Object.entries(args)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");

  return (
    <div
      className={`my-1 rounded-lg border text-xs ${
        isError
          ? "border-red-200/60 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/30"
          : "border-gray-200/80 bg-gray-50/50 dark:border-gray-700/60 dark:bg-gray-800/40"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        {isLoading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-blue-500 border-t-transparent" />
        ) : isError ? (
          <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.22 5.97l-3.5 3.5a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 111.06-1.06l.97.97 2.97-2.97a.75.75 0 111.06 1.06z"/>
          </svg>
        )}
        <span className="font-medium capitalize text-gray-600 dark:text-gray-400">
          {displayName}
        </span>
        {!expanded && argSummary && (
          <span className="truncate text-gray-400 dark:text-gray-500">
            {argSummary}
          </span>
        )}
        <svg
          className={`ml-auto h-3 w-3 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200/60 px-2.5 py-2 dark:border-gray-700/40">
          <div className="mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Arguments
            </span>
            <pre className="mt-0.5 max-h-32 overflow-auto rounded-md bg-white/80 p-2 font-mono text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900/60 dark:text-gray-400">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {result && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Result
              </span>
              <pre className="mt-0.5 max-h-48 overflow-auto rounded-md bg-white/80 p-2 font-mono text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900/60 dark:text-gray-400">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
