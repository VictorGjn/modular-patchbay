import { Play } from 'lucide-react';
import { useTheme } from '../../theme';

interface FloatingRunButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

const BUTTON_SIZE = 56;
const BUTTON_POSITION = 24;
const FOOTER_OFFSET = 88; // 80px footer + 8px margin

const buttonStyles = {
  position: 'fixed' as const,
  bottom: FOOTER_OFFSET,
  right: BUTTON_POSITION,
  width: BUTTON_SIZE,
  height: BUTTON_SIZE,
  borderRadius: '50%',
  background: '#FE5000',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(254, 80, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
};

export function FloatingRunButton({ onClick, isVisible }: FloatingRunButtonProps) {
  const t = useTheme();

  if (!isVisible) return null;

  return (
    <button
      type="button"
      aria-label="Switch to Test tab and start testing"
      onClick={onClick}
      style={buttonStyles}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(254, 80, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(254, 80, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
      }}
      onFocus={e => {
        e.currentTarget.style.outline = `2px solid ${t.isDark ? '#FF6B1A' : '#FE5000'}`;
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={e => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      <Play 
        size={24} 
        fill="#fff"
        color="#fff"
        aria-hidden="true"
      />
    </button>
  );
}