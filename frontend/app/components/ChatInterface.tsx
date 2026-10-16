"use client";

import { useState } from "react";
import { sendChatMessage, sendConfirmation, type AgentResponse } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { ChatMessage } from "../types/chat";
import ChatList from "./ChatList";
import SearchBar from "./SearchBar";

export default function ChatInterface() {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);

  const handleSend = async (text: string, file: File | null) => {
    if (!userId || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: text || (file ? `Sent a file: ${file.name}` : ""),
      attachment: file
        ? { name: file.name, size: file.size, type: file.type }
        : undefined,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setError(null);
    setIsLoading(true);

    try {
      const agentResponse: AgentResponse = isAwaitingConfirmation
        ? await sendConfirmation({ userId, reply: text })
        : await sendChatMessage({ text, userId, file });

      if (agentResponse.status === "awaiting_confirmation") {
        setIsAwaitingConfirmation(true);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: agentResponse.message,
            isConfirmationPrompt: true,
            createdAt: Date.now(),
          },
        ]);
      } else {
        setIsAwaitingConfirmation(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: agentResponse.response || "No response received.",
            createdAt: Date.now(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = (text: string) => {
    void handleSend(text, null);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <ChatList
        messages={messages}
        isLoading={isLoading}
        onReply={handleReply}
        awaitingConfirmation={isAwaitingConfirmation}
      />

      {error && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-base leading-none opacity-60 hover:opacity-100"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {isAwaitingConfirmation && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Waiting for your confirmation on the action above.
          </div>
        </div>
      )}

      <SearchBar
        onSend={handleSend}
        disabled={isLoading}
        awaitingConfirmation={isAwaitingConfirmation}
      />
    </div>
  );
}