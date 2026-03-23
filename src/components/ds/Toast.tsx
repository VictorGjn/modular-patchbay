import { useToastStore, type Toast, type ToastType } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.4)', icon: '#16a34a' },
  error: { bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.4)', icon: '#dc2626' },
  warning: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.4)', icon: '#ca8a04' },
  info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)', icon: '#3b82f6' },
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const colors = COLORS[toast.type];
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: '#f0f0f0',
        minWidth: 240,
        maxWidth: 380,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ color: colors.icon, flexShrink: 0, marginTop: 1 }}>{ICONS[toast.type]}</span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="flex items-center justify-center w-5 h-5 rounded cursor-pointer border-none bg-transparent shrink-0 opacity-60 hover:opacity-100"
        style={{ color: '#f0f0f0' }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 flex flex-col gap-2"
      style={{ zIndex: 9999 }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
