import { Handle, Position, useConnection } from '@xyflow/react';

interface JackProps {
  id: string;
  label: string;
  type: 'source' | 'target';
  nodeId: string;
}

export function Jack({ id, label, type }: JackProps) {
  const connection = useConnection();
  const isTarget = type === 'target';
  const position = isTarget ? Position.Left : Position.Right;
  const isConnecting = connection.inProgress;
  const isValidTarget = isTarget && isConnecting;

  return (
    <div
      className="flex items-center gap-2 relative"
      style={{
        flexDirection: isTarget ? 'row' : 'row-reverse',
      }}
    >
      <div
        className="relative w-[24px] h-[24px] rounded-full shrink-0"
        style={{
          background: 'radial-gradient(circle, #0a0a0a 40%, #555 55%, #888 60%, #555 70%, #333 100%)',
          boxShadow: isValidTarget
            ? '0 0 8px rgba(254,80,0,0.6)'
            : 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)',
          transition: 'box-shadow 0.2s',
        }}
      >
        <Handle
          type={type}
          position={position}
          id={id}
          className="!w-full !h-full !rounded-full !border-none !opacity-0 !top-0 !left-0 !transform-none !bg-transparent"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            top: 0,
            left: 0,
            transform: 'none',
          }}
        />
      </div>
      <span className="label-engraved whitespace-nowrap">{label}</span>
    </div>
  );
}
