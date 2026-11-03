export default function ProgressBar({ value, label = 'Tarama ilerlemesi', height = 6 }: { value: number; label?: string; height?: number }) {
  const percentage = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '9999px', height: `${height}px`, overflow: 'hidden' }}
    >
      <div style={{ height: '100%', backgroundColor: '#3b82f6', width: `${percentage}%`, transition: 'width 0.5s ease' }} />
    </div>
  );
}
