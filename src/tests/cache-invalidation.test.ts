import { describe, it, expect, vi } from 'vitest';

class SimpleMemoryCacheManager {
  private cache = new Map<string, { value: any; tags: string[] }>();

  async getOrSet<T>(key: string, fn: () => Promise<T>, tags: string[] = []): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!.value;
    }
    const fresh = await fn();
    this.cache.set(key, { value: fresh, tags });
    return fresh;
  }

  revalidateTag(tag: string) {
    for (const [key, item] of this.cache.entries()) {
      if (item.tags.includes(tag)) {
        this.cache.delete(key);
      }
    }
  }

  size() {
    return this.cache.size;
  }
}

describe('On-Demand Cache and Tag Invalidation', () => {
  it('should serve data from cache on subsequent calls without hitting backend', async () => {
    const cacheManager = new SimpleMemoryCacheManager();
    const fetchMock = vi.fn().mockResolvedValue([{ id: 'haircut', name: 'Corte de cabello' }]);

    // First call: cache miss, hits backend
    const data1 = await cacheManager.getOrSet('services-list', fetchMock, ['services']);
    expect(data1).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call: cache hit, 0 backend calls
    const data2 = await cacheManager.getOrSet('services-list', fetchMock, ['services']);
    expect(data2).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should invalidate cache when revalidateTag is called and fetch fresh data', async () => {
    const cacheManager = new SimpleMemoryCacheManager();
    let currentServices = [{ id: 'haircut', name: 'Corte de cabello' }];
    const fetchMock = vi.fn().mockImplementation(async () => currentServices);

    // Populate cache
    await cacheManager.getOrSet('services-list', fetchMock, ['services']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Admin adds a new service
    currentServices = [
      { id: 'haircut', name: 'Corte de cabello' },
      { id: 'beard', name: 'Barba' },
    ];

    // Cache should still hold old data before revalidation
    const beforeInvalidate = await cacheManager.getOrSet('services-list', fetchMock, ['services']);
    expect(beforeInvalidate).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Admin mutation triggers revalidation
    cacheManager.revalidateTag('services');

    // Next request fetches fresh data from DB
    const afterInvalidate = await cacheManager.getOrSet('services-list', fetchMock, ['services']);
    expect(afterInvalidate).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
