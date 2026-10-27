"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiCheckCircle, FiMenu, FiPlus } from "react-icons/fi";
import { useAuth } from "./lib/auth-context";
import { ChatProvider, useChats } from "./lib/ChatStore";
import { getServiceMeta } from "./lib/ServiceIcon";
import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";

type Notice = { kind: "success" | "error"; text: string };

function prettyService(id: string): string {
  return getServiceMeta(id).label;
}

function Shell() {
  const { active, newChat } = useChats();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Read the ?connected= / ?connection_error= result the OAuth callback redirects back with
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const failed = params.get("connection_error");

    if (connected) {
      setNotice({ kind: "success", text: `${prettyService(connected)} connected.` });
    } else if (failed) {
      setNotice({
        kind: "error",
        text: `Couldn't connect ${prettyService(failed)}. Please try again.`,
      });
    }

    if (connected || failed) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const hasMessages = (active?.messages.length ?? 0) > 0;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full w-72 max-w-[85%] shadow-xl">
            <Sidebar onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-zinc-200 bg-white/80 px-3 py-2.5 backdrop-blur md:px-5 dark:border-white/10 dark:bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="Open menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold leading-tight tracking-tight">
              {hasMessages && active ? active.title : "New chat"}
            </h1>
            <p className="truncate text-xs leading-tight text-zinc-500 dark:text-zinc-400">
              Meeting follow-ups, on autopilot
            </p>
          </div>

          <button
            type="button"
            onClick={newChat}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="New chat"
          >
            <FiPlus className="h-5 w-5" />
          </button>
        </header>

        {notice && (
          <div
            role="status"
            className={`absolute left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
              notice.kind === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {notice.kind === "success" ? (
              <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <FiAlertCircle className="h-4 w-4" aria-hidden="true" />
            )}
            {notice.text}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  const { userId, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !userId) {
      router.replace("/login");
    }
  }, [isReady, userId, router]);

  if (!isReady || !userId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <ChatProvider userId={userId}>
      <Shell />
    </ChatProvider>
  );
}