// Real API service for Risk Matrices

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

// Niveles de riesgo: Probabilidad (1-5) x Severidad (1-5)
export type RiskLevel = "trivial" | "tolerable" | "moderado" | "importante" | "intolerable";

export interface RiskCell {
  hazardId: string;
  sectorId: string;
  probability: number; // 1-5
  severity: number; // 1-5
  riskScore: number; // probability * severity
  riskLevel: RiskLevel;
  controlMeasure: string;
}

export interface Hazard {
  id: string;
  name: string;
  category: string; // "Físico" | "Químico" | "Biológico" | "Ergonómico" | "Psicosocial" | "Mecánico" | "Eléctrico"
}

export interface Sector {
  id: string;
  name: string;
}

export interface RiskMatrix {
  id: string;
  companyId: string;
  name: string;
  date: string;
  sectors: Sector[];
  hazards: Hazard[];
  cells: RiskCell[];
}

export const getRiskLevel = (score: number): RiskLevel => {
  if (score <= 4) return "trivial";
  if (score <= 8) return "tolerable";
  if (score <= 12) return "moderado";
  if (score <= 16) return "importante";
  return "intolerable";
};

export interface HazardCategory {
  id: string;
  name: string;
}

export const apiFetchHazardCategories = async (): Promise<HazardCategory[]> => {
  const res = await apiCall('/hazard-categories');
  return Array.isArray(res) ? res.map((c: any) => ({ ...c, id: String(c.id) })) : [];
};

export const apiCreateHazardCategory = async (category: Omit<HazardCategory, "id">): Promise<HazardCategory> => {
  const res = await apiCall('/hazard-categories', {
    method: 'POST',
    body: JSON.stringify(category),
  });
  return { ...res, id: String(res.id) };
};

export const apiUpdateHazardCategory = async (id: string, category: Partial<HazardCategory>): Promise<HazardCategory> => {
  const res = await apiCall(`/hazard-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(category),
  });
  return { ...res, id: String(res.id) };
};

export const apiDeleteHazardCategory = async (id: string): Promise<void> => {
  return apiCall(`/hazard-categories/${id}`, {
    method: 'DELETE',
  });
};

export const apiFetchRiskMatrices = async (companyId?: string): Promise<RiskMatrix[]> => {
  const query = companyId ? `?companyId=${companyId}` : '';
  return apiCall(`/risk-matrices${query}`);
};

export const apiFetchRiskMatrix = async (matrixId: string, companyId: string): Promise<RiskMatrix | null> => {
  return apiCall(`/risk-matrices/${matrixId}`);
};

export const apiSaveRiskMatrix = async (matrix: RiskMatrix): Promise<RiskMatrix> => {
  return apiCall(`/risk-matrices/${matrix.id}`, {
    method: 'PUT',
    body: JSON.stringify(matrix),
  });
};

export const apiCreateRiskMatrix = async (companyId: string, name: string): Promise<RiskMatrix> => {
  const date = new Date().toISOString().split('T')[0];
  return apiCall('/risk-matrices', {
    method: 'POST',
    body: JSON.stringify({ 
      companyId, 
      name, 
      date,
      sectors: [],
      hazards: [],
      cells: []
    }),
  });
};

export const apiDeleteRiskMatrix = async (companyId: string, matrixId: string): Promise<void> => {
  return apiCall(`/risk-matrices/${matrixId}`, {
    method: 'DELETE',
  });
};
