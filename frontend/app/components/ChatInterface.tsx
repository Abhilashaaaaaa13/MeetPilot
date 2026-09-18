"use client";

import { useState } from "react";
import { sendChatMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { ChatMessage } from "../types/chat";
import ChatList from "./ChatList";
import SearchBar from "./SearchBar";

export default function ChatInterface() {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
