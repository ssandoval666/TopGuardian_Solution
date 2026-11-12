import { User, CapacitacionesResponse } from "@/types";

export const SESSION_TIMEOUT_MS = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS) || 15 * 60 * 1000;

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9000";
let csrfToken: string | null = null;

const sessionFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  return fetch(input, { ...init, headers, credentials: "include" });
};

const mapEmployee = (employee: any): User => ({
  id: employee.id,
  username: `${employee.firstName} ${employee.lastName}`,
  documentNumber: employee.documentNumber,
  ruc: employee.ruc,
  companyId: employee.companyId,
  companyName: employee.companyName,
});

export const apiService = {
  login: async (ruc: string, documentNumber: string): Promise<User> => {
    const response = await sessionFetch(`${API_BASE_URL}/auth/training-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruc, documentNumber }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "RUC o Documento incorrectos");
    }

    const data = await response.json();
    csrfToken = data.csrfToken;
    return mapEmployee(data.employee);
  },

  getSession: async (): Promise<User> => {
    const response = await sessionFetch(`${API_BASE_URL}/auth/training-session`);
    if (!response.ok) throw new Error(`No se pudo restaurar la sesión (${response.status})`);
    const data = await response.json();
    csrfToken = data.csrfToken;
    return mapEmployee(data.employee);
  },

  logout: async (): Promise<void> => {
    const response = await sessionFetch(`${API_BASE_URL}/auth/training-logout`, { method: "POST" });
    if (!response.ok) throw new Error(`No se pudo cerrar la sesión (${response.status})`);
    csrfToken = null;
  },

  getCapacitaciones: async (employeeId: string): Promise<CapacitacionesResponse> => {
    const response = await sessionFetch(`${API_BASE_URL}/trainings/employee-app/${employeeId}`);
    if (!response.ok) throw new Error("Error al obtener capacitaciones");
    const data = await response.json();

    return {
      capacitaciones: data.map((training: any) => {
        let thumbUrl = "";
        if (training.thumbnailData && training.thumbnailData.length > 0) {
          const blob = new Blob([new Uint8Array(training.thumbnailData)]);
          thumbUrl = URL.createObjectURL(blob);
        }
        return {
          codigo: String(training.training_id || training.trainingId),
          nombre: training.training_title || training.trainingTitle,
          status: training.status,
          thumbnail: thumbUrl,
          pdf: "",
        };
      }),
    };
  },

  getCapacitacionCompleta: async (id: string): Promise<any> => {
    const response = await sessionFetch(`${API_BASE_URL}/trainings/${id}/full`);
    if (!response.ok) throw new Error("Error al obtener el detalle de la capacitación");
    return response.json();
  },

  registrarCapacitacion: async (data: {
    trainingId: string;
    score: number;
    signatureData: number[];
    completionDate: string;
  }): Promise<boolean> => {
    const response = await sessionFetch(`${API_BASE_URL}/trainings/employee/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Error al registrar la capacitación");
    return true;
  },
};
