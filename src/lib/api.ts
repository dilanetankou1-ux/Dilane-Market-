let authToken: string | null = null;

try {
  authToken = sessionStorage.getItem('dilane_market_token');
} catch {
  authToken = null;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  try {
    if (token) {
      sessionStorage.setItem('dilane_market_token', token);
    } else {
      sessionStorage.removeItem('dilane_market_token');
    }
  } catch {
    // Ignore storage restriction
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiRequest<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erreur serveur (${res.status})`);
  }
  return data as T;
}
