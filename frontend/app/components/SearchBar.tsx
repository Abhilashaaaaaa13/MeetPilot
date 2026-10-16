"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

interface SearchBarProps {
  onSend: (text: string, file: File | null) => void;
  disabled?: boolean;
  awaitingConfirmation?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SearchBar({ onSend, disabled, awaitingConfirmation = false }: SearchBarProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSend = !disabled && (text.trim().length > 0 || (!!file && !awaitingConfirmation));

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim(), awaitingConfirmation ? null : file);
    setText("");
    clearFile();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  return (
    <div className="border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-neutral-950/90">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {file && (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-300">
            <span>📎</span>
            <span className="max-w-[200px] truncate font-medium">{file.name}</span>
            <span className="text-gray-400">{formatSize(file.size)}</span>
            <button
              type="button"
              onClick={clearFile}
              className="ml-1 text-base leading-none text-gray-400 hover:text-gray-700 dark:hover:text-gray-100"
              aria-label="Remove attachment"
            >
              ×
            </button>
          </div>
        )}

        <div
          className={`flex items-end gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm transition focus-within:ring-2 dark:bg-neutral-900 ${
            awaitingConfirmation
              ? "border-amber-400 focus-within:ring-amber-300/50"
              : "border-gray-300 focus-within:ring-blue-500/30 dark:border-white/15"
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || awaitingConfirmation}
            className="shrink-0 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
            aria-label="Attach a document"
            title={awaitingConfirmation ? "Answer the confirmation first" : "Attach a transcript"}
          >
            📎
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              awaitingConfirmation
                ? "Reply: approve, reject, or ask for a change..."
                : "Paste a transcript, attach a file, or type a command..."
            }
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-gray-400"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {awaitingConfirmation ? "Reply" : "Send"}
          </button>
        </div>

        <p className="px-1 text-[11px] text-gray-400">
          Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}