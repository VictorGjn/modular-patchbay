import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CliTool {
  id: string;
  name: string;
  command: string;
  description: string;
}

interface CliToolState {
  tools: CliTool[];
  addTool: (tool: Omit<CliTool, 'id'>) => void;
  removeTool: (id: string) => void;
}

export const useCliToolStore = create<CliToolState>()(
  persist(
    (set, get) => ({
      tools: [],
      addTool: (tool) => {
        const id = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set({ tools: [...get().tools, { ...tool, id }] });
      },
      removeTool: (id) => set({ tools: get().tools.filter((t) => t.id !== id) }),
    }),
    { name: 'cli-tool-store' }
  )
);
