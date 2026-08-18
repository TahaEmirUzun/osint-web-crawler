// Backend API'mizin çalıştığı adres (Docker 8000 portu)
const API_BASE_URL = 'http://localhost:8000';

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Hatası: ${response.statusText}`);
  }

  return response.json();
}