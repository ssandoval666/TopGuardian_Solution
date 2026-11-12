import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { User } from "@/types";
import { apiService, SESSION_TIMEOUT_MS } from "@/services/api";
import { io, Socket } from "socket.io-client";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (ruc: string, documentNumber: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityRef = useRef<number>(Date.now());
  const socketRef = useRef<Socket | null>(null);

  const logout = useCallback(() => {
    const logoutRequest = apiService.logout();
    setUser(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    logoutRequest.catch((error) => console.error("[Auth] No se pudo cerrar la sesión en el servidor:", error));
  }, []);

  const resetSessionTimeout = useCallback(() => {
    activityRef.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(logout, SESSION_TIMEOUT_MS);
  }, [logout]);

  const login = useCallback(async (ruc: string, documentNumber: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const sessionUser = await apiService.login(ruc, documentNumber);
      setUser(sessionUser);
      resetSessionTimeout();
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [resetSessionTimeout]);

  useEffect(() => {
    localStorage.removeItem("tg_user");
    apiService.getSession()
      .then(setUser)
      .catch((error) => {
        if (!(error instanceof Error && error.message.includes("(401)"))) {
          console.error("[Auth] No se pudo restaurar la sesión:", error);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    resetSessionTimeout();

    const handleActivity = () => resetSessionTimeout();
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, handleActivity));
    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, resetSessionTimeout]);

  useEffect(() => {
    if (user) {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
      socketRef.current = io(apiUrl, { withCredentials: true, auth: { session: "training" } });
      socketRef.current.on("connect", () => socketRef.current?.emit("join_training"));
    } else if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    return () => {
      socketRef.current?.disconnect();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
