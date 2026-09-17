"use client";

import { useState } from "react";
import { sendChatMessage } from "../lib/api";
import type { ChatMessage } from "../types/chat";
import ChatList from "./ChatList";
import SearchBar from "./SearchBar";

const USER_ID_STORAGE_KEY = "meetpilot_user_id";

function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "guest";

  const existingId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existingId) return existingId;

  const newId = crypto.randomUUID();
  window.localStorage.setItem(USER_ID_STORAGE_KEY, newId);
  return newId;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (text: string, file: File | null) => {
    const userId = getOrCreateUserId();

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
      const agentResponse = await sendChatMessage({ text, userId, file });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: agentResponse.response || "No response received.",
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
      <SearchBar onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
