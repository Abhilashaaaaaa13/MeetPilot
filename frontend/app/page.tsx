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

  // Wait for Firebase to finish checking before redirecting,
  // warna refresh pe logged-in user bhi /login pe chala jayega.
  useEffect(() => {
    if (isReady && !userId) {
      router.replace("/login");
    }
  }, [isReady, userId, router]);

  // Backend OAuth callback redirects to /?connected=<service> or
  // /?connection_error=<service>. Show a toast, then clean the URL.
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

  if (!isReady || !userId) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-sm text-black/60 dark:text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full w-72 max-w-[85%] bg-white shadow-xl dark:bg-neutral-950">
            <Sidebar />
          </div>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-lg leading-none hover:bg-black/5 md:hidden dark:hover:bg-white/10"
            aria-label="Open integrations menu"
          >
            ☰
          </button>
          <h1 className="text-base font-semibold tracking-tight">MeetPilot</h1>
        </header>

        {notice && (
          <div
            role="status"
            className={`absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
              notice.kind === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
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