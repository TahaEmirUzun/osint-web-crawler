function toUtcDate(dateString: string): Date {
  // String UTC son eki içermiyorsa sonuna 'Z' ekleyerek UTC olarak parse edilmesini sağlıyoruz
  const hasZone = dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString);
  const normalized = dateString.includes('T') ? dateString : dateString.replace(' ', 'T');
  return new Date(hasZone ? normalized : `${normalized}Z`);
}

/**
 * UTC olarak gelen tarih metnini kullanıcının yerel saatine çevirir.
 */
export function formatLocalDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = toUtcDate(dateString);
  return isNaN(date.getTime()) ? dateString : date.toLocaleString('tr-TR');
}

/**
 * Yayın tarihi gibi sadece gün bilgisi önemli olan alanlar için.
 */
export function formatLocalDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = toUtcDate(dateString);
  return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('tr-TR');
}

export function toTimestamp(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  const time = toUtcDate(dateString).getTime();
  return isNaN(time) ? 0 : time;
}
