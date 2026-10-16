"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context";
import {
  disconnectService,
  getConnections,
  getConnectUrl,
  type McpConnection,
} from "../lib/api";

interface SidebarProps {
  onClose?: () => void;
}

const SERVICE_ICONS: Record<string, string> = {
  notion: "📝",
  google: "📅",
  github: "🐙",
  jira: "🎫",
  slack: "💬",
};

export default function Sidebar({ onClose }: SidebarProps) {
  const { userId, logout } = useAuth();
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingService, setPendingService] = useState<string | null>(null);

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
          setError(err instanceof Error ? err.message : "Failed to load MCP servers.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) return null;

  const connectedCount = connections.filter((conn) => conn.connected).length;

  const handleToggle = async (service: string, connected: boolean) => {
    if (!connected) {
      setPendingService(service);
      window.location.href = getConnectUrl(service, userId);
      return;
    }

    setPendingService(service);
    setError(null);
    try {
      await disconnectService(service, userId);
      setConnections((prev) =>
        prev.map((conn) => (conn.id === service ? { ...conn, connected: false } : conn))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setPendingService(null);
    }
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-black/10 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-neutral-900/60">
      <div className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Integrations</h2>
          <p className="mt-1 text-xs leading-relaxed text-black/50 dark:text-white/50">
            Turn on the tools MeetPilot can use on your behalf.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-lg leading-none hover:bg-black/5 md:hidden dark:hover:bg-white/10"
            aria-label="Close menu"
          >
            ×
          </button>
        )}
      </div>

      {!isLoading && connections.length > 0 && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-xs text-black/60 shadow-sm dark:bg-neutral-800 dark:text-white/60">
          <span className="font-semibold text-green-600 dark:text-green-400">{connectedCount}</span>
          {" of "}
          {connections.length} connected
        </div>
      )}

      {isLoading ? (
        <ul className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-11 animate-pulse rounded-xl bg-black/5 dark:bg-white/10" />
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 shadow-sm transition hover:border-black/10 dark:bg-neutral-800 dark:hover:border-white/10"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-lg">{SERVICE_ICONS[conn.id] ?? "🔌"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{conn.name}</p>
                  <p
                    className={`text-[11px] ${
                      conn.connected ? "text-green-600 dark:text-green-400" : "text-black/40 dark:text-white/40"
                    }`}
                  >
                    {pendingService === conn.id ? "Working..." : conn.connected ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={conn.connected}
                aria-label={`Toggle ${conn.name}`}
                disabled={pendingService === conn.id}
                onClick={() => handleToggle(conn.id, conn.connected)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  conn.connected ? "bg-green-500" : "bg-black/20 dark:bg-white/20"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    conn.connected ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/10 pt-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">
            M
          </div>
          <span className="text-xs text-black/60 dark:text-white/60">Signed in</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg px-2 py-1 text-xs font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}