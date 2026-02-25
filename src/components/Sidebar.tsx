import { MODULE_DEFS, CATEGORY_COLORS, type ModuleCategory } from '../store/moduleDefinitions';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  source: 'SOURCES',
  processor: 'PROCESSORS',
  tool: 'TOOLS',
  routing: 'ROUTING',
  output: 'OUTPUTS',
};

const CATEGORIES: ModuleCategory[] = ['source', 'processor', 'tool', 'routing', 'output'];

export function Sidebar() {
  const onDragStart = (event: React.DragEvent, moduleType: string) => {
    event.dataTransfer.setData('application/modular-type', moduleType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="w-[200px] shrink-0 overflow-y-auto border-r select-none"
      style={{
        background: 'linear-gradient(to bottom, #151210, #0f0f0f)',
        borderColor: '#2d2720',
      }}
    >
      <div className="p-3">
        <span
          className="text-[9px] tracking-[2px] uppercase block mb-3"
          style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
        >
          MODULE LIBRARY
        </span>

        {CATEGORIES.map((cat) => {
          const modules = MODULE_DEFS.filter((m) => m.category === cat);
          return (
            <div key={cat} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-[6px] h-[6px] rounded-full"
                  style={{ background: CATEGORY_COLORS[cat] }}
                />
                <span
                  className="text-[8px] tracking-[2px] uppercase font-bold"
                  style={{ fontFamily: "'Space Mono', monospace", color: CATEGORY_COLORS[cat] }}
                >
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {modules.map((mod) => (
                  <div
                    key={mod.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, mod.type)}
                    className="px-2.5 py-1.5 rounded cursor-grab active:cursor-grabbing transition-colors"
                    style={{
                      background: '#1e1a17',
                      border: '1px solid transparent',
                      fontFamily: "'Space Mono', monospace",
                      fontSize: '9px',
                      letterSpacing: '1px',
                      color: '#b5a898',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = CATEGORY_COLORS[cat];
                      e.currentTarget.style.color = '#e8e0d8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.color = '#b5a898';
                    }}
                  >
                    {mod.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
