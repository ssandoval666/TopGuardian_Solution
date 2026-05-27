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
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("tg_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityRef = useRef<number>(Date.now());
  const socketRef = useRef<Socket | null>(null);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("tg_user");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
  }, []);

  const resetSessionTimeout = useCallback(() => {
    activityRef.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT_MS);
  }, [logout]);

  const startTokenRefresh = useCallback((currentUser: User) => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    // Refresh token every 50 minutes (before 1h expiry)
    refreshIntervalRef.current = setInterval(async () => {
      const result = await apiService.refreshToken(currentUser.refreshToken);
      if (result) {
        setUser((prev) => {
          if (!prev) return null;
          const updated = { ...prev, token: result.token, refreshToken: result.refreshToken };
          localStorage.setItem("tg_user", JSON.stringify(updated));
          return updated;
        });
      } else {
        logout();
      }
    }, 50 * 60 * 1000);
  }, [logout]);

  const login = useCallback(async (ruc: string, documentNumber: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const result = await apiService.login(ruc, documentNumber);
      if (result) {
        setUser(result);
        localStorage.setItem("tg_user", JSON.stringify(result));
        resetSessionTimeout();
        startTokenRefresh(result);
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [resetSessionTimeout, startTokenRefresh]);

  // Activity listeners for session timeout reset
  useEffect(() => {
    if (!user) return;
    resetSessionTimeout();
    startTokenRefresh(user);

    const handleActivity = () => resetSessionTimeout();
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handleActivity));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [user, resetSessionTimeout, startTokenRefresh]);

  // WebSocket para reportar presencia en tiempo real
  useEffect(() => {
    if (user) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9000';
      socketRef.current = io(apiUrl);
      socketRef.current.on('connect', () => {
        socketRef.current?.emit('join_training');
      });
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
