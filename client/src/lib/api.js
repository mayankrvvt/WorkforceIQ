import { firebaseAuth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const user = firebaseAuth.currentUser;
  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || 'Request failed');
  }

  return body;
}
