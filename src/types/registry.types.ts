// Shared types to break circular dependencies between registry modules

export type MarketplaceCategory = 'all' | 'research' | 'coding' | 'data' | 'design' | 'writing' | 'domain';
export type McpTransport = 'stdio' | 'sse' | 'streamable-http';
export type Runtime = 'claude' | 'amp' | 'codex' | 'openai' | 'gemini';
export type InstallScope = 'global' | 'project';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder: string;
  required: boolean;
  helpText?: string;
}