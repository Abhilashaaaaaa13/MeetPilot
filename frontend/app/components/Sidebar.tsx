"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiLink2,
  FiLogOut,
  FiMessageSquare,
  FiPlus,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../lib/auth-context";
import {
  disconnectService,
  getConnections,
  getConnectUrl,
  type McpConnection,
} from "../lib/api";
import { useChats, type ChatSession } from "../lib/ChatStore";
import { ServiceChip, ServiceGlyph } from "../lib/ServiceIcon";
import BrandMark from "./BrandMark";

interface SidebarProps {
  onClose?: () => void;
}

const DAY = 86_400_000;

function groupByDate(chats: ChatSession[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const groups = [
    { label: "Today", items: [] as ChatSession[] },
    { label: "Yesterday", items: [] as ChatSession[] },
    { label: "Previous 7 days", items: [] as ChatSession[] },
    { label: "Older", items: [] as ChatSession[] },
  ];

  for (const chat of chats) {
    if (chat.updatedAt >= today) groups[0].items.push(chat);
    else if (chat.updatedAt >= today - DAY) groups[1].items.push(chat);
    else if (chat.updatedAt >= today - 7 * DAY) groups[2].items.push(chat);
    else groups[3].items.push(chat);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { userId, logout } = useAuth();
  const { chats, active, newChat, selectChat, deleteChat } = useChats();

  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingService, setPendingService] = useState<string | null>(null);
  const [connectorsOpen, setConnectorsOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    setIsLoading(true);
    getConnections(userId)
      .then((data) => {
        if (!cancelled) setConnections(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load your connectors.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const groups = useMemo(() => groupByDate(chats), [chats]);

  if (!userId) return null;

  const connected = connections.filter((conn) => conn.connected);

  const handleToggle = async (service: string, isConnected: boolean) => {
    setError(null);
    setPendingService(service);

    if (!isConnected) {
      window.location.href = getConnectUrl(service, userId);
      return;
    }

    try {
      await disconnectService(service, userId);
      setConnections((prev) =>
        prev.map((conn) => (conn.id === service ? { ...conn, connected: false } : conn))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect. Try again.");
    } finally {
      setPendingService(null);
    }
  };

  const handleNewChat = () => {
    newChat();
    onClose?.();
  };

  const handleSelect = (id: string) => {
    selectChat(id);
    onClose?.();
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">MeetPilot</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200/70 md:hidden dark:text-zinc-400 dark:hover:bg-white/10"
            aria-label="Close menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* New chat */}
      <div className="px-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <FiPlus className="h-4 w-4" aria-hidden="true" />
          New chat
        </button>
      </div>

      {/* Connectors dropdown */}
      <div className="mt-4 px-3">
        <button
          type="button"
          aria-expanded={connectorsOpen}
          aria-controls="connectors-panel"
          onClick={() => setConnectorsOpen((open) => !open)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition hover:bg-zinc-200/60 dark:hover:bg-white/5"
        >
          <FiLink2 className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
          <span className="flex-1">Connectors</span>

          {!isLoading && connected.length > 0 && (
            <span className="flex items-center" aria-hidden="true">
              {connected.slice(0, 4).map((conn, i) => (
                <span
                  key={conn.id}
                  className={`grid h-6 w-6 place-items-center rounded-full bg-white ring-2 ring-zinc-50 dark:bg-zinc-800 dark:ring-zinc-900 ${
                    i > 0 ? "-ml-2" : ""
                  }`}
                >
                  <ServiceGlyph id={conn.id} className="h-3 w-3" />
                </span>
              ))}
            </span>
          )}

          {!isLoading && connections.length > 0 && (
            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {connected.length}/{connections.length}
            </span>
          )}
          <FiChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${
              connectorsOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        <div
          id="connectors-panel"
          inert={!connectorsOpen}
          className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
            connectorsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            {isLoading ? (
              <ul className="space-y-1.5 pt-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="h-12 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-white/5" />
                ))}
              </ul>
            ) : (
              <ul className="space-y-1 pb-1 pt-1.5">
                {connections.map((conn) => {
                  const pending = pendingService === conn.id;
                  return (
                    <li
                      key={conn.id}
                      className="flex items-center gap-3 rounded-xl bg-white px-2.5 py-2 ring-1 ring-zinc-200/80 dark:bg-zinc-800/60 dark:ring-white/10"
                    >
                      <ServiceChip id={conn.id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-tight">{conn.name}</p>
                        <p
                          className={`mt-0.5 text-[11px] leading-tight ${
                            conn.connected
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {pending ? "Working…" : conn.connected ? "Connected" : "Not connected"}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={conn.connected}
                        aria-label={`${conn.connected ? "Disconnect" : "Connect"} ${conn.name}`}
                        disabled={pending}
                        onClick={() => handleToggle(conn.id, conn.connected)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 ${
                          conn.connected ? "bg-emerald-500" : "bg-zinc-300 dark:bg-white/20"
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                            conn.connected ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {error && (
              <p className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chat history */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <p className="px-5 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Chat history</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {groups.length === 0 ? (
            <p className="px-2.5 py-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Chats you start will be saved here.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <p className="px-2.5 pb-1 pt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((chat) => {
                    const isActive = chat.id === active?.id;
                    return (
                      <li key={chat.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => handleSelect(chat.id)}
                          aria-current={isActive ? "true" : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 pr-9 text-left text-[13px] transition ${
                            isActive
                              ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-white/10 dark:text-white dark:ring-white/10"
                              : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-white/5"
                          }`}
                        >
                          <FiMessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                          <span className="truncate">{chat.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChat(chat.id)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label={`Delete chat: ${chat.title}`}
                        >
                          <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
            <FiUser className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-300">Signed in</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-white/10"
        >
          <FiLogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}