"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const USER_ID_STORAGE_KEY = "meetpilot_user_id";

interface AuthContextValue {
  userId: string | null;
  isReady: boolean;
  login: (id: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setUserId(window.localStorage.getItem(USER_ID_STORAGE_KEY));
    setIsReady(true);
  }, []);

  const login = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    window.localStorage.setItem(USER_ID_STORAGE_KEY, trimmed);
    setUserId(trimmed);
  };

  const logout = () => {
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ userId, isReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
