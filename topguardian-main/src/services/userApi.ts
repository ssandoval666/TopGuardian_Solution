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

export const apiFetchUserList = async (params: UserListParams): Promise<UserListResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });
  if (params.search) {
    queryParams.append('search', params.search);
  }
  return apiCall(`/users/list?${queryParams}`);
};

export const apiCreateUser = async (user: Omit<UserDetail, "id"> & { password: string }): Promise<UserDetail> => {
  return apiCall('/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
};

export const apiUpdateUser = async (id: string, user: Partial<UserDetail>): Promise<UserDetail> => {
  return apiCall(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  });
};

export const apiDeleteUser = async (id: string): Promise<void> => {
  return apiCall(`/users/${id}`, {
    method: 'DELETE',
  });
};
