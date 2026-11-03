export const SEVERITY_OPTIONS = [
  { value: 'Critical', label: 'Kritik' },
  { value: 'High', label: 'Yüksek' },
  { value: 'Medium', label: 'Orta' },
  { value: 'Low', label: 'Düşük' },
  { value: 'Unknown', label: 'Bilinmiyor' },
];

export function normalizeSeverity(severity: string | null | undefined): string {
  const sev = (severity || '').toLowerCase();
  if (sev.includes('critical') || sev.includes('kritik')) return 'Critical';
  if (sev.includes('high') || sev.includes('yüksek')) return 'High';
  if (sev.includes('medium') || sev.includes('orta')) return 'Medium';
  if (sev.includes('low') || sev.includes('düşük')) return 'Low';
  return 'Unknown';
}

const STYLES: Record<string, { bg: string; color: string }> = {
  Critical: { bg: '#fee2e2', color: '#b91c1c' },
  High: { bg: '#ffedd5', color: '#c2410c' },
  Medium: { bg: '#fef3c7', color: '#a16207' },
  Low: { bg: '#dbeafe', color: '#1d4ed8' },
  Unknown: { bg: '#f1f5f9', color: '#475569' },
};

export default function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  const key = normalizeSeverity(severity);
  const label = SEVERITY_OPTIONS.find(option => option.value === key)?.label ?? 'Bilinmiyor';
  return (
    <span style={{ backgroundColor: STYLES[key].bg, color: STYLES[key].color, padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}
