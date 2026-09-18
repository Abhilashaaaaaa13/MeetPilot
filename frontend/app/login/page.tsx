"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";

export default function LoginPage() {
  const [name, setName] = useState("");
  const { userId, isReady, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && userId) {
      router.replace("/");
    }
  }, [isReady, userId, router]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    login(name);
    router.replace("/");
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-6 shadow-sm dark:border-white/10"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Welcome to MeetPilot</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter your name or email to continue
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Aditi or aditi@company.com"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
