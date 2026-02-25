import { useRef } from 'react';
import { usePatchStore } from '../store/patchStore';
import { exportPatch, importPatch } from '../utils/serialization';
import { executePatch } from '../execution/executor';

export function Topbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nodes = usePatchStore((s) => s.nodes);
  const edges = usePatchStore((s) => s.edges);
  const moduleConfigs = usePatchStore((s) => s.moduleConfigs);
  const running = usePatchStore((s) => s.execution.running);
  const clearAll = usePatchStore((s) => s.clearAll);
  const autoLayout = usePatchStore((s) => s.autoLayout);
  const setNodes = usePatchStore((s) => s.setNodes);
  const setEdges = usePatchStore((s) => s.setEdges);
  const setModuleConfigs = usePatchStore((s) => s.setModuleConfigs);

  const handleExport = () => {
    const json = exportPatch(nodes, edges, moduleConfigs);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patch.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const patch = importPatch(ev.target?.result as string);
        setNodes(patch.nodes);
        setEdges(patch.edges);
        setModuleConfigs(patch.moduleConfigs);
      } catch {
        // Invalid file
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRun = () => {
    if (!running) {
      executePatch();
    }
  };

  return (
    <div
      className="h-[48px] flex items-center px-4 gap-3 shrink-0 border-b select-none"
      style={{
        background: 'linear-gradient(to bottom, #1e1a17, #151210)',
        borderColor: '#2d2720',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div
          className="w-[8px] h-[8px] rounded-full"
          style={{ background: '#FE5000', boxShadow: '0 0 8px rgba(254,80,0,0.5)' }}
        />
        <span
          className="text-[13px] font-bold tracking-[4px] uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: '#e8e0d8' }}
        >
          MODULAR
        </span>
        <span
          className="text-[9px] tracking-[2px] uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
        >
          PATCHBAY
        </span>
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <TopbarButton onClick={clearAll} label="CLEAR" />
      <TopbarButton onClick={autoLayout} label="LAYOUT" />
      <TopbarButton onClick={handleExport} label="EXPORT" />
      <TopbarButton onClick={handleImport} label="IMPORT" />

      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="px-3 py-1.5 rounded text-[10px] font-bold tracking-[2px] uppercase cursor-pointer border-none transition-all"
        style={{
          fontFamily: "'Space Mono', monospace",
          background: running ? '#CC4000' : '#FE5000',
          color: '#fff',
          boxShadow: running ? '0 0 12px rgba(254,80,0,0.6)' : '0 0 8px rgba(254,80,0,0.3)',
          opacity: running ? 0.7 : 1,
        }}
      >
        {running ? '● RUN' : '▶ RUN'}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function TopbarButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded text-[9px] tracking-[2px] uppercase cursor-pointer border transition-colors"
      style={{
        fontFamily: "'Space Mono', monospace",
        background: 'transparent',
        borderColor: '#2d2720',
        color: '#b5a898',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#FE5000';
        e.currentTarget.style.color = '#FE5000';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#2d2720';
        e.currentTarget.style.color = '#b5a898';
      }}
    >
      {label}
    </button>
  );
}
