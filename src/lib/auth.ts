import { cookies } from 'next/headers';
import crypto from 'crypto';

const AUTH_COOKIE_NAME = 'barba_larga_auth';
const SESSION_SECRET = process.env.ADMIN_PASSWORD || 'Ergo-ñia-super-secret-key-2026';

export interface SessionData {
  role: 'admin' | 'barber';
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

export function createToken(role: 'admin' | 'barber'): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const data = JSON.stringify({ role, exp });
  const base64Data = Buffer.from(data).toString('base64url');
  const signature = sign(base64Data);
  return `${base64Data}.${signature}`;
}

export function verifyToken(token?: string): { valid: boolean; role?: 'admin' | 'barber' } {
  if (!token) return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };

  const [base64Data, signature] = parts;
  const expectedSignature = sign(base64Data);

  if (signature !== expectedSignature) {
    return { valid: false };
  }

  try {
    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf8');
    const data: SessionData = JSON.parse(jsonStr);

    if (data.exp < Date.now()) {
      return { valid: false }; // Expired
    }

    if (data.role !== 'admin' && data.role !== 'barber') {
      return { valid: false };
    }

    return { valid: true, role: data.role };
  } catch {
    return { valid: false };
  }
}

export async function setAuthCookie(role: 'admin' | 'barber') {
  const token = createToken(role);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getServerSession(): Promise<{ isAuthenticated: boolean; role?: 'admin' | 'barber' }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const result = verifyToken(token);
  return {
    isAuthenticated: result.valid,
    role: result.role,
  };
}

export async function requireAdminSession(): Promise<void> {
  const session = await getServerSession();
  if (!session.isAuthenticated || session.role !== 'admin') {
    throw new Error('ACCESO DENEGADO: Requiere permisos de administrador.');
  }
}

export async function requireAuthSession(): Promise<{ role: 'admin' | 'barber' }> {
  const session = await getServerSession();
  if (!session.isAuthenticated || !session.role) {
    throw new Error('ACCESO DENEGADO: Debes iniciar sesión para realizar esta acción.');
  }
  return { role: session.role };
}
