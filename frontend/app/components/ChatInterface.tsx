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

  // NEW: tracks whether the next message the user sends is a reply to a
  // pending tool-call confirmation, rather than a fresh query.
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);

  const handleSend = async (text: string, file: File | null) => {
    if (!userId) return;

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
      // NEW: route to /agent/confirm instead of /agent when a confirmation
      // is pending -- this is what makes the pause/resume flow actually work.
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
        // status === "done" -- normal answer, and any pending confirmation is resolved
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

  return (
    <div className="flex h-full w-full flex-col">
      <ChatList messages={messages} isLoading={isLoading} />
      {error && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2 text-sm text-red-500">
          {error}
        </div>
      )}
      {isAwaitingConfirmation && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-1 text-xs text-amber-600">
          Waiting for your confirmation on the action above.
        </div>
      )}
      <SearchBar onSend={handleSend} disabled={isLoading} />
    </div>
  );
}