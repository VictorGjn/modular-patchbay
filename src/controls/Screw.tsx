// Analog mode control — reserved for future use
export function Screw({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-[10px] h-[10px] rounded-full ${className}`}
      style={{
        background: 'radial-gradient(circle at 35% 35%, #555, #222 60%, #111)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="w-full h-full rounded-full"
        style={{
          background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.1) 50%, transparent 55%)',
        }}
      />
    </div>
  );
}
