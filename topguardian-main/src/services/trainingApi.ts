// Real API service for Trainings with JWT support

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

export type RecurrenceType = "none" | "monthly" | "yearly";

export interface Training {
  id: string;
  title: string;
  description: string;
  instructor: string;
  date: string;
  duration: string;
  recurrence: RecurrenceType;
  pdfFileName?: string;
  pdfData?: number[]; // array de bytes
  thumbnailFileName?: string;
  thumbnailData?: number[]; // array de bytes (imagen)
}

export interface TrainingListParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface TrainingListResponse {
  data: Training[];
  total: number;
  page: number;
  pageSize: number;
}

export const apiFetchTrainingList = async (params: TrainingListParams): Promise<TrainingListResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });
  if (params.search) {
    queryParams.append('search', params.search);
  }
  return apiCall(`/trainings?${queryParams}`);
};

export const apiCreateTraining = async (training: Omit<Training, "id">): Promise<Training> => {
  return apiCall('/trainings', {
    method: 'POST',
    body: JSON.stringify(training),
  });
};

export const apiUpdateTraining = async (id: string, training: Partial<Training>): Promise<Training> => {
  return apiCall(`/trainings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(training),
  });
};

export const apiDeleteTraining = async (id: string): Promise<void> => {
  return apiCall(`/trainings/${id}`, {
    method: 'DELETE',
  });
};

/** Fetch all trainings (no pagination) for assignment purposes */
export const apiFetchAllTrainings = async (): Promise<Training[]> => {
  return apiCall('/trainings/all');
};
