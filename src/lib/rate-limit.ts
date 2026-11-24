/**
 * Fixed-window, in-memory counter per key. Single process only; resets on restart.
 * `hit` records one request and returns false once the key is over `max` in the window.
 */
export function createRateLimiter(opts: { max: number; windowMs: number }) {
  const hits = new Map<string, { n: number; start: number }>();
  let lastSweep = Date.now();
  return {
    hit(key: string): boolean {
      const now = Date.now();
      if (now - lastSweep > opts.windowMs) {
        for (const [k, v] of hits) if (now - v.start >= opts.windowMs) hits.delete(k);
        lastSweep = now;
      }
      const cur = hits.get(key);
      if (!cur || now - cur.start >= opts.windowMs) {
        hits.set(key, { n: 1, start: now });
        return true;
      }
      cur.n++;
      return cur.n <= opts.max;
    },
  };
}
