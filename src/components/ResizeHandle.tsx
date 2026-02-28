import { NodeResizeControl } from '@xyflow/react';
import { ArrowDownRight } from 'lucide-react';

interface ResizeHandleProps {
  minWidth?: number;
  minHeight?: number;
}

/** Bottom-right-only resize handle with diagonal arrow icon */
export function ResizeHandle({ minWidth = 200, minHeight = 100 }: ResizeHandleProps) {
  return (
    <NodeResizeControl
      minWidth={minWidth}
      minHeight={minHeight}
      position="bottom-right"
      style={{
        background: 'transparent',
        border: 'none',
        width: 16,
        height: 16,
        right: 2,
        bottom: 2,
        cursor: 'nwse-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ArrowDownRight size={12} style={{ color: '#FE5000', pointerEvents: 'none' }} />
    </NodeResizeControl>
  );
}
