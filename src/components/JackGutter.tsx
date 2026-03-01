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
 * Narrow gutter that positions jack ports on the node border.
 * The jack circle straddles the edge (half in, half out).
 * Labels overflow outside the node bounds.
 */
export function JackGutter({ jacks, side }: JackGutterProps) {
  if (jacks.length === 0) return null;

  const position = side === 'left' ? Position.Left : Position.Right;

  return (
    <div
      className="flex flex-col shrink-0 justify-around relative"
      style={{
        width: 0,
        minHeight: jacks.length * 26,
        paddingTop: 10,
        paddingBottom: 10,
        overflow: 'visible',
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
