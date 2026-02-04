"use client";

import { useState } from "react";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

// Anthropic Sonnet 4.5 pricing per token
const PRICING = {
  input: 3 / 1_000_000,          // $3/MTok
  output: 15 / 1_000_000,        // $15/MTok
  cache_read: 0.3 / 1_000_000,   // $0.30/MTok
  cache_write: 3.75 / 1_000_000, // $3.75/MTok
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function computeCost(usage: TokenUsage): number {
  const nonCachedInput =
    usage.input_tokens -
    usage.cache_read_input_tokens -
    usage.cache_creation_input_tokens;
  return (
    Math.max(0, nonCachedInput) * PRICING.input +
    usage.output_tokens * PRICING.output +
    usage.cache_read_input_tokens * PRICING.cache_read +
    usage.cache_creation_input_tokens * PRICING.cache_write
  );
}

function cacheHitRatio(usage: TokenUsage): number {
  if (usage.input_tokens === 0) return 0;
  return (usage.cache_read_input_tokens / usage.input_tokens) * 100;
}

export default function UsageBadge({ usage }: { usage: TokenUsage }) {
  const [expanded, setExpanded] = useState(false);
  const cost = computeCost(usage);
  const cacheHit = cacheHitRatio(usage);
  const total = usage.input_tokens + usage.output_tokens;

  if (total === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-750"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>{formatTokens(total)} tokens</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>${cost.toFixed(3)}</span>
      </button>

      {expanded && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Input tokens</span>
              <span className="font-mono">{usage.input_tokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Output tokens</span>
              <span className="font-mono">{usage.output_tokens.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>Cache read</span>
                <span className="font-mono">{usage.cache_read_input_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>Cache write</span>
                <span className="font-mono">{usage.cache_creation_input_tokens.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between text-gray-500 dark:text-gray-400">
                <span>Cache hit ratio</span>
                <span className={`font-mono ${cacheHit > 50 ? "text-green-600 dark:text-green-400" : cacheHit > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>
                  {cacheHit.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-medium text-gray-700 dark:border-gray-800 dark:text-gray-300">
              <span>Estimated cost</span>
              <span className="font-mono">${cost.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
