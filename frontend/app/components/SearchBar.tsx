"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { FiArrowUp, FiFileText, FiPaperclip, FiX } from "react-icons/fi";

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
    <div className="px-4 pb-4 pt-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {file && (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
            <FiFileText className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            <span className="max-w-[220px] truncate font-medium">{file.name}</span>
            <span className="text-zinc-400">{formatSize(file.size)}</span>
            <button
              type="button"
              onClick={clearFile}
              className="rounded p-0.5 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-100"
              aria-label="Remove attachment"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div
          className={`flex items-end gap-1.5 rounded-2xl border bg-white p-2 shadow-sm transition focus-within:ring-4 dark:bg-zinc-900 ${
            awaitingConfirmation
              ? "border-amber-400 focus-within:ring-amber-400/20"
              : "border-zinc-300 focus-within:border-indigo-500 focus-within:ring-indigo-500/15 dark:border-white/15"
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || awaitingConfirmation}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            aria-label="Attach a document"
            title={awaitingConfirmation ? "Answer the confirmation first" : "Attach a transcript"}
          >
            <FiPaperclip className="h-[18px] w-[18px]" aria-hidden="true" />
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
                ? "Approve, reject, or ask for a change…"
                : "Paste a transcript, attach a file, or type a command…"
            }
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-white/10 dark:disabled:text-zinc-500"
            aria-label={awaitingConfirmation ? "Send reply" : "Send message"}
          >
            <FiArrowUp className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <p className="px-1 text-[11px] text-zinc-400">Enter to send, Shift+Enter for a new line</p>
      </div>
    </div>
  );
}