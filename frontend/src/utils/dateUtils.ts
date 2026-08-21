/**
 * UTC olarak gelen tarih metnini Türkiye yerel saatine (UTC+3) çevirir.
 */
export function formatLocalDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  // String UTC son eki içermiyorsa sonuna 'Z' ekleyerek UTC olarak parse edilmesini sağlıyoruz
  const utcString = dateString.endsWith('Z') || dateString.includes('+') 
    ? dateString 
    : (dateString.includes('T') ? `${dateString}Z` : `${dateString.replace(' ', 'T')}Z`);

  const date = new Date(utcString);
  return isNaN(date.getTime()) ? new Date(dateString).toLocaleString('tr-TR') : date.toLocaleString('tr-TR');
}