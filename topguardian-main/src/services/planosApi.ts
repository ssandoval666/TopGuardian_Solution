// Real API service for Floor Plans

import { tokenService } from "./tokenService";

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

export interface Plano {
  id: string;
  name: string;
  companyId: string;
  fileName: string;
  fileData: number[]; // byte array
  createdAt: string;
}

// Helper to convert File to byte array
export const fileToByteArray = async (file: File): Promise<number[]> => {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
};

// Helper to convert byte array back to blob URL for preview/download
export const byteArrayToUrl = (data: number[], mimeType = "application/pdf"): string => {
  if (!data || data.length === 0) return "";
  const uint8 = new Uint8Array(data);
  const blob = new Blob([uint8], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const apiFetchPlanos = async (companyId: string): Promise<Plano[]> => {
  return apiCall(`/planos?companyId=${companyId}`);
};

export const apiCreatePlano = async (plano: Omit<Plano, "id" | "createdAt">): Promise<Plano> => {
  return apiCall('/planos', {
    method: 'POST',
    body: JSON.stringify(plano),
  });
};

export const apiUpdatePlano = async (id: string, data: Partial<Plano>): Promise<Plano> => {
  return apiCall(`/planos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const apiDeletePlano = async (id: string): Promise<void> => {
  return apiCall(`/planos/${id}`, {
    method: 'DELETE',
  });
};
