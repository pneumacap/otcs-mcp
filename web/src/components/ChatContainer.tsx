"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import MessageBubble, { Message, MessagePart, ToolCall } from "./MessageBubble";
import ChatInput from "./ChatInput";

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        parts: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.content = `Error: ${err.error || "Request failed"}`;
            last.parts = [{ type: "text", text: last.content }];
            updated[updated.length - 1] = last;
            return updated;
          });
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            let event;
            try {
              event = JSON.parse(data);
            } catch {
              continue;
            }

            setMessages((prev) => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              const parts = [...(last.parts || [])];
              updated[updated.length - 1] = last;

              switch (event.type) {
                case "text_delta": {
                  // Append to the last text part, or create a new one
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === "text") {
                    parts[parts.length - 1] = {
                      ...lastPart,
                      text: lastPart.text + event.text,
                    };
                  } else {
                    parts.push({ type: "text", text: event.text });
                  }
                  // Also update flat content for API round-trips
                  last.content += event.text;
                  break;
                }

                case "tool_call_start": {
                  const tc: ToolCall = {
                    id: event.id,
                    name: event.name,
                    args: event.args,
                    isLoading: true,
                  };
                  parts.push({ type: "tool_call", toolCall: tc });
                  break;
                }

                case "tool_result": {
                  // Find and update the matching tool call part
                  for (let i = 0; i < parts.length; i++) {
                    const p = parts[i];
                    if (p.type === "tool_call" && p.toolCall.id === event.id) {
                      parts[i] = {
                        type: "tool_call",
                        toolCall: {
                          ...p.toolCall,
                          result: event.result,
                          isError: event.isError,
                          isLoading: false,
                        },
                      };
                      break;
                    }
                  }
                  break;
                }

                case "error":
                  parts.push({
                    type: "text",
                    text: `**Error:** ${event.message}`,
                  });
                  break;

                case "done":
                  break;
              }

              last.parts = parts;
              return updated;
            });
          }
        }
      } catch (err: any) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = { ...updated[updated.length - 1] };
          last.content = `Connection error: ${err.message}`;
          last.parts = [{ type: "text", text: last.content }];
          updated[updated.length - 1] = last;
          return updated;
        });
      }

      setIsStreaming(false);
    },
    [messages]
  );

  // Check if the last assistant message has any visible parts
  const lastMsg = messages[messages.length - 1];
  const lastMsgHasParts =
    lastMsg?.parts && lastMsg.parts.length > 0;

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white/80 px-5 py-3 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-[10px] font-bold text-white shadow-sm">
          OT
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
            OTCS AI Assistant
          </h1>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            OpenText Content Server
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-2xl space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
                <span className="text-sm font-bold text-white">OT</span>
              </div>
              <h2 className="mb-1.5 text-base font-semibold text-gray-900 dark:text-white">
                OTCS AI Assistant
              </h2>
              <p className="mb-7 max-w-sm text-[13px] leading-relaxed text-gray-400 dark:text-gray-500">
                Browse folders, search documents, manage workflows, and more in
                your Content Server.
              </p>
              <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  "Browse the Enterprise Workspace",
                  "Search for contracts",
                  "Show my pending workflow tasks",
                  "List workspace types",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    disabled={isStreaming}
                    className="rounded-lg border border-gray-150 px-3 py-2 text-left text-[12.5px] text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 dark:border-gray-800 dark:text-gray-500 dark:hover:border-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            // Don't render empty assistant placeholder
            if (
              msg.role === "assistant" &&
              !msg.content &&
              (!msg.parts || msg.parts.length === 0)
            ) {
              return null;
            }
            return <MessageBubble key={msg.id} message={msg} />;
          })}

          {isStreaming && messages.length > 0 && !lastMsgHasParts && (
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-[10px] font-bold text-white">
                OT
              </div>
              <div className="flex items-center gap-1 py-2">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.3s]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.15s]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
