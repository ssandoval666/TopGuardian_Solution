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

  if (response.status === 204) {
    return;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
};

// ---- Checklist Items (templates) ----

export interface ChecklistItem {
  id: string;
  name: string;
  category: string;
}

export const apiFetchChecklistItems = async (): Promise<ChecklistItem[]> => {
  return apiCall('/checklists/items');
};

export const apiCreateChecklistItem = async (item: Omit<ChecklistItem, "id">): Promise<ChecklistItem> => {
  return apiCall('/checklists/items', {
    method: 'POST',
    body: JSON.stringify(item),
  });
};

export const apiUpdateChecklistItem = async (id: string, data: Partial<ChecklistItem>): Promise<ChecklistItem> => {
  return apiCall(`/checklists/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const apiDeleteChecklistItem = async (id: string): Promise<void> => {
  return apiCall(`/checklists/items/${id}`, {
    method: 'DELETE',
  });
};

// ---- Checklist Visits ----

export interface ChecklistEntry {
  itemId: string;
  itemName: string;
  compliant: boolean | null; // null = not evaluated
  observations: string;
}

export interface ChecklistVisit {
  id: string;
  companyId: string;
  companyName: string;
  visitDate: string;
  entries: ChecklistEntry[];
}

export const apiFetchChecklistVisits = async (companyId?: string): Promise<ChecklistVisit[]> => {
  const query = companyId ? `?companyId=${companyId}` : '';
  return apiCall(`/checklists/visits${query}`);
};

export const apiCreateChecklistVisit = async (visit: Omit<ChecklistVisit, "id">): Promise<ChecklistVisit> => {
  return apiCall('/checklists/visits', {
    method: 'POST',
    body: JSON.stringify(visit),
  });
};

export const apiUpdateChecklistVisit = async (id: string, data: Partial<ChecklistVisit>): Promise<ChecklistVisit> => {
  return apiCall(`/checklists/visits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const apiDeleteChecklistVisit = async (id: string): Promise<void> => {
  return apiCall(`/checklists/visits/${id}`, {
    method: 'DELETE',
  });
};
