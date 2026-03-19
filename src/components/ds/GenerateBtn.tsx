import { Sparkles, Loader2 } from 'lucide-react';

interface GenerateBtnProps {
  loading: boolean;
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
}

export function GenerateBtn({ 
  loading, 
  onClick, 
  label = 'Generate',
  disabled = false,
  'aria-describedby': ariaDescribedBy
}: GenerateBtnProps) {
  const isDisabled = disabled || loading;
  
  return (
    <button 
      type="button" 
      onClick={(e) => { 
        e.stopPropagation(); 
        if (!isDisabled) onClick(); 
      }} 
      disabled={isDisabled} 
      aria-label={loading ? `${label} in progress` : `${label} content`}
      aria-describedby={ariaDescribedBy}
      className="flex items-center gap-1 text-[13px] px-2 py-1 rounded cursor-pointer border-none transition-opacity"
      style={{ 
        background: '#FE500015', 
        color: '#FE5000', 
        fontFamily: "'Geist Mono', monospace", 
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer'
      }}
    >
      {loading ? (
        <Loader2 
          size={9} 
          className="animate-spin motion-reduce:animate-none" 
          aria-hidden="true"
        />
      ) : (
        <Sparkles size={9} aria-hidden="true" />
      )}
      {label}
    </button>
  );
}