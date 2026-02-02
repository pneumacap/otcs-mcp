"use client";

import { useState, useRef, useCallback } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about your Content Server..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400/30 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:border-blue-500 dark:focus:bg-gray-800"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a6aff] text-white shadow-sm transition-all hover:bg-[#0052d4] hover:shadow disabled:opacity-30 disabled:shadow-none disabled:hover:bg-[#1a6aff]"
          aria-label="Send message"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
