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

  if (response.status === 204) {
    return;
  }

  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
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

// Helper para mapear la respuesta del backend (snake_case) al frontend (camelCase)
const mapEmployeeTraining = (t: any): EmployeeTraining => ({
  ...t,
  id: String(t.id),
  employeeId: String(t.employeeId || t.employee_id),
  trainingId: String(t.trainingId || t.training_id),
  trainingTitle: t.trainingTitle || t.training_title || t.title || "",
  assignedDate: t.assignedDate || t.assigned_date || "",
  completedDate: t.completedDate || t.completed_date,
  dueDate: t.dueDate || t.due_date,
  recurrence: t.recurrence || "none",
});

export const apiFetchEmployeeTrainings = async (employeeId: string): Promise<EmployeeTraining[]> => {
  const res = await apiCall(`/trainings/employee/${employeeId}`);
  if (Array.isArray(res)) {
    return res.map(mapEmployeeTraining);
  }
  return res;
};

export const apiAssignTraining = async (
  assignment: Omit<EmployeeTraining, "id" | "status">
): Promise<EmployeeTraining> => {
  const payload = {
    ...assignment,
    employee_id: assignment.employeeId,
    training_id: assignment.trainingId,
    assigned_date: assignment.assignedDate,
    due_date: assignment.dueDate,
    completed_date: assignment.completedDate
  };
  const res = await apiCall('/trainings/employee', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapEmployeeTraining(res);
};

export const apiMarkTrainingCompleted = async (
  id: string,
  completedDate: string
): Promise<EmployeeTraining> => {
  const res = await apiCall(`/trainings/employee/${id}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ completedDate, completed_date: completedDate }),
  });
  return mapEmployeeTraining(res);
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
