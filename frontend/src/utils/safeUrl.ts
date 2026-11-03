// Tarayıcıdan gelen içeriklerdeki bağlantılar sadece http/https ise tıklanabilir yapılır (javascript: vb. engellenir)
export function getSafeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
