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

export const apiFetchEmployees = async (params: EmployeeListParams): Promise<EmployeeListResponse> => {
  const queryParams = new URLSearchParams({
    companyId: params.companyId,
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });
  if (params.search) {
    queryParams.append('search', params.search);
  }
  return apiCall(`/employees?${queryParams}`);
};

export const apiCreateEmployee = async (employee: Omit<Employee, "id">): Promise<Employee> => {
  return apiCall('/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  });
};

export const apiUpdateEmployee = async (id: string, employee: Partial<Employee>): Promise<Employee> => {
  return apiCall(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(employee),
  });
};

export const apiDeleteEmployee = async (id: string): Promise<void> => {
  return apiCall(`/employees/${id}`, {
    method: 'DELETE',
  });
};
