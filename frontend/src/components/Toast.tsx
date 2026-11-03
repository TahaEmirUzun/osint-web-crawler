import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; type: ToastType; message: string };
type ToastApi = { showToast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastApi | null>(null);

// Provider dışında kullanılırsa (örn. izole testler) sessizce konsola yazar
const FALLBACK_TOAST: ToastApi = { showToast: (message: string) => console.info(message) };

const COLORS: Record<ToastType, { bg: string; fg: string; border: string }> = {
  success: { bg: '#ecfdf5', fg: '#065f46', border: '#10b981' },
  error: { bg: '#fef2f2', fg: '#991b1b', border: '#ef4444' },
  info: { bg: '#eff6ff', fg: '#1e40af', border: '#3b82f6' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" style={{ position: 'fixed', right: '1rem', bottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 2000, maxWidth: '360px' }}>
        {toasts.map(toast => {
          const color = COLORS[toast.type];
          const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertTriangle : Info;
          return (
            <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', backgroundColor: color.bg, color: color.fg, borderLeft: `4px solid ${color.border}`, padding: '0.75rem 1rem', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.875rem', textAlign: 'left' }}>
              <Icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} aria-label="Bildirimi kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.fg, padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? FALLBACK_TOAST;
}
