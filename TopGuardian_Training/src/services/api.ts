import { User, Capacitacion, CapacitacionesResponse, PreguntaCuestionario, RegistroCapacitacion } from "@/types";

// Configurable session timeout in milliseconds (default: 15 minutes)
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// API Service
export const apiService = {
  login: async (ruc: string, documentNumber: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/auth/training-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruc, documentNumber }),
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'RUC o Documento incorrectos');
    }
    
    const data = await response.json();
    return {
      id: data.employee.id,
      username: data.employee.firstName + ' ' + data.employee.lastName,
      companyId: data.employee.companyId,
      token: data.accessToken,
      refreshToken: '', 
    };
  },

  refreshToken: async (refreshToken: string): Promise<{ token: string; refreshToken: string } | null> => {
    return null;
  },

  getCapacitaciones: async (companyId: string, token: string): Promise<CapacitacionesResponse> => {
    const response = await fetch(`${API_BASE_URL}/trainings/company/${companyId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Error al obtener capacitaciones');
    const data = await response.json();
    
    return {
      capacitaciones: data.map((t: any) => ({
        codigo: String(t.training_id || t.trainingId),
        nombre: t.training_title || t.trainingTitle,
        thumbnail: '', // Se carga el real en el detalle si es necesario o un ícono por defecto
        pdf: ''
      }))
    };
  },

  getCapacitacionCompleta: async (id: string, token: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/trainings/${id}/full`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Error al obtener el detalle de la capacitación');
    return response.json();
  },

  registrarCapacitacion: async (data: RegistroCapacitacion): Promise<boolean> => {
    console.log("Registrando capacitación en la API (Firma, Score):", data);
    return true;
  },
};
