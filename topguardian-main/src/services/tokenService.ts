// Servicio de gestión de tokens JWT con auto-refresh

type TokenRefreshCallback = () => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;

class TokenService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private onRefresh: TokenRefreshCallback | null = null;
  private onSessionExpired: (() => void) | null = null;

  constructor() {
    // Restaurar tokens de localStorage al iniciar
    this.accessToken = localStorage.getItem("access_token");
    this.refreshToken = localStorage.getItem("refresh_token");
    const expiresAt = localStorage.getItem("token_expires_at");

    if (this.accessToken && this.refreshToken && expiresAt) {
      const remaining = Number(expiresAt) - Date.now();
      if (remaining > 0) {
        this.scheduleRefresh(remaining);
      }
    }
  }

  setOnRefresh(callback: TokenRefreshCallback) {
    this.onRefresh = callback;
  }

  setOnSessionExpired(callback: () => void) {
    this.onSessionExpired = callback;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  setTokens(accessToken: string, refreshToken: string, expiresIn: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("token_expires_at", String(Date.now() + expiresIn * 1000));

    this.scheduleRefresh(expiresIn * 1000);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expires_at");

    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private scheduleRefresh(expiresInMs: number) {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
    }

    // Refrescar cuando quede el 20% del tiempo (ej: a los 48 min de 60 min)
    const refreshAt = Math.max(expiresInMs * 0.8, 5000);

    this.refreshTimerId = setTimeout(async () => {
      await this.doRefresh();
    }, refreshAt);

    console.log(`[TokenService] Auto-refresh programado en ${Math.round(refreshAt / 1000)}s`);
  }

  private async doRefresh() {
    if (!this.refreshToken || !this.onRefresh) {
      this.handleSessionExpired();
      return;
    }

    try {
      console.log("[TokenService] Refrescando token...");
      const result = await this.onRefresh();
      this.setTokens(result.accessToken, result.refreshToken, result.expiresIn);
      console.log("[TokenService] Token refrescado exitosamente");
    } catch (error) {
      console.error("[TokenService] Error al refrescar token:", error);
      this.handleSessionExpired();
    }
  }

  private handleSessionExpired() {
    this.clearTokens();
    this.onSessionExpired?.();
  }
}

export const tokenService = new TokenService();
