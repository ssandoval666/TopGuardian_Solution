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

export let HAZARD_CATEGORIES = [
  "Físico", "Químico", "Biológico", "Ergonómico", "Psicosocial", "Mecánico", "Eléctrico",
];

export const addHazardCategory = (category: string) => {
  if (!HAZARD_CATEGORIES.includes(category)) {
    HAZARD_CATEGORIES = [...HAZARD_CATEGORIES, category];
  }
};

export const removeHazardCategory = (category: string) => {
  HAZARD_CATEGORIES = HAZARD_CATEGORIES.filter((c) => c !== category);
};

export const apiFetchRiskMatrices = async (companyId: string): Promise<RiskMatrix[]> => {
  return apiCall(`/risk-matrices?companyId=${companyId}`);
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
