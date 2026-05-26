// Real API service with JWT support

import { tokenService } from "./tokenService";

// Base API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// Headers with JWT
const authHeaders = () => {
  const token = tokenService.getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// Generic API call function
export const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
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

// ---- Auth endpoints ----

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export const apiLogin = async (username: string, password: string): Promise<LoginResponse> => {
  return apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
};

export const apiRefreshToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> => {
  return apiCall('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
};

// ---- Companies endpoint ----

export interface Company {
  id: string;
  name: string;
  ruc: string;
}

export const apiFetchCompanies = async (): Promise<Company[]> => {
  return apiCall('/companies');
};

// ---- Company CRUD endpoints ----

export interface CompanyDetail {
  id: string;
  name: string;
  ruc: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CompanyListParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CompanyListResponse {
  data: CompanyDetail[];
  total: number;
  page: number;
  pageSize: number;
}

export const apiFetchCompanyList = async (params: CompanyListParams): Promise<CompanyListResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });
  if (params.search) {
    queryParams.append('search', params.search);
  }
  return apiCall(`/companies/list?${queryParams}`);
};

export const apiCreateCompany = async (company: Omit<CompanyDetail, "id">): Promise<CompanyDetail> => {
  return apiCall('/companies', {
    method: 'POST',
    body: JSON.stringify(company),
  });
};

export const apiUpdateCompany = async (id: string, company: Partial<CompanyDetail>): Promise<CompanyDetail> => {
  return apiCall(`/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(company),
  });
};

export const apiDeleteCompany = async (id: string): Promise<void> => {
  return apiCall(`/companies/${id}`, {
    method: 'DELETE',
  });
};

// ---- Menu endpoint ----

/**
 * Item de menú devuelto por la API
 * - Estructura jerárquica padre-hijo
 * - Icon es el nombre del componente LucideIcon como string
 * - Path puede estar vacío para items contenedor (solo con children)
 */
export interface MenuItemRaw {
  id: string;
  icon: string; // Nombre del ícono, ej: "LayoutDashboard", "Settings", etc.
  label: string;
  path: string; // Puede estar vacío para items padre sin navegación directa
  children?: MenuItemRaw[];
  requiredRoles?: string[]; // Roles que tienen acceso a este item
}

/**
 * Obtener menú personalizado según la empresa y rol del usuario
 * La API devuelve solo los items permitidos para este usuario
 */
export const apiFetchMenu = async (companyId: string, userId: string): Promise<MenuItemRaw[]> => {
  const queryParams = new URLSearchParams({
    companyId,
    userId,
  });
  return apiCall(`/menu?${queryParams}`);
};

/**
 * Obtener todos los items del menú para administración (sin filtrar por roles)
 */
export const apiFetchAllMenuItems = async (): Promise<MenuItemRaw[]> => {
  return apiCall('/menu/all');
};

/**
 * Obtener la lista de roles válidos desde la API
 */
export const apiFetchRoles = async (): Promise<string[]> => {
  const result = await apiCall('/roles/list?page=1&pageSize=100');
  if (result && Array.isArray(result.data)) {
    return result.data.map((role: any) => role.nombre);
  }
  throw new Error('Formato inválido en /roles/list');
};

/**
 * Crear un nuevo item de menú
 */
export const apiCreateMenuItem = async (menuItem: Omit<MenuItemRaw, "id">): Promise<MenuItemRaw> => {
  return apiCall('/menu', {
    method: 'POST',
    body: JSON.stringify(menuItem),
  });
};

/**
 * Actualizar un item de menú existente
 */
export const apiUpdateMenuItem = async (id: string, menuItem: Partial<MenuItemRaw>): Promise<MenuItemRaw> => {
  return apiCall(`/menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(menuItem),
  });
};

/**
 * Eliminar un item de menú
 */
export const apiDeleteMenuItem = async (id: string): Promise<void> => {
  return apiCall(`/menu/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Actualizar la estructura completa del menú (reordenar, mover nodos)
 */
export const apiUpdateMenuStructure = async (menuItems: MenuItemRaw[]): Promise<MenuItemRaw[]> => {
  return apiCall('/menu/structure', {
    method: 'PUT',
    body: JSON.stringify({ items: menuItems }),
  });
};
