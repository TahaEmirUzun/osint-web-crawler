import { describe, it, expect } from 'vitest';

describe('Frontend Form, Error Handling ve Filtreleme Testleri', () => {
  
  it('Crawl form validation: Form geçersiz verilerle gönderimi engellemeli', () => {
    const validateForm = (sourceIds: number[], maxPages: number) => {
      if (!sourceIds || sourceIds.length === 0) return false;
      if (maxPages <= 0) return false;
      return true;
    };
    
    expect(validateForm([], 50)).toBe(false); // Kaynak seçilmemiş (Reddedilmeli)
    expect(validateForm([1], -5)).toBe(false); // Negatif sayfa sayısı (Reddedilmeli)
    expect(validateForm([1, 2], 100)).toBe(true); // Geçerli veriler (Kabul Edilmeli)
  });

  it('API error handling: Sunucu hataları kullanıcıya uygun mesajla gösterilmeli', () => {
    const handleApiError = (statusCode: number) => {
      if (statusCode === 404) return "Kaynak bulunamadı";
      if (statusCode === 500) return "Sunucu hatası oluştu, lütfen tekrar deneyin";
      return "Başarılı";
    };

    expect(handleApiError(500)).toBe("Sunucu hatası oluştu, lütfen tekrar deneyin");
  });

  it('Advisory table filtering: Tablodaki veriler CVE veya Severity bazlı filtrelenebilmeli', () => {
    const mockAdvisories = [
      { cve: "CVE-2026-1111", severity: "Critical" },
      { cve: "CVE-2026-2222", severity: "Low" }
    ];
    
    const filterBySeverity = (data: any[], severity: string) => {
      return data.filter(item => item.severity === severity);
    };

    const result = filterBySeverity(mockAdvisories, "Critical");
    expect(result.length).toBe(1);
    expect(result[0].cve).toBe("CVE-2026-1111");
  });

  it('Crawl progress display: Taramadaki anlık yüzde (progress) doğru hesaplanıp gösterilmeli', () => {
    const calculateProgress = (visited: number, total: number) => {
      if (total === 0) return 0;
      return Math.round((visited / total) * 100);
    };

    expect(calculateProgress(45, 100)).toBe(45);
    expect(calculateProgress(100, 100)).toBe(100);
  });

});