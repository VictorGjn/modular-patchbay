import { useState } from 'react';
import { useTheme } from '../theme';
import { AgentCard } from './AgentCard';
import { AgentVizCircuit } from './AgentVizCircuit';
import { AgentVizLayers } from './AgentVizLayers';
import { BarChart3, Cpu, Layers } from 'lucide-react';

export type VizStyle = 'card' | 'circuit' | 'layers';

const VIZ_OPTIONS: { id: VizStyle; label: string; icon: typeof BarChart3 }[] = [
  { id: 'card', label: 'Card', icon: BarChart3 },
  { id: 'circuit', label: 'Circuit', icon: Cpu },
  { id: 'layers', label: 'Layers', icon: Layers },
];

export function AgentViz() {
  const t = useTheme();
  const [style, setStyle] = useState<VizStyle>('card');

  return (
    <div className="w-full">
      {/* Style picker */}
      <div className="flex items-center justify-end gap-1 px-4 py-1" style={{ background: t.surfaceElevated, borderTop: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>
          VIEW
        </span>
        {VIZ_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = style === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStyle(opt.id)}
              className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer border-none"
              style={{
                background: active ? '#FE500018' : 'transparent',
                color: active ? '#FE5000' : t.textDim,
                fontFamily: "'Space Mono', monospace",
                fontSize: 8,
                fontWeight: active ? 700 : 400,
                letterSpacing: '0.05em',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Icon size={10} />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Active viz */}
      {style === 'card' && <AgentCard />}
      {style === 'circuit' && <AgentVizCircuit />}
      {style === 'layers' && <AgentVizLayers />}
    </div>
  );
}
