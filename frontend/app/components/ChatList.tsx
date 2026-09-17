"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types/chat";
import ChatMessage from "./ChatMessage";

interface ChatListProps {
  messages: ChatMessageType[];
  isLoading: boolean;
}

export default function ChatList({ messages, isLoading }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        Start a conversation by typing a message or attaching a document.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-500">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
