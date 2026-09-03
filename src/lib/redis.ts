/**
 * Cliente REST ultraligero para Upstash Redis
 * Diseñado para entornos Serverless y Edge sin dependencias externas adicionales.
 * Si las credenciales no están configuradas, conmuta automáticamente a fallback seguro.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function executeRedisCommand<T = any>(command: any[]): Promise<T | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const res = await fetch(REDIS_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      // Corto timeout para no retrasar la experiencia si hay problemas de red externa
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[Redis] Respuesta no exitosa: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return data.result as T;
  } catch (err) {
    console.warn("[Redis] Fallo de conexión o timeout en comando Redis, recurriendo a fallback:", err);
    return null;
  }
}

/**
 * Adquiere un candado distribuido atómico (SET NX EX)
 * @param key Llave única del candado (ej. lock:slot:barberId:date:time)
 * @param ttlSeconds Tiempo de vida en segundos (por defecto 120s / 2min)
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number = 120
): Promise<{ success: boolean; token: string }> {
  const token = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Si Redis no está configurado, fallback permisivo: Firestore manejará la atomicidad vía runTransaction
  if (!isRedisConfigured()) {
    return { success: true, token };
  }

  const result = await executeRedisCommand<string>(["SET", key, token, "NX", "EX", ttlSeconds]);

  if (result === "OK") {
    return { success: true, token };
  }

  // Si el resultado fue null por error de red en Redis, permitimos que Firestore evalúe en su transacción
  if (result === null && !isRedisConfigured()) {
    return { success: true, token };
  }

  // Si retornó null explícitamente porque la clave ya existía (NX no cumplido)
  return { success: false, token };
}

/**
 * Libera un candado verificando la propiedad del token
 */
export async function releaseLock(key: string, token: string): Promise<boolean> {
  if (!isRedisConfigured() || !token) {
    return true;
  }

  try {
    const currentVal = await executeRedisCommand<string>(["GET", key]);
    if (currentVal === token) {
      await executeRedisCommand(["DEL", key]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Limitador de tasa básico (Rate Limiting anti-spam)
 */
export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  if (!isRedisConfigured()) {
    return { allowed: true, remaining: maxAttempts };
  }

  const key = `ratelimit:${identifier}`;
  const current = await executeRedisCommand<number>(["INCR", key]);

  if (current === null) {
    return { allowed: true, remaining: maxAttempts };
  }

  if (current === 1) {
    await executeRedisCommand(["EXPIRE", key, windowSeconds]);
  }

  return {
    allowed: current <= maxAttempts,
    remaining: Math.max(0, maxAttempts - current),
  };
}
