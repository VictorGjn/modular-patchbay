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
 * Jacks sit on the node edge, labels face outward (away from content).
 * Left gutter: jacks aligned right, labels extend left.
 * Right gutter: jacks aligned left, labels extend right.
 */
export function JackGutter({ jacks, side }: JackGutterProps) {
  if (jacks.length === 0) return null;

  const position = side === 'left' ? Position.Left : Position.Right;

  return (
    <div
      className="flex flex-col shrink-0 justify-around"
      style={{
        width: 24,
        minHeight: jacks.length * 28,
        paddingTop: 10,
        paddingBottom: 10,
        alignItems: side === 'left' ? 'flex-start' : 'flex-end',
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
