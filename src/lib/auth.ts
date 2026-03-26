export interface SessionUser {
  username: string;
  rol: 'admin' | 'viewer';
}

const SESSION_KEY = 'ventas_pro_session';

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.rol === 'admin';
}
