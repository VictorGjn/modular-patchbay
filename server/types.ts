export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'openrouter' | 'google' | 'custom';
  apiKey: string;
  baseUrl: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
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
