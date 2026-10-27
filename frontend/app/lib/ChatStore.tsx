"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ChatMessage } from "../types/chat";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  awaitingConfirmation: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ChatStore {
  /** Saved chats (only ones that have messages), newest first. */
  chats: ChatSession[];
  /** The chat currently open. null only for the first render, before storage loads. */
  active: ChatSession | null;
  newChat: () => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  appendMessage: (chatId: string, message: ChatMessage) => void;
  setAwaitingConfirmation: (chatId: string, value: boolean) => void;
}

const STORAGE_PREFIX = "meetpilot:chats:";
const MAX_CHATS = 50;

function makeChat(): ChatSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    awaitingConfirmation: false,
    createdAt: now,
    updatedAt: now,
  };
}

function deriveTitle(message: ChatMessage): string {
  const base = (message.text || message.attachment?.name || "").replace(/\s+/g, " ").trim();
  if (!base) return "New chat";
  return base.length > 42 ? `${base.slice(0, 42)}…` : base;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load saved chats once, then open a fresh empty chat (like most chat apps do).
  useEffect(() => {
    let stored: ChatSession[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw) as ChatSession[];
    } catch {
      stored = [];
    }
    const fresh = makeChat();
    setSessions([fresh, ...stored]);
    setActiveId(fresh.id);
    setLoaded(true);
  }, [storageKey]);

  // Persist chats that actually have messages.
  useEffect(() => {
    if (!loaded) return;
    try {
      const toSave = sessions.filter((s) => s.messages.length > 0).slice(0, MAX_CHATS);
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch {
      // storage full or unavailable: history just won't persist
    }
  }, [sessions, loaded, storageKey]);

  const newChat = useCallback(() => {
    const current = sessions.find((s) => s.id === activeId);
    if (current && current.messages.length === 0) return; // already on an empty chat
    const fresh = makeChat();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  }, [sessions, activeId]);

  const selectChat = useCallback((id: string) => {
    // drop leftover empty chats when moving away from them
    setSessions((prev) => prev.filter((s) => s.id === id || s.messages.length > 0));
    setActiveId(id);
  }, []);

  const deleteChat = useCallback(
    (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id);
      if (id !== activeId) {
        setSessions(remaining);
        return;
      }
      const emptyChat = remaining.find((s) => s.messages.length === 0);
      if (emptyChat) {
        setSessions(remaining);
        setActiveId(emptyChat.id);
      } else {
        const fresh = makeChat();
        setSessions([fresh, ...remaining]);
        setActiveId(fresh.id);
      }
    },
    [sessions, activeId]
  );

  const appendMessage = useCallback((chatId: string, message: ChatMessage) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== chatId) return s;
        const isFirstUserMessage = s.messages.length === 0 && message.role === "user";
        return {
          ...s,
          title: isFirstUserMessage ? deriveTitle(message) : s.title,
          messages: [...s.messages, message],
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const setAwaitingConfirmation = useCallback((chatId: string, value: boolean) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === chatId ? { ...s, awaitingConfirmation: value } : s))
    );
  }, []);

  const value = useMemo<ChatStore>(() => {
    const chats = sessions
      .filter((s) => s.messages.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const active = sessions.find((s) => s.id === activeId) ?? null;
    return { chats, active, newChat, selectChat, deleteChat, appendMessage, setAwaitingConfirmation };
  }, [sessions, activeId, newChat, selectChat, deleteChat, appendMessage, setAwaitingConfirmation]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChats(): ChatStore {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChats must be used inside <ChatProvider>");
  return ctx;
}