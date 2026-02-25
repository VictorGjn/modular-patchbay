interface ModuleSelectProps {
  value: string;
  options: string[];
  label: string;
  onChange: (value: string) => void;
}

export function ModuleSelect({ value, options, label, onChange }: ModuleSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-engraved">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        className="text-[10px] px-2 py-1 rounded border cursor-pointer outline-none"
        style={{
          background: '#0a0a0a',
          borderColor: '#2d2720',
          color: '#FE5000',
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
