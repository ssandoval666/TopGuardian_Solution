// Real API service for Employee Training assignments

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

export interface EmployeeTraining {
  id: string;
  employeeId: string;
  trainingId: string;
  trainingTitle: string;
  assignedDate: string;       // ISO date
  completedDate?: string;     // ISO date (when the employee actually completed it)
  dueDate?: string;           // ISO date (next expiration based on recurrence)
  recurrence: "none" | "monthly" | "yearly";
  status: AssignmentStatus;
}

/** Recalculate status based on completedDate and dueDate */
export const computeStatus = (a: EmployeeTraining): AssignmentStatus => {
  if (!a.completedDate) return "pending";
  if (!a.dueDate || a.recurrence === "none") return "completed";
  const diff = differenceInDays(parseISO(a.dueDate), new Date());
  if (diff < 0) return "expired";
  if (diff <= 30) return "expiring_soon";
  return "completed";
};

/** Compute next due date after a completion */
export const computeNextDue = (completedDate: string, recurrence: "none" | "monthly" | "yearly"): string | undefined => {
  if (recurrence === "none") return undefined;
  const base = parseISO(completedDate);
  const next = recurrence === "monthly" ? addMonths(base, 1) : addYears(base, 1);
  return format(next, "yyyy-MM-dd");
};

export const apiFetchEmployeeTrainings = async (employeeId: string): Promise<EmployeeTraining[]> => {
  return apiCall(`/trainings/employee/${employeeId}`);
};

export const apiAssignTraining = async (
  assignment: Omit<EmployeeTraining, "id" | "status">
): Promise<EmployeeTraining> => {
  return apiCall('/trainings/employee', {
    method: 'POST',
    body: JSON.stringify(assignment),
  });
};

export const apiMarkTrainingCompleted = async (
  id: string,
  completedDate: string
): Promise<EmployeeTraining> => {
  return apiCall(`/trainings/employee/${id}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ completedDate }),
  });
};

export const apiUnassignTraining = async (id: string): Promise<void> => {
  return apiCall(`/trainings/employee/${id}`, {
    method: 'DELETE',
  });
};

/** Fetch all assignments across all employees to compute global notifications */
export const apiFetchAllTrainingAlerts = async (): Promise<EmployeeTraining[]> => {
  // This might need a specific endpoint for alerts, for now we'll get all and filter client-side
  const alerts: EmployeeTraining[] = await apiCall('/trainings/employee/alerts');
  return alerts
    .map((a) => ({ ...a, status: computeStatus(a) }))
    .filter((a) => a.status === "expired" || a.status === "expiring_soon");
};
