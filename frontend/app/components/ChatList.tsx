"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types/chat";
import ChatMessage from "./ChatMessage";

interface ChatListProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onReply?: (text: string) => void;
  awaitingConfirmation?: boolean;
}

const EXAMPLES = [
  {
    icon: "📄",
    title: "Summarize a meeting",
    text: "Attach a transcript to get a summary and proposed follow-up actions.",
  },
  {
    icon: "📅",
    title: "Schedule something",
    text: "Try: \"Set a meeting tomorrow at 8pm with riya@example.com\".",
  },
  {
    icon: "✉️",
    title: "Send a follow-up",
    text: "Try: \"Send this summary to the team on Slack\".",
  },
];

export default function ChatList({
  messages,
  isLoading,
  onReply,
  awaitingConfirmation = false,
}: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg">
            M
          </div>
          <h2 className="text-xl font-semibold tracking-tight">How can I help after your meeting?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Upload a transcript or type a command. I propose the actions, you approve them.
          </p>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            {EXAMPLES.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
              >
                <div className="mb-2 text-lg">{item.icon}</div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            onReply={onReply}
            busy={isLoading}
            awaitingConfirmation={awaitingConfirmation}
            isLatest={index === messages.length - 1}
          />
        ))}

        {isLoading && (
          <div className="flex w-full items-start gap-2">
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">
              M
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3 dark:bg-neutral-800">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}