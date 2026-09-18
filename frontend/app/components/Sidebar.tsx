"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context";
import {
  disconnectService,
  getConnections,
  getConnectUrl,
  type McpConnection,
} from "../lib/api";

export default function Sidebar() {
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

  const handleToggle = async (service: string, connected: boolean) => {
    if (!connected) {
      // Turning on requires the OAuth consent screen -- full navigation, not fetch.
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
    <aside className="flex w-72 shrink-0 flex-col border-r border-black/10 p-4 dark:border-white/10">
      <div className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          MCP Servers
        </h2>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          Turn on the tools MeetPilot can use on your behalf.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-black/40 dark:text-white/40">Loading...</p>
      ) : (
        <ul className="space-y-1">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span className="text-sm">{conn.name}</span>
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
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    conn.connected ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-auto border-t border-black/10 pt-4 dark:border-white/10">
        <p className="truncate text-xs text-black/40 dark:text-white/40">{userId}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-2 text-xs font-medium text-black/60 hover:underline dark:text-white/60"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
