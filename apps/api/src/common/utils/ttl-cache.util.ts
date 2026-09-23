/**
 * Tiny in-process cache for small, hot, read-mostly documents (tenants, API keys).
 *
 * Every API request used to re-read the same tenant/subscription rows from MongoDB
 * several times. A few seconds of staleness is harmless for those, and it removes the
 * large majority of the database round-trips on the request path.
 *
 * Deliberately per-process and unbounded-in-time only by `maxEntries`: if the app is ever
 * scaled to several processes, each keeps its own copy and entries expire within `ttlMs`.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    // Cheap bound: drop the oldest insertions once the map grows past the limit.
    if (this.store.size >= this.maxEntries) {
      const iterator = this.store.keys();
      for (let i = 0; i < Math.ceil(this.maxEntries / 10); i += 1) {
        const oldest = iterator.next();
        if (oldest.done) break;
        this.store.delete(oldest.value);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Returns the cached value, or computes, stores and returns it. */
  async wrap(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value);
    return value;
  }

  invalidate(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}
