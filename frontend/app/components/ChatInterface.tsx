"use client";

import { useEffect, useState } from "react";
import { FiAlertCircle, FiAlertTriangle, FiX } from "react-icons/fi";
import { sendChatMessage, sendConfirmation, type AgentResponse } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { BatchAction, BatchHandler } from "../lib/Action";
import { useChats } from "../lib/ChatStore";
import type { ChatMessage } from "../types/chat";
import ChatList from "./ChatList";
import SearchBar from "./SearchBar";

export default function ChatInterface() {
  const { userId } = useAuth();
  const { active, appendMessage, setAwaitingConfirmation } = useChats();

  // Which chat has a request in flight (a chat can be switched away from while waiting)
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [error, setError] = useState<{ chatId: string; text: string } | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  const activeId = active?.id ?? null;
  const messages = active?.messages ?? [];
  const isAwaitingConfirmation = active?.awaitingConfirmation ?? false;
  const isLoading = loadingChatId !== null && loadingChatId === activeId;
  const isBusy = loadingChatId !== null;
  const visibleError = error && error.chatId === activeId ? error.text : null;

  useEffect(() => {
    setError(null);
  }, [activeId]);

  const handleSend = async (text: string, file: File | null) => {
    if (!userId || !active || isBusy) return;

    const chatId = active.id;
    const awaiting = active.awaitingConfirmation;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: text || (file ? `Sent a file: ${file.name}` : ""),
      attachment: file ? { name: file.name, size: file.size, type: file.type } : undefined,
      createdAt: Date.now(),
    };

    appendMessage(chatId, userMessage);
    setError(null);
    setLoadingChatId(chatId);

    try {
      const agentResponse: AgentResponse = awaiting
        ? await sendConfirmation({ userId, reply: text })
        : await sendChatMessage({ text, userId, file });

      if (agentResponse.status === "awaiting_confirmation") {
        setAwaitingConfirmation(chatId, true);
        appendMessage(chatId, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: agentResponse.message,
          isConfirmationPrompt: true,
          createdAt: Date.now(),
        });
      } else {
        setAwaitingConfirmation(chatId, false);
        appendMessage(chatId, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: agentResponse.response || "No response received.",
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      setError({
        chatId,
        text: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setLoadingChatId(null);
    }
  };

  const handleReply = (text: string) => {
    void handleSend(text, null);
  };

  /**
   * Runs approved actions one after another, using the same single-approve message
   * the cards send. The chat gets one short message in, one summary out, instead of
   * a back-and-forth for every action.
   */
  const handleBatch: BatchHandler = async (actions: BatchAction[]) => {
    const results: boolean[] = actions.map(() => false);
    if (!userId || !active || isBusy) return results;

    const chatId = active.id;
    appendMessage(chatId, {
      id: crypto.randomUUID(),
      role: "user",
      text: `Approve ${actions.length} ${actions.length === 1 ? "action" : "actions"}`,
      createdAt: Date.now(),
    });
    setError(null);
    setLoadingChatId(chatId);

    const failures: string[] = [];
    let confirmation: string | null = null;
    let stoppedAt: number | null = null;

    try {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        setBatchStatus(`Running ${i + 1} of ${actions.length}`);
        try {
          const res = await sendChatMessage({
            text: `Approve and execute: ${JSON.stringify({
              service: action.service,
              action: action.action,
              args: action.args,
            })}`,
            userId,
            file: null,
          });
          if (res.status === "awaiting_confirmation") {
            confirmation = res.message;
            stoppedAt = i;
            break;
          }
          results[i] = true;
        } catch (err) {
          const name = action.title ?? action.action ?? "Action";
          failures.push(`${name}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    } finally {
      setLoadingChatId(null);
      setBatchStatus(null);
    }

    const done = results.filter(Boolean).length;
    const lines = [`**${done} of ${actions.length} actions completed.**`];
    if (stoppedAt !== null) {
      const notRun = actions.length - stoppedAt - 1;
      lines.push(
        `One action needs your confirmation below${notRun > 0 ? `, and ${notRun} haven't run yet` : ""}. Answer it, then approve the rest again.`
      );
    }
    if (failures.length > 0) {
      lines.push("", "Didn't finish:", ...failures.map((f) => `- ${f}`));
    }
    appendMessage(chatId, {
      id: crypto.randomUUID(),
      role: "assistant",
      text: lines.join("\n"),
      createdAt: Date.now(),
    });

    if (confirmation !== null) {
      setAwaitingConfirmation(chatId, true);
      appendMessage(chatId, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: confirmation,
        isConfirmationPrompt: true,
        createdAt: Date.now(),
      });
    }

    return results;
  };

  return (
    <div className="flex h-full w-full flex-col">
      <ChatList
        messages={messages}
        isLoading={isLoading}
        onReply={handleReply}
        onBatch={handleBatch}
        statusText={batchStatus}
        awaitingConfirmation={isAwaitingConfirmation}
      />

      {visibleError && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{visibleError}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded p-0.5 opacity-60 transition hover:opacity-100"
              aria-label="Dismiss error"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isAwaitingConfirmation && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Waiting for you to approve, reject, or change the action above.
          </div>
        </div>
      )}

      <SearchBar
        onSend={handleSend}
        disabled={isBusy}
        awaitingConfirmation={isAwaitingConfirmation}
      />
    </div>
  );
}