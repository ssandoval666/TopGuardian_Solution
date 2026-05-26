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

  return response.json();
};

export interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface EmployeeListParams {
  companyId: string;
  page: number;
  pageSize: number;
  search?: string;
}

export interface EmployeeListResponse {
  data: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

// Helper para mapear la respuesta del backend (snake_case) al frontend (camelCase)
const mapEmployee = (e: any): Employee => ({
  ...e,
  id: String(e.id),
  companyId: String(e.companyId || e.company_id),
  firstName: e.firstName || e.first_name || "",
  lastName: e.lastName || e.last_name || "",
  documentNumber: e.documentNumber || e.document_number || "",
  position: e.position || "",
  department: e.department || "",
  email: e.email || "",
  phone: e.phone || "",
});

export const apiFetchEmployees = async (params: EmployeeListParams): Promise<EmployeeListResponse> => {
  const queryParams = new URLSearchParams({
    companyId: params.companyId,
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });
  if (params.search) {
    queryParams.append('search', params.search);
  }
  
  const res = await apiCall(`/employees?${queryParams}`);
  if (res && Array.isArray(res.data)) {
    res.data = res.data.map(mapEmployee);
  }
  return res;
};

export const apiCreateEmployee = async (employee: Omit<Employee, "id">): Promise<Employee> => {
  // Enviamos ambos formatos para asegurar compatibilidad con el backend
  const payload = {
    ...employee,
    company_id: employee.companyId,
    first_name: employee.firstName,
    last_name: employee.lastName,
    document_number: employee.documentNumber
  };

  const res = await apiCall('/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapEmployee(res);
};

export const apiUpdateEmployee = async (id: string, employee: Partial<Employee>): Promise<Employee> => {
  const payload = {
    ...employee,
    ...(employee.companyId && { company_id: employee.companyId }),
    ...(employee.firstName && { first_name: employee.firstName }),
    ...(employee.lastName && { last_name: employee.lastName }),
    ...(employee.documentNumber && { document_number: employee.documentNumber })
  };

  const res = await apiCall(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapEmployee(res);
};

export const apiDeleteEmployee = async (id: string): Promise<void> => {
  return apiCall(`/employees/${id}`, {
    method: 'DELETE',
  });
};
