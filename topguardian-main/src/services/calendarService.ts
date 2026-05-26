/**
 * Calendar service integrated with backend API.
 */
import { apiCall } from './api';

export interface Appointment {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes: string;
  completed: boolean;
  userId: string;
}

export const getAppointmentsByDate = async (userId: string, date: string): Promise<Appointment[]> => {
  return apiCall(`/calendar?date=${date}`);
};

export const getAppointmentsByMonth = async (userId: string, year: number, month: number): Promise<Appointment[]> => {
  // Month parameter format YYYY-MM
  const formattedMonth = String(month + 1).padStart(2, "0");
  return apiCall(`/calendar?month=${year}-${formattedMonth}`);
};

export const getTodayPendingCount = async (userId: string): Promise<number> => {
  const res = await apiCall(`/calendar/pending-count`);
  return res.count || 0;
};

export const addAppointment = async (appt: Omit<Appointment, "id">): Promise<Appointment> => {
  return apiCall('/calendar', {
    method: 'POST',
    body: JSON.stringify(appt),
  });
};

export const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<Appointment> => {
  return apiCall(`/calendar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

export const deleteAppointment = async (id: string): Promise<void> => {
  return apiCall(`/calendar/${id}`, {
    method: 'DELETE',
  });
};

export const markCompleted = async (id: string): Promise<Appointment> => {
  return updateAppointment(id, { completed: true });
};

// Mantenemos esta función vacía para no romper imports antiguos en componentes UI
export const seedDemoData = async (userId: string) => {};
