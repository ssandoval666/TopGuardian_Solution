// Real API service for Company Training assignments

import { tokenService } from "./tokenService";
import { addMonths, addYears, parseISO, format, differenceInDays } from "date-fns";

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

export type AssignmentStatus = "pending" | "completed" | "expired" | "expiring_soon";

export interface CompanyTraining {
  id: string;
  companyId: string;
  companyName: string;
  trainingId: string;
  trainingTitle: string;
  assignedDate: string;
  completedDate?: string;
  dueDate?: string;
  recurrence: "none" | "monthly" | "yearly";
  status: AssignmentStatus;
}

/** Recalculate status based on completedDate and dueDate */
export const computeStatus = (a: CompanyTraining): AssignmentStatus => {
  if (!a.completedDate) return "pending";
  if (!a.dueDate || a.recurrence === "none") return "completed";
  const diff = differenceInDays(parseISO(a.dueDate), new Date());
  if (diff < 0) return "expired";
  if (diff <= 30) return "expiring_soon";
  return "completed";
};

export const computeNextDue = (completedDate: string, recurrence: "none" | "monthly" | "yearly"): string | undefined => {
  if (recurrence === "none") return undefined;
  const base = parseISO(completedDate);
  const next = recurrence === "monthly" ? addMonths(base, 1) : addYears(base, 1);
  return format(next, "yyyy-MM-dd");
};

export const apiFetchCompanyTrainings = async (companyId: string): Promise<CompanyTraining[]> => {
  return apiCall(`/trainings/company/${companyId}`);
};

export const apiAssignTrainingToCompany = async (
  assignment: Omit<CompanyTraining, "id" | "status">
): Promise<CompanyTraining> => {
  return apiCall('/trainings/company', {
    method: 'POST',
    body: JSON.stringify(assignment),
  });
};

export const apiMarkCompanyTrainingCompleted = async (
  id: string, completedDate: string
): Promise<CompanyTraining> => {
  return apiCall(`/trainings/company/${id}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ completedDate }),
  });
};

export const apiUnassignCompanyTraining = async (id: string): Promise<void> => {
  return apiCall(`/trainings/company/${id}`, {
    method: 'DELETE',
  });
};

/** Fetch alerts for a specific company */
export const apiFetchCompanyTrainingAlerts = async (companyId: string): Promise<CompanyTraining[]> => {
  const trainings = await apiCall(`/trainings/company/${companyId}`);
  return trainings.filter((a: CompanyTraining) => a.status === "expired" || a.status === "expiring_soon");
};

/** Dashboard stats for a company */
export const apiFetchCompanyTrainingStats = async (companyId: string): Promise<{ completed: number; pending: number; pendingList: CompanyTraining[] }> => {
  await delay(300);
  const all = mockAssignmentsDB
    .filter((a) => a.companyId === companyId)
    .map((a) => ({ ...a, status: computeStatus(a) }));
  const completed = all.filter((a) => a.status === "completed").length;
  const pendingList = all.filter((a) => a.status !== "completed");
  return { completed, pending: pendingList.length, pendingList };
};
