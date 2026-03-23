export const API_BASE = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
  ? 'http://localhost:4800/api'
  : '/api';
