/* AuthContext v2 */
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { tokenService } from "@/services/tokenService";
import { apiLogin, apiRefreshToken } from "@/services/api";

interface User {
  id: string;
  name: string;
  username: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Configurar auto-refresh callback
  useEffect(() => {
    tokenService.setOnRefresh(async () => {
      const rt = tokenService.getRefreshToken();
      if (!rt) throw new Error("No refresh token");
      return apiRefreshToken(rt);
    });

    tokenService.setOnSessionExpired(() => {
      console.log("[Auth] Sesión expirada, cerrando sesión...");
      setUser(null);
      localStorage.removeItem("auth_user");
      tokenService.clearTokens();
    });
  }, []);

  const handleLoginResponse = useCallback((response: Awaited<ReturnType<typeof apiLogin>>) => {
    const { user: userData, accessToken, refreshToken, expiresIn } = response;
    tokenService.setTokens(accessToken, refreshToken, expiresIn);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiLogin(username, password);
      handleLoginResponse(response);
    } finally {
      setIsLoading(false);
    }
  }, [handleLoginResponse]);



  const logout = useCallback(() => {
    tokenService.clearTokens();
    localStorage.removeItem("auth_user");
    localStorage.removeItem("selected_company");
    setUser(null);
  }, []);

  const isAuthenticated = !!user && tokenService.isAuthenticated();

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
