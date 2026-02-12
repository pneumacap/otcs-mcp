'use client';

import { useState } from 'react';
import type { ToolCall } from './MessageBubble';
import ToolCallDisplay from './ToolCallDisplay';

const TOOL_LABELS: Record<string, string> = {
  otcs_browse: 'folders browsed',
  otcs_search: 'searches',
  otcs_get_node: 'nodes fetched',
  otcs_upload: 'files uploaded',
  otcs_download_content: 'files downloaded',
  otcs_categories: 'categories fetched',
  otcs_permissions: 'permissions checked',
  otcs_versions: 'versions fetched',
  otcs_members: 'members fetched',
  otcs_create_folder: 'folders created',
  otcs_browse_tree: 'trees browsed',
  otcs_node_action: 'actions performed',
  otcs_search_workspaces: 'workspaces searched',
  otcs_get_workspace: 'workspaces fetched',
  otcs_workflow_tasks: 'tasks fetched',
};

interface ToolCallGroupProps {
  toolCalls: ToolCall[];
}

export default function ToolCallGroup({ toolCalls }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const name = toolCalls[0].name;
  const displayName = name.replace('otcs_', '').replace(/_/g, ' ');

  const total = toolCalls.length;
  const done = toolCalls.filter((tc) => !tc.isLoading).length;
  const anyLoading = toolCalls.some((tc) => tc.isLoading);
  const anyError = toolCalls.some((tc) => tc.isError);

  const label = TOOL_LABELS[name] || 'calls';
  const countText = anyLoading ? `${done}/${total}` : `${total} ${label}`;

  return (
    <div className="my-1 rounded-lg border border-gray-200/80 bg-gray-50/50 text-xs dark:border-gray-700/60 dark:bg-gray-800/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        {anyLoading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-blue-500 border-t-transparent" />
        ) : anyError ? (
          <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.22 5.97l-3.5 3.5a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 111.06-1.06l.97.97 2.97-2.97a.75.75 0 111.06 1.06z" />
          </svg>
        )}
        <span className="font-medium capitalize text-gray-600 dark:text-gray-400">
          {displayName}
        </span>
        <span className="rounded-full bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
          {countText}
        </span>
        <svg
          className={`ml-auto h-3 w-3 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {expanded && (
        <div className="max-h-96 overflow-y-auto border-t border-gray-200/60 px-2 py-1.5 dark:border-gray-700/40">
          {toolCalls.map((tc) => (
            <ToolCallDisplay
              key={tc.id}
              name={tc.name}
              args={tc.args}
              result={tc.result}
              isError={tc.isError}
              isLoading={tc.isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
