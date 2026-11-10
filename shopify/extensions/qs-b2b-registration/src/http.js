import {API_BASE_URL} from './config.js';

export async function qsFetch(path, options = {}) {
  const token = await shopify.sessionToken.get();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `QuoteSnap request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}
