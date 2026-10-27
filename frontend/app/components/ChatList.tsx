"use client";

import { useEffect, useRef } from "react";
import { FiCalendar, FiFileText, FiSend } from "react-icons/fi";
import type { IconType } from "react-icons";
import type { ChatMessage as ChatMessageType } from "../types/chat";
import type { BatchHandler } from "../lib/Action";
import BrandMark from "./BrandMark";
import ChatMessage from "./ChatMessage";

interface ChatListProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onReply?: (text: string) => void;
  onBatch?: BatchHandler;
  statusText?: string | null;
  awaitingConfirmation?: boolean;
}

const EXAMPLES: { icon: IconType; title: string; text: string }[] = [
  {
    icon: FiFileText,
    title: "Summarize a meeting",
    text: "Attach a transcript to get a summary and proposed follow-up actions.",
  },
  {
    icon: FiCalendar,
    title: "Schedule something",
    text: "Try: \"Set a meeting tomorrow at 8pm with riya@example.com\".",
  },
  {
    icon: FiSend,
    title: "Send a follow-up",
    text: "Try: \"Send this summary to the team on Slack\".",
  },
];

export default function ChatList({
  messages,
  isLoading,
  onReply,
  onBatch,
  statusText,
  awaitingConfirmation = false,
}: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-full max-w-2xl">
          <BrandMark className="h-12 w-12 rounded-2xl" iconClassName="h-6 w-6" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            What should we follow up on?
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Upload a transcript or type a command. MeetPilot proposes the actions, and nothing runs until you approve it.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {EXAMPLES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            onReply={onReply}
            onBatch={onBatch}
            busy={isLoading}
            awaitingConfirmation={awaitingConfirmation}
            isLatest={index === messages.length - 1}
          />
        ))}

        {isLoading && (
          <div className="flex w-full items-center gap-3" role="status" aria-label="MeetPilot is working">
            <BrandMark
              className="h-7 w-7 animate-pulse rounded-lg motion-reduce:animate-none"
              iconClassName="h-3.5 w-3.5"
            />
            <span className="flex items-center gap-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {statusText ?? "Working"}
              <span className="flex items-center gap-1" aria-hidden="true">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1 w-1 animate-bounce rounded-full bg-indigo-500 motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}