"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type User = { id: string; name: string; email: string };

type AuthContextType = {
  user: User | null;
  login: (email: string, name?: string) => void;
  register: (name: string, email: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("lawtest_user");
    if (raw) try { setUser(JSON.parse(raw)); } catch {}
  }, []);

  const login = (email: string, name?: string) => {
    // simple: if users list exists, find or create
    const usersRaw = localStorage.getItem("lawtest_users");
    const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
    let found = users.find((u) => u.email === email);
    if (!found) {
      found = { id: Date.now().toString(), name: name || email.split("@")[0], email };
      users.push(found);
      localStorage.setItem("lawtest_users", JSON.stringify(users));
    }
    localStorage.setItem("lawtest_user", JSON.stringify(found));
    setUser(found);
  };

  const register = (name: string, email: string) => login(email, name);

  const logout = () => {
    localStorage.removeItem("lawtest_user");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
