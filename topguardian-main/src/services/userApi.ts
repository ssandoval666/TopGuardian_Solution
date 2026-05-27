import { tokenService } from "./tokenService";

// Base API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// Generic API call function
const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  // Add auth header if token exists
  const token = tokenService.getAccessToken();
  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

export interface UserDetail {
  id: string;
  name: string;
  username: string;
  email: string;
  role?: string;
  phone?: string;
  active: boolean;
}

export interface UserListParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface UserListResponse {
  data: UserDetail[];
  total: number;
  page: number;
  pageSize: number;
}

// Helper para estandarizar los datos y evitar errores de SQLite (Number vs String)
const mapUser = (u: any): UserDetail => ({
  ...u,
  id: String(u.id),
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role || "",
  phone: u.phone || "",
  active: u.active === 1 || u.active === true || u.active === "true" || u.active === "1",
});

export const apiFetchUserList = async (params: UserListParams): Promise<UserListResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });
  if (params.search) {
    queryParams.append('search', params.search);
  }
  const res = await apiCall(`/users/list?${queryParams}`);
  if (res && Array.isArray(res.data)) {
    res.data = res.data.map(mapUser);
  }
  return res;
};

export const apiCreateUser = async (user: Omit<UserDetail, "id"> & { password: string }): Promise<UserDetail> => {
  const res = await apiCall('/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
  return mapUser(res);
};

export const apiUpdateUser = async (id: string, user: Partial<UserDetail>): Promise<UserDetail> => {
  const res = await apiCall(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  });
  return mapUser(res);
};

export const apiDeleteUser = async (id: string): Promise<void> => {
  return apiCall(`/users/${id}`, {
    method: 'DELETE',
  });
};

export const apiForceLogoutUser = async (id: string): Promise<void> => {
  return apiCall(`/users/${id}/force-logout`, {
    method: 'POST',
  });
};
