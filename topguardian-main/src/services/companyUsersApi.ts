// Real API service for Company Users

import { tokenService } from "./tokenService";
import { apiFetchUserList, type UserDetail } from "./userApi";

// Base API URL
const API_BASE_URL = 'http://localhost:9000';

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

export const apiFetchCompanyUsers = async (companyId: string): Promise<string[]> => {
  return apiCall(`/companies/${companyId}/users`);
};

export const apiUpdateCompanyUsers = async (companyId: string, userIds: string[]): Promise<void> => {
  return apiCall(`/companies/${companyId}/users`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
};

export const apiFetchAllActiveUsers = async (): Promise<UserDetail[]> => {
  // Fetch all users (large page) and filter active only
  const res = await apiFetchUserList({ page: 1, pageSize: 100 });
  return res.data.filter(u => u.active);
};
