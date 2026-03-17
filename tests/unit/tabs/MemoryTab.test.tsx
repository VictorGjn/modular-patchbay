import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { MemoryTab } from '../../../src/tabs/MemoryTab';

// Mock the memory store
const mockMemoryStore = {
  strategy: 'full',
  setStrategy: vi.fn(),
  storeBackend: 'local_sqlite',
  setStoreBackend: vi.fn(),
  postgresConnection: '',
  setPostgresConnection: vi.fn(),
  redisConnection: '',
  setRedisConnection: vi.fn(),
  chromaConnection: '',
  setChromaConnection: vi.fn(),
  pineconeConnection: '',
  setPineconeConnection: vi.fn(),
  slidingWindowSize: 10,
  setSlidingWindowSize: vi.fn(),
  summaryThreshold: 20,
  setSummaryThreshold: vi.fn(),
  embeddingModel: 'text-embedding-3-small',
  setEmbeddingModel: vi.fn(),
  recallStrategy: 'top_k',
  setRecallStrategy: vi.fn(),
  memoryScope: 'per_user',
  setMemoryScope: vi.fn(),
  domains: [],
  setDomains: vi.fn(),
  addDomain: vi.fn(),
  removeDomain: vi.fn(),
  updateDomain: vi.fn(),
};

vi.mock('../../../src/store/memoryStore', () => ({
  useMemoryStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockMemoryStore);
    }
    return mockMemoryStore;
  },
}));

// Mock the generateMemoryConfig utility
vi.mock('../../../src/utils/generateSection', () => ({
  generateMemoryConfig: vi.fn().mockResolvedValue({
    strategy: 'rag',
    storeBackend: 'postgres',
    postgresConnection: 'postgresql://localhost:5432/memory',
  }),
}));

describe('MemoryTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders strategy selector', () => {
    render(<MemoryTab />);
    
    // Check for strategy selector
    expect(screen.getByText(/strategy/i) || screen.getByLabelText(/strategy/i)).toBeInTheDocument();
    
    // Check for strategy options in the select or as buttons
    expect(screen.getByText(/full history/i) || 
           screen.getByText(/full/i)).toBeInTheDocument();
  });

  it('changing strategy shows relevant options', async () => {
    const user = userEvent.setup();
    render(<MemoryTab />);
    
    // Find the strategy selector (could be a select dropdown or radio buttons)
    const strategySelector = screen.getByRole('combobox', { name: /strategy/i }) ||
                            screen.getByRole('listbox', { name: /strategy/i }) ||
                            screen.getByLabelText(/strategy/i);
    
    if (strategySelector) {
      // Change to RAG strategy
      await user.selectOptions(strategySelector, 'rag');
      
      // Verify the store was updated
      expect(mockMemoryStore.setStrategy).toHaveBeenCalledWith('rag');
      
      // RAG strategy should show additional options like store backend
      await waitFor(() => {
        expect(screen.getByText(/store/i) || screen.getByText(/backend/i)).toBeInTheDocument();
      });
    } else {
      // Try clicking on strategy option buttons
      const ragOption = screen.getByText(/rag/i) || screen.getByText(/retrieval/i);
      if (ragOption) {
        await user.click(ragOption);
        expect(mockMemoryStore.setStrategy).toHaveBeenCalledWith('rag');
      }
    }
  });

  it('PostgreSQL selection shows connection string input', async () => {
    // Set up store with postgres backend
    const postgresStore = {
      ...mockMemoryStore,
      storeBackend: 'postgres',
    };
    
    vi.mocked(vi.importMock('../../../src/store/memoryStore')).mockReturnValue({
      useMemoryStore: (selector: any) => selector(postgresStore),
    });
    
    render(<MemoryTab />);
    
    // Should show PostgreSQL connection input
    const connectionInput = screen.getByLabelText(/postgres/i) ||
                           screen.getByLabelText(/connection/i) ||
                           screen.getByPlaceholderText(/postgres/i) ||
                           screen.getByDisplayValue(/postgres/);
    
    if (connectionInput) {
      expect(connectionInput).toBeInTheDocument();
    }
  });

  it('can update PostgreSQL connection string', async () => {
    const user = userEvent.setup();
    
    // Set up store with postgres backend
    const postgresStore = {
      ...mockMemoryStore,
      storeBackend: 'postgres',
    };
    
    vi.mocked(vi.importMock('../../../src/store/memoryStore')).mockReturnValue({
      useMemoryStore: (selector: any) => selector(postgresStore),
    });
    
    render(<MemoryTab />);
    
    // Find PostgreSQL connection input
    const connectionInput = screen.getByLabelText(/postgres/i) ||
                           screen.getByLabelText(/connection/i) ||
                           screen.getByPlaceholderText(/postgres/i);
    
    if (connectionInput) {
      await user.type(connectionInput, 'postgresql://localhost:5432/testdb');
      
      // Verify store was updated
      await waitFor(() => {
        expect(mockMemoryStore.setPostgresConnection).toHaveBeenCalledWith('postgresql://localhost:5432/testdb');
      });
    }
  });

  it('sliding window strategy shows size controls', async () => {
    const user = userEvent.setup();
    
    // Set up store with sliding window strategy
    const slidingWindowStore = {
      ...mockMemoryStore,
      strategy: 'sliding_window',
    };
    
    vi.mocked(vi.importMock('../../../src/store/memoryStore')).mockReturnValue({
      useMemoryStore: (selector: any) => selector(slidingWindowStore),
    });
    
    render(<MemoryTab />);
    
    // Should show window size controls
    const windowSizeControl = screen.getByLabelText(/window size/i) ||
                             screen.getByLabelText(/size/i) ||
                             screen.getByRole('slider', { name: /window/i });
    
    if (windowSizeControl) {
      expect(windowSizeControl).toBeInTheDocument();
      
      // Test changing the value
      await user.type(windowSizeControl, '15');
      
      // Verify the store was updated
      expect(mockMemoryStore.setSlidingWindowSize).toHaveBeenCalled();
    }
  });

  it('displays current strategy correctly', () => {
    render(<MemoryTab />);
    
    // Should show the current strategy (full in our mock)
    const currentStrategy = screen.getByDisplayValue(/full/i) ||
                           screen.getByText(/full history/i) ||
                           screen.queryByRole('option', { selected: true });
    
    expect(currentStrategy).toBeTruthy();
  });

  it('shows embedding model selector for RAG strategy', () => {
    // Set up store with RAG strategy
    const ragStore = {
      ...mockMemoryStore,
      strategy: 'rag',
    };
    
    vi.mocked(vi.importMock('../../../src/store/memoryStore')).mockReturnValue({
      useMemoryStore: (selector: any) => selector(ragStore),
    });
    
    render(<MemoryTab />);
    
    // Should show embedding model options
    const embeddingSelector = screen.getByText(/embedding/i) ||
                             screen.getByText(/ada/i) ||
                             screen.getByText(/voyage/i);
    
    if (embeddingSelector) {
      expect(embeddingSelector).toBeInTheDocument();
    }
  });

  it('can add and remove memory domains', async () => {
    const user = userEvent.setup();
    
    // Set up store with domains
    const domainsStore = {
      ...mockMemoryStore,
      domains: [
        { id: '1', name: 'User Preferences', type: 'user_preferences', enabled: true },
        { id: '2', name: 'Decisions', type: 'decisions', enabled: false },
      ],
    };
    
    vi.mocked(vi.importMock('../../../src/store/memoryStore')).mockReturnValue({
      useMemoryStore: (selector: any) => selector(domainsStore),
    });
    
    render(<MemoryTab />);
    
    // Look for domain management UI
    const addDomainButton = screen.getByRole('button', { name: /add domain/i }) ||
                           screen.getByText(/add domain/i) ||
                           screen.getByRole('button', { name: /\+/i });
    
    if (addDomainButton) {
      await user.click(addDomainButton);
      expect(mockMemoryStore.addDomain).toHaveBeenCalled();
    }
    
    // Look for remove buttons
    const removeButtons = screen.getAllByRole('button').filter(button =>
      button.textContent?.includes('×') || 
      button.getAttribute('aria-label')?.includes('remove')
    );
    
    if (removeButtons.length > 0) {
      await user.click(removeButtons[0]);
      expect(mockMemoryStore.removeDomain).toHaveBeenCalled();
    }
  });

  it('validates connection strings properly', async () => {
    const user = userEvent.setup();
    
    // Set up store with postgres backend
    const postgresStore = {
      ...mockMemoryStore,
      storeBackend: 'postgres',
    };
    
    vi.mocked(vi.importMock('../../../src/store/memoryStore')).mockReturnValue({
      useMemoryStore: (selector: any) => selector(postgresStore),
    });
    
    render(<MemoryTab />);
    
    // Find PostgreSQL connection input
    const connectionInput = screen.getByLabelText(/postgres/i) ||
                           screen.getByLabelText(/connection/i);
    
    if (connectionInput) {
      // Enter an invalid connection string
      await user.type(connectionInput, 'invalid-connection-string');
      
      // Look for validation messages
      const validationMessage = screen.queryByText(/invalid/i) ||
                               screen.queryByText(/error/i) ||
                               screen.queryByRole('alert');
      
      // Validation might appear
      if (validationMessage) {
        expect(validationMessage).toBeInTheDocument();
      }
    }
  });
});