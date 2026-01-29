"use client";

import ReactMarkdown from "react-markdown";
import ToolCallDisplay from "./ToolCallDisplay";

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

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-blue-600 px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message — render parts in order
  const parts = message.parts || [];

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-[10px] font-bold text-white">
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
              <ReactMarkdown>{part.text}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    </div>
  );
}
