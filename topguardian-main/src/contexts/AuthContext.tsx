/* AuthContext v2 */
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { tokenService } from "@/services/tokenService";
import { ApiError, apiFetchSession, apiLogin, apiLogout, apiRefreshToken } from "@/services/api";

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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    tokenService.setOnRefresh(async () => {
      const session = await apiRefreshToken();
      tokenService.setCsrfToken(session.csrfToken, session.expiresIn);
      return session;
    });

    tokenService.setOnSessionExpired(() => {
      console.log("[Auth] Sesión expirada, cerrando sesión...");
      setUser(null);
      apiLogout().catch((error) => console.error("[Auth] No se pudieron limpiar las cookies de sesión:", error));
    });

    for (const key of ["auth_user", "access_token", "refresh_token", "token_expires_at"]) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }

    apiFetchSession()
      .catch(async (error) => {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
        const refreshed = await apiRefreshToken();
        tokenService.setCsrfToken(refreshed.csrfToken, refreshed.expiresIn);
        return apiFetchSession();
      })
      .then(({ user: sessionUser, csrfToken, expiresIn }) => {
        setUser(sessionUser);
        tokenService.setCsrfToken(csrfToken, expiresIn);
      })
      .catch((error) => {
        tokenService.clearTokens();
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error("[Auth] No se pudo restaurar la sesión:", error);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleLoginResponse = useCallback((response: Awaited<ReturnType<typeof apiLogin>>) => {
    const { user: userData, csrfToken, expiresIn } = response;
    tokenService.setCsrfToken(csrfToken, expiresIn);
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
    const logoutRequest = apiLogout();
    tokenService.clearTokens();
    setUser(null);
    sessionStorage.removeItem("selected_company");
    logoutRequest.catch((error) => console.error("[Auth] No se pudo cerrar la sesión en el servidor:", error));
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
