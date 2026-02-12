'use client';

import { useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkIcons, InlineIcon } from '@/lib/remark-icons';
import ToolCallDisplay from './ToolCallDisplay';
import ToolCallGroup from './ToolCallGroup';
import ChartBlock, { ChartConfig } from './ChartBlock';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isLoading?: boolean;
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: ToolCall };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string; // user messages use this directly
  parts?: MessagePart[]; // assistant messages use ordered parts
}

const mdComponents: Components & Record<string, unknown> = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    if (className === 'language-chart') {
      const raw = String(children).trim();
      try {
        const config: ChartConfig = JSON.parse(raw);
        return <ChartBlock config={config} />;
      } catch {
        // Likely still streaming — show a placeholder
        return (
          <pre className="my-2 animate-pulse rounded-lg border border-dashed border-gray-300 p-4 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500">
            Rendering chart…
          </pre>
        );
      }
    }
    // Default inline/block code rendering
    return <code className={className}>{children}</code>;
  },
  'icon-inline': InlineIcon,
};

type RenderSegment =
  | { type: 'text'; text: string; index: number }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_call_group'; name: string; toolCalls: ToolCall[] };

function groupParts(parts: MessagePart[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let run: ToolCall[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      segments.push({ type: 'tool_call', toolCall: run[0] });
    } else {
      segments.push({ type: 'tool_call_group', name: run[0].name, toolCalls: [...run] });
    }
    run = [];
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'tool_call') {
      if (run.length > 0 && run[0].name !== part.toolCall.name) {
        flushRun();
      }
      run.push(part.toolCall);
    } else {
      flushRun();
      segments.push({ type: 'text', text: part.text, index: i });
    }
  }
  flushRun();

  return segments;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-[#1a6aff] px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message — render parts in order
  const parts = message.parts || [];
  const segments = useMemo(() => groupParts(parts), [parts]);

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-[10px] font-bold text-white">
        OT
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((seg) => {
          if (seg.type === 'tool_call_group') {
            return (
              <ToolCallGroup
                key={`group-${seg.toolCalls[0].id}`}
                toolCalls={seg.toolCalls}
              />
            );
          }
          if (seg.type === 'tool_call') {
            return (
              <ToolCallDisplay
                key={seg.toolCall.id}
                name={seg.toolCall.name}
                args={seg.toolCall.args}
                result={seg.toolCall.result}
                isError={seg.toolCall.isError}
                isLoading={seg.toolCall.isLoading}
              />
            );
          }
          // text segment — only render if non-empty
          if (!seg.text.trim()) return null;
          return (
            <div key={`text-${seg.index}`} className="assistant-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkIcons]} components={mdComponents}>
                {seg.text}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
    </div>
  );
}
