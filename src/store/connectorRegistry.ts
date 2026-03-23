/**
 * Connector Registry — maps all native backend connectors to their metadata.
 * Single source of truth for the ConnectorPicker and ConnectorPanel.
 */
import type { ConnectorService, ConnectorAuthMethod, ConnectorSurface } from './knowledgeBase';

export interface ConnectorRegistryEntry {
  id: ConnectorService;
  name: string;
  icon: string;
  description: string;
  authMethod: ConnectorAuthMethod;
  /** Which surfaces this connector supports */
  supportedSurfaces: ConnectorSurface[];
  /** Backend route prefix: /api/connectors/v2/{routeId} */
  routeId: string;
  /** Auth fields required for /test endpoint */
  authFields: Array<{ key: string; label: string; type: 'text' | 'password' | 'url'; placeholder: string; required: boolean }>;
}

export const CONNECTOR_REGISTRY: ConnectorRegistryEntry[] = [
  // ── Wave 1 — Implemented ──
  {
    id: 'github', name: 'GitHub', icon: '🐙',
    description: 'Issues, PRs, and code search',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'github',
    authFields: [{ key: 'apiKey', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true }],
  },
  {
    id: 'slack', name: 'Slack', icon: '💬',
    description: 'Channels, messages, and search',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool', 'output'],
    routeId: 'slack',
    authFields: [{ key: 'apiKey', label: 'Bot Token', type: 'password', placeholder: 'xoxb-...', required: true }],
  },
  {
    id: 'notion', name: 'Notion', icon: '📄',
    description: 'Databases, pages, and workspace search',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'notion',
    authFields: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'secret_...', required: true }],
  },
  {
    id: 'jira', name: 'Jira', icon: '🎫',
    description: 'Issues, sprints, and project boards',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'jira',
    authFields: [
      { key: 'apiKey', label: 'API Token', type: 'password', placeholder: 'ATATT3x...', required: true },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'user@company.com', required: true },
      { key: 'domain', label: 'Domain', type: 'text', placeholder: 'company.atlassian.net', required: true },
    ],
  },
  {
    id: 'hubspot', name: 'HubSpot', icon: '🧲',
    description: 'CRM contacts, deals, tickets',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'hubspot',
    authFields: [{ key: 'apiKey', label: 'Private App Token', type: 'password', placeholder: 'pat-...', required: true }],
  },
  {
    id: 'airtable', name: 'Airtable', icon: '📊',
    description: 'Bases, tables, and records',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'airtable',
    authFields: [{ key: 'apiKey', label: 'Personal Access Token', type: 'password', placeholder: 'pat...', required: true }],
  },
  // ── Wave 2 ──
  {
    id: 'confluence', name: 'Confluence', icon: '📚',
    description: 'Spaces, pages, and content',
    authMethod: 'api-key', supportedSurfaces: ['knowledge'],
    routeId: 'confluence',
    authFields: [
      { key: 'apiKey', label: 'API Token', type: 'password', placeholder: 'ATATT3x...', required: true },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'user@company.com', required: true },
      { key: 'domain', label: 'Domain', type: 'text', placeholder: 'company.atlassian.net', required: true },
    ],
  },
  {
    id: 'linear', name: 'Linear', icon: '📐',
    description: 'Issues, projects, and cycles',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'linear',
    authFields: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'lin_api_...', required: true }],
  },
  {
    id: 'google-docs', name: 'Google Docs', icon: '📝',
    description: 'Documents and shared drives',
    authMethod: 'oauth', supportedSurfaces: ['knowledge'],
    routeId: 'google-docs',
    authFields: [],
  },
  {
    id: 'google-sheets', name: 'Google Sheets', icon: '📊',
    description: 'Spreadsheets and structured data',
    authMethod: 'oauth', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'google-sheets',
    authFields: [],
  },
  {
    id: 'google-drive', name: 'Google Drive', icon: '📁',
    description: 'Files and folders',
    authMethod: 'oauth', supportedSurfaces: ['knowledge'],
    routeId: 'google-drive',
    authFields: [],
  },
  {
    id: 'gmail', name: 'Gmail', icon: '✉️',
    description: 'Emails and threads',
    authMethod: 'oauth', supportedSurfaces: ['knowledge', 'output'],
    routeId: 'gmail',
    authFields: [],
  },
  {
    id: 'plane', name: 'Plane', icon: '✈️',
    description: 'Issues, cycles, and modules',
    authMethod: 'api-key', supportedSurfaces: ['knowledge', 'tool'],
    routeId: 'plane',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'plane_api_...', required: true },
      { key: 'baseUrl', label: 'Instance URL', type: 'url', placeholder: 'https://app.plane.so', required: true },
    ],
  },
];

/** Get connectors filtered by surface */
export function getConnectorsForSurface(surface: ConnectorSurface): ConnectorRegistryEntry[] {
  return CONNECTOR_REGISTRY.filter(c => c.supportedSurfaces.includes(surface));
}

/** Find a connector by service id */
export function getConnectorEntry(service: string): ConnectorRegistryEntry | undefined {
  return CONNECTOR_REGISTRY.find(c => c.id === service);
}
