"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

interface SearchBarProps {
  onSend: (text: string, file: File | null) => void;
  disabled?: boolean;
}

export default function SearchBar({ onSend, disabled }: SearchBarProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmedText = text.trim();
    if (!trimmedText && !file) return;
    if (disabled) return;

    onSend(trimmedText, file);
    setText("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {file && (
          <div className="flex w-fit items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            <span>📎 {file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="font-bold text-gray-400 hover:text-gray-600"
              aria-label="Remove attachment"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-gray-300 px-3 py-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Attach a document"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a message..."
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-gray-400"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !file)}
            className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
