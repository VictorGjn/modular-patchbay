import type { ReactNode } from 'react';
import type { ModuleCategory } from '../store/moduleDefinitions';
import { CATEGORY_HEADER_STYLES, CATEGORY_COLORS } from '../store/moduleDefinitions';
import { LEDIndicator } from '../controls/LEDIndicator';
import { Screw } from '../controls/Screw';
import { usePatchStore, type LedState } from '../store/patchStore';

interface BaseModuleProps {
  id: string;
  label: string;
  category: ModuleCategory;
  minWidth: number;
  children: ReactNode;
}

export function BaseModule({ id, label, category, minWidth, children }: BaseModuleProps) {
  const ledState = usePatchStore((s) => s.execution.ledStates[id] ?? 'idle') as LedState;
  const removeModule = usePatchStore((s) => s.removeModule);

  return (
    <div
      className="module-panel"
      style={{ minWidth }}
    >
      {/* Corner screws */}
      <Screw className="absolute top-[5px] left-[5px] z-10" />
      <Screw className="absolute top-[5px] right-[5px] z-10" />
      <Screw className="absolute bottom-[5px] left-[5px] z-10" />
      <Screw className="absolute bottom-[5px] right-[5px] z-10" />

      {/* Header */}
      <div
        className="module-header"
        style={{ background: CATEGORY_HEADER_STYLES[category] }}
      >
        <LEDIndicator state={ledState} />
        <span className="module-title">{label}</span>
        <div
          className="w-[6px] h-[6px] rounded-full"
          style={{ background: CATEGORY_COLORS[category] }}
        />
        <button
          type="button"
          className="ml-1 text-[10px] leading-none opacity-40 hover:opacity-100 hover:text-red-400 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            removeModule(id);
          }}
          title="Remove module"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="module-body">
        {children}
      </div>
    </div>
  );
}
