
import { Position } from '@xyflow/react';
import { JackPort } from './JackPort';

export interface JackDef {
  id: string;
  type: 'source' | 'target';
  label: string;
  color: string;
}

interface JackGutterProps {
  jacks: JackDef[];
  side: 'left' | 'right';
}

/**
 * Vertical gutter strip for jack ports.
 * Renders a narrow column beside node content with jacks
 * evenly spaced. No node content goes in this column.
 */
export function JackGutter({ jacks, side }: JackGutterProps) {
  if (jacks.length === 0) return null;

  const position = side === 'left' ? Position.Left : Position.Right;

  return (
    <div
      className="flex flex-col items-center justify-around shrink-0"
      style={{
        width: 36,
        minHeight: jacks.length * 32,
        paddingTop: 8,
        paddingBottom: 8,
        borderLeft: side === 'right' ? '1px solid var(--gutter-border, transparent)' : undefined,
        borderRight: side === 'left' ? '1px solid var(--gutter-border, transparent)' : undefined,
      }}
    >
      {jacks.map((jack) => (
        <JackPort
          key={jack.id}
          id={jack.id}
          type={jack.type}
          position={position}
          label={jack.label}
          color={jack.color}
        />
      ))}
    </div>
  );
}
