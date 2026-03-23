 
export const API_BASE = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV
  ? 'http://localhost:4800/api'
  : '/api';
