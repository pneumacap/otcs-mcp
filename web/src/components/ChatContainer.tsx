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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-[10px] font-bold text-white shadow-sm">
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
            <div className="flex flex-col items-center pt-8 pb-4">
              {/* Logo + Greeting */}
              <div className="home-stagger home-stagger-1 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1a6aff] to-[#00008b] shadow-lg shadow-[#1a6aff]/25">
                <span className="text-base font-bold text-white">OT</span>
              </div>
              <h2 className="home-stagger home-stagger-1 mb-1 text-xl font-semibold text-gray-900 dark:text-white">
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return "Good morning";
                  if (h < 17) return "Good afternoon";
                  return "Good evening";
                })()}
              </h2>
              <p className="home-stagger home-stagger-2 mb-1 max-w-md text-center text-sm leading-relaxed text-gray-400 dark:text-gray-500">
                What can I help you with in Content Server?
              </p>
              <p className="home-stagger home-stagger-2 mb-9 text-[11px] text-gray-300 dark:text-gray-600">
                Powered by Claude Opus 4.5
              </p>

              {/* Feature cards — 2x2 */}
              <div className="home-stagger home-stagger-3 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Search card */}
                <button
                  onClick={() => handleSend("Search for contracts")}
                  disabled={isStreaming}
                  className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-white to-blue-50/40 p-4 text-left transition-all hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50 disabled:opacity-50 dark:border-gray-800 dark:from-gray-900 dark:to-blue-950/20 dark:hover:border-blue-800 dark:hover:shadow-blue-900/20"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1a6aff] transition-colors group-hover:bg-[#1a6aff] group-hover:text-white dark:bg-blue-950 dark:text-blue-400 dark:group-hover:bg-[#1a6aff] dark:group-hover:text-white">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <div className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Search documents</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">Find contracts, proposals, and more across your repository</div>
                </button>

                {/* Workflows card */}
                <button
                  onClick={() => handleSend("Show my pending workflow tasks")}
                  disabled={isStreaming}
                  className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-white to-amber-50/40 p-4 text-left transition-all hover:border-amber-200 hover:shadow-md hover:shadow-amber-100/50 disabled:opacity-50 dark:border-gray-800 dark:from-gray-900 dark:to-amber-950/20 dark:hover:border-amber-800 dark:hover:shadow-amber-900/20"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-950 dark:text-amber-400 dark:group-hover:bg-amber-500 dark:group-hover:text-white">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </div>
                  <div className="text-[13px] font-medium text-gray-800 dark:text-gray-200">My workflow tasks</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">See pending approvals and assigned workflow items</div>
                </button>

                {/* Browse card */}
                <button
                  onClick={() => handleSend("Browse the Enterprise Workspace")}
                  disabled={isStreaming}
                  className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-white to-emerald-50/40 p-4 text-left transition-all hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-100/50 disabled:opacity-50 dark:border-gray-800 dark:from-gray-900 dark:to-emerald-950/20 dark:hover:border-emerald-800 dark:hover:shadow-emerald-900/20"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-400 dark:group-hover:bg-emerald-600 dark:group-hover:text-white">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                  <div className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Browse folders</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">Explore the Enterprise Workspace and folder hierarchy</div>
                </button>

                {/* Workspaces card */}
                <button
                  onClick={() => handleSend("Search for workspaces")}
                  disabled={isStreaming}
                  className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-white to-violet-50/40 p-4 text-left transition-all hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/50 disabled:opacity-50 dark:border-gray-800 dark:from-gray-900 dark:to-violet-950/20 dark:hover:border-violet-800 dark:hover:shadow-violet-900/20"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 transition-colors group-hover:bg-violet-600 group-hover:text-white dark:bg-violet-950 dark:text-violet-400 dark:group-hover:bg-violet-600 dark:group-hover:text-white">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <div className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Workspaces</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">Find and explore business workspaces</div>
                </button>
              </div>

              {/* Quick action chips */}
              <div className="home-stagger home-stagger-5 mt-5 flex flex-wrap justify-center gap-2">
                {[
                  "List workspace types",
                  "List active workflows",
                  "Check my session status",
                  "Search for proposals",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    disabled={isStreaming}
                    className="rounded-full border border-gray-150 px-3.5 py-1.5 text-[11.5px] text-gray-400 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50 dark:border-gray-800 dark:text-gray-500 dark:hover:border-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-300"
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
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-[10px] font-bold text-white">
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
