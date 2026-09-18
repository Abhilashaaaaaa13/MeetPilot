"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./lib/auth-context";
import ChatInterface from "./components/ChatInterface";
import Sidebar from "./components/Sidebar";

export default function Home() {
  const { userId, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !userId) {
      router.replace("/login");
    }
  }, [isReady, userId, router]);

  if (!isReady || !userId) return null;

  return (
    <main className="flex flex-1">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ChatInterface />
      </div>
    </main>
  );
}
