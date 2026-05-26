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

let mockVisits: ChecklistVisit[] = [
  {
    id: "v1",
    companyId: "1",
    companyName: "Acme Corp",
    visitDate: "2026-03-15",
    entries: [
      { itemId: "ci1", itemName: "Extintores en buen estado", compliant: true, observations: "" },
      { itemId: "ci2", itemName: "Señalización de emergencia visible", compliant: true, observations: "" },
      { itemId: "ci3", itemName: "Salidas de emergencia despejadas", compliant: false, observations: "Salida bloqueada en sector B" },
      { itemId: "ci4", itemName: "EPP disponible y en condiciones", compliant: true, observations: "" },
      { itemId: "ci5", itemName: "Botiquín de primeros auxilios completo", compliant: true, observations: "" },
      { itemId: "ci6", itemName: "Orden y limpieza general", compliant: false, observations: "Área de almacén desordenada" },
    ],
  },
  {
    id: "v2",
    companyId: "1",
    companyName: "Acme Corp",
    visitDate: "2026-02-10",
    entries: [
      { itemId: "ci1", itemName: "Extintores en buen estado", compliant: true, observations: "" },
      { itemId: "ci2", itemName: "Señalización de emergencia visible", compliant: false, observations: "Falta señalización en piso 2" },
      { itemId: "ci3", itemName: "Salidas de emergencia despejadas", compliant: true, observations: "" },
      { itemId: "ci7", itemName: "Instalaciones eléctricas protegidas", compliant: true, observations: "" },
    ],
  },
  {
    id: "v3",
    companyId: "2",
    companyName: "Globex SA",
    visitDate: "2026-03-20",
    entries: [
      { itemId: "ci1", itemName: "Extintores en buen estado", compliant: true, observations: "" },
      { itemId: "ci4", itemName: "EPP disponible y en condiciones", compliant: true, observations: "" },
      { itemId: "ci5", itemName: "Botiquín de primeros auxilios completo", compliant: false, observations: "Faltan insumos básicos" },
      { itemId: "ci6", itemName: "Orden y limpieza general", compliant: true, observations: "" },
      { itemId: "ci8", itemName: "Capacitación al día", compliant: true, observations: "" },
    ],
  },
];

export const apiFetchChecklistVisits = async (companyId: string): Promise<ChecklistVisit[]> => {
  await delay(400);
  console.log("[API] GET /checklist-visits?companyId=" + companyId, authHeaders());
  return mockVisits.filter((v) => v.companyId === companyId);
};

export const apiCreateChecklistVisit = async (visit: Omit<ChecklistVisit, "id">): Promise<ChecklistVisit> => {
  await delay(400);
  console.log("[API] POST /checklist-visits", authHeaders());
  const created: ChecklistVisit = { ...visit, id: "v" + Date.now() };
  mockVisits.push(created);
  return created;
};

export const apiUpdateChecklistVisit = async (id: string, data: Partial<ChecklistVisit>): Promise<ChecklistVisit> => {
  await delay(300);
  console.log("[API] PUT /checklist-visits/" + id, authHeaders());
  const idx = mockVisits.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error("Visita no encontrada");
  mockVisits[idx] = { ...mockVisits[idx], ...data };
  return mockVisits[idx];
};

export const apiDeleteChecklistVisit = async (id: string): Promise<void> => {
  await delay(300);
  console.log("[API] DELETE /checklist-visits/" + id, authHeaders());
  mockVisits = mockVisits.filter((v) => v.id !== id);
};
