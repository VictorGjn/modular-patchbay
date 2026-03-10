export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'openrouter' | 'google' | 'custom';
  apiKey: string;
  baseUrl: string;
  accessToken?: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  type?: 'stdio' | 'sse' | 'http' | 'streamable-http';
  command: string;
  args: string[];
  env: Record<string, string>;
  autoConnect?: boolean;
  url?: string;
  headers?: Record<string, string>;
}

export interface AppConfig {
  providers: ProviderConfig[];
  mcpServers: McpServerConfig[];
}

export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
}
