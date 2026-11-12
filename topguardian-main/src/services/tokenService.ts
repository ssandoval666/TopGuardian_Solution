type SessionRefreshCallback = () => Promise<{ csrfToken: string; expiresIn: number }>;

class TokenService {
  private csrfToken: string | null = null;
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private onRefresh: SessionRefreshCallback | null = null;
  private onSessionExpired: (() => void) | null = null;

  setOnRefresh(callback: SessionRefreshCallback) {
    this.onRefresh = callback;
  }

  setOnSessionExpired(callback: () => void) {
    this.onSessionExpired = callback;
  }

  setCsrfToken(token: string, expiresIn?: number) {
    this.csrfToken = token || null;
    if (expiresIn) this.scheduleRefresh(expiresIn * 1000);
  }

  getCsrfToken() {
    return this.csrfToken;
  }

  getAccessToken(): null {
    return null;
  }

  isAuthenticated() {
    return !!this.csrfToken;
  }

  clearTokens() {
    this.csrfToken = null;
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private scheduleRefresh(expiresInMs: number) {
    if (this.refreshTimerId) clearTimeout(this.refreshTimerId);
    const refreshAt = Math.max(expiresInMs * 0.8, 5000);
    this.refreshTimerId = setTimeout(async () => {
      if (!this.onRefresh) return this.expireSession();
      try {
        const session = await this.onRefresh();
        this.setCsrfToken(session.csrfToken, session.expiresIn);
      } catch (error) {
        console.error("[Session] No se pudo renovar la sesión:", error);
        this.expireSession();
      }
    }, refreshAt);
  }

  private expireSession() {
    this.clearTokens();
    this.onSessionExpired?.();
  }
}

export const tokenService = new TokenService();

export const sessionFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  const csrfCookie = typeof document === "undefined"
    ? null
    : document.cookie.split("; ").find((cookie) => cookie.startsWith("tg_csrf="))?.slice("tg_csrf=".length);
  const csrfToken = tokenService.getCsrfToken() || csrfCookie || null;

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
    tokenService.setCsrfToken(csrfToken);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
};
