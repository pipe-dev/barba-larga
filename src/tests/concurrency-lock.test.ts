import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Concurrency Lock Logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fall back gracefully to true when Redis is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { acquireLock, releaseLock, isRedisConfigured } = await import('@/lib/redis');

    expect(isRedisConfigured()).toBe(false);

    const lockResult = await acquireLock('lock:slot:barber1:2026-09-03:10:00');
    expect(lockResult.success).toBe(true);
    expect(lockResult.token).toBeDefined();

    const releaseResult = await releaseLock('lock:slot:barber1:2026-09-03:10:00', lockResult.token);
    expect(releaseResult).toBe(true);
  });

  it('should acquire lock when Redis responds with OK', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'OK' }),
    });
    vi.stubGlobal('fetch', globalFetch);

    const { acquireLock } = await import('@/lib/redis');
    const lockResult = await acquireLock('lock:slot:barber1:2026-09-03:10:00');

    expect(lockResult.success).toBe(true);
    expect(globalFetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('should reject second concurrent attempt when Redis lock already exists', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

    // Mock Redis returning null on NX (Key already exists)
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    });
    vi.stubGlobal('fetch', globalFetch);

    const { acquireLock } = await import('@/lib/redis');
    const lockResult = await acquireLock('lock:slot:barber1:2026-09-03:10:00');

    expect(lockResult.success).toBe(false);

    vi.unstubAllGlobals();
  });
});
