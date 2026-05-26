export interface User {
  id: string;
  username: string;
  token: string;
  refreshToken: string;
}

export interface Capacitacion {
  codigo: string;
  nombre: string;
  thumbnail: string; // base64
  pdf: string; // base64
}

export interface CapacitacionesResponse {
  capacitaciones: Capacitacion[];
}

export interface PreguntaCuestionario {
  id: string;
  pregunta: string;
  opciones: string[];
  respuestaCorrecta: number;
}

export interface RegistroCapacitacion {
  token: string;
  codigoCapacitacion: string;
  codigoUsuario: string;
  porcentajeAprobacion: number;
}
