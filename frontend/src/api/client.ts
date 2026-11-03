// Backend API adresi Docker/ortam değişkeninden okunur (varsayılan: 8000 portu)
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'İstek geçersiz.',
  404: 'İstenen kayıt bulunamadı.',
  409: 'Kayıt çakışması oluştu.',
  413: 'Gönderilen veri çok büyük.',
  422: 'Girilen bilgiler doğrulanamadı.',
  500: 'Sunucu hatası oluştu, lütfen tekrar deneyin.',
  503: 'Servis şu anda kullanılamıyor.',
};

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = FALLBACK_MESSAGES[response.status] || `API Hatası (HTTP ${response.status})`;
  try {
    const body = await response.json();
    if (body?.error) {
      code = body.error.code || code;
      message = body.error.message || message;
      const firstDetail = body.error.details?.[0];
      if (firstDetail?.message) {
        message = `${message} ${firstDetail.field ? `${firstDetail.field}: ` : ''}${firstDetail.message}`;
      }
    }
  } catch {
    // Gövde JSON değilse varsayılan mesaj kullanılır
  }
  return new ApiError(response.status, code, message);
}

export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamadı. Backend çalışıyor mu?');
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(endpoint, options);
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Beklenmeyen bir hata oluştu.';
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}
