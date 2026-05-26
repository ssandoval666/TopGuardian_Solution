/**
 * Calendar service with localStorage persistence.
 * Mock data for appointments with cross-tab sync via storage events.
 */

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

const STORAGE_KEY = "tg_calendar_appointments";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getAll(): Appointment[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(appointments: Appointment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}

// Seed some demo data if empty
export function seedDemoData(userId: string) {
  const existing = getAll().filter((a) => a.userId === userId);
  if (existing.length > 0) return;

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const demos: Omit<Appointment, "id">[] = [
    { title: "Reunión de equipo", date: fmt(today), startTime: "09:00", endTime: "09:30", notes: "Revisión semanal del proyecto", completed: false, userId },
    { title: "Revisión de seguridad", date: fmt(today), startTime: "11:00", endTime: "12:00", notes: "Auditoría de accesos", completed: false, userId },
    { title: "Capacitación SST", date: fmt(today), startTime: "14:30", endTime: "15:30", notes: "Módulo 3 - Riesgos eléctricos", completed: false, userId },
    { title: "Inspección planta", date: fmt(tomorrow), startTime: "08:00", endTime: "10:00", notes: "Planta norte", completed: false, userId },
    { title: "Entrega de informe", date: fmt(yesterday), startTime: "16:00", endTime: "16:30", notes: "Informe mensual", completed: true, userId },
  ];

  const all = getAll();
  demos.forEach((d) => all.push({ ...d, id: generateId() }));
  saveAll(all);
}

export function getAppointmentsByDate(userId: string, date: string): Appointment[] {
  return getAll()
    .filter((a) => a.userId === userId && a.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getAppointmentsByMonth(userId: string, year: number, month: number): Appointment[] {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return getAll().filter((a) => a.userId === userId && a.date.startsWith(prefix));
}

export function getTodayPendingCount(userId: string): number {
  const today = new Date().toISOString().split("T")[0];
  return getAll().filter((a) => a.userId === userId && a.date === today && !a.completed).length;
}

export function addAppointment(appt: Omit<Appointment, "id">): Appointment {
  const all = getAll();
  const newAppt: Appointment = { ...appt, id: generateId() };
  all.push(newAppt);
  saveAll(all);
  return newAppt;
}

export function updateAppointment(id: string, updates: Partial<Appointment>): Appointment | null {
  const all = getAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  saveAll(all);
  return all[idx];
}

export function deleteAppointment(id: string): boolean {
  const all = getAll();
  const filtered = all.filter((a) => a.id !== id);
  if (filtered.length === all.length) return false;
  saveAll(filtered);
  return true;
}

export function markCompleted(id: string): Appointment | null {
  return updateAppointment(id, { completed: true });
}
