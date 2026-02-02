"use client";

import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import ToolCallDisplay from "./ToolCallDisplay";
import ChartBlock, { ChartConfig } from "./ChartBlock";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isLoading?: boolean;
}

export type MessagePart =
  | { type: "text"; text: string }
  | { type: "tool_call"; toolCall: ToolCall };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string; // user messages use this directly
  parts?: MessagePart[]; // assistant messages use ordered parts
}

const mdComponents: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    if (className === "language-chart") {
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
};

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

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

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-[10px] font-bold text-white">
        OT
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {parts.map((part, i) => {
          if (part.type === "tool_call") {
            return (
              <ToolCallDisplay
                key={part.toolCall.id}
                name={part.toolCall.name}
                args={part.toolCall.args}
                result={part.toolCall.result}
                isError={part.toolCall.isError}
                isLoading={part.toolCall.isLoading}
              />
            );
          }

          // text part — only render if non-empty
          if (!part.text.trim()) return null;
          return (
            <div key={`text-${i}`} className="assistant-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{part.text}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    </div>
  );
}
