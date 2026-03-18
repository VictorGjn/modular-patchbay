import { useState } from 'react';
import { useTheme } from '../../theme';

interface RefineButtonProps {
  onRefine: () => Promise<void>;
}

const SUCCESS_COLOR = '#27ae60';
const ACCENT = '#FE5000';

export function RefineButton({ onRefine }: RefineButtonProps) {
  const t = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await onRefine();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Refinement failed';
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const stateColor = error ? t.statusError : success ? SUCCESS_COLOR : ACCENT;

  const btnStyles: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${stateColor}`,
    color: stateColor,
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    fontFamily: "'Geist Mono', monospace",
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s',
  };

  const label = success ? 'Done' : loading ? 'Refining…' : 'Refine';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Refine with AI"
        style={btnStyles}
      >
        {loading ? <span className="animate-spin">⟳</span> : <span>✨</span>}
        {label}
      </button>
      {error && (
        <span style={{ color: t.statusError, fontSize: 11, fontFamily: "'Geist Mono', monospace" }}>
          {error}
        </span>
      )}
    </div>
  );
}
