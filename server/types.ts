export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'openrouter' | 'google' | 'custom';
  apiKey: string;
  baseUrl: string;
  accessToken?: string;
  authMethod?: 'claude-agent-sdk';
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

export interface MemoryConfig {
  backend: string;
  connectionString?: string;
}

export interface PipedreamConfig {
  projectId: string;
  clientId: string;
  clientSecret: string;
  environment: 'development' | 'production';
}

export interface AppConfig {
  providers: ProviderConfig[];
  mcpServers: McpServerConfig[];
  memory?: MemoryConfig;
  pipedream?: PipedreamConfig;
}

export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
}
