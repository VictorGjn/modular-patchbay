// Analog mode control — reserved for future use
interface ToggleProps {
  value: boolean;
  label: string;
  onChange: (value: boolean) => void;
}

export function Toggle({ value, label, onChange }: ToggleProps) {
  return (
    <div className="flex items-center gap-2 select-none">
      <button
        type="button"
        className="w-[36px] h-[18px] rounded-full relative cursor-pointer transition-colors duration-200"
        style={{
          background: value ? '#FE5000' : '#333',
          boxShadow: value
            ? '0 0 6px rgba(254,80,0,0.4), inset 0 1px 2px rgba(0,0,0,0.3)'
            : 'inset 0 1px 3px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!value);
        }}
      >
        <div
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200"
          style={{
            left: value ? '19px' : '2px',
            background: 'radial-gradient(circle at 40% 35%, #eee, #bbb)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        />
      </button>
      <span className="label-engraved">{label}</span>
    </div>
  );
}
