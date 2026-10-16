"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./lib/auth-context";
import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";

type Notice = { kind: "success" | "error"; text: string };

function prettyService(id: string): string {
  const names: Record<string, string> = {
    google: "Google (Gmail & Calendar)",
    github: "GitHub",
    jira: "Jira",
    slack: "Slack",
    notion: "Notion",
  };
  return names[id] ?? id;
}

export default function HomePage() {
  const { userId, isReady } = useAuth();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (isReady && !userId) {
      router.replace("/login");
    }
  }, [isReady, userId, router]);

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

  if (!isReady || !userId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-3 text-sm text-black/60 dark:text-white/60">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
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
        <header className="flex items-center gap-3 border-b border-black/10 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-neutral-950/80">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-lg leading-none hover:bg-black/5 md:hidden dark:hover:bg-white/10"
            aria-label="Open integrations menu"
          >
            ☰
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">
            M
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight tracking-tight">MeetPilot</h1>
            <p className="truncate text-[11px] leading-tight text-black/50 dark:text-white/50">
              Meeting follow-ups, on autopilot
            </p>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className={`absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
              notice.kind === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
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