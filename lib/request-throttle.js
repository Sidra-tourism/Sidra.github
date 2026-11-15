// Per-instance defence in depth for preview routes. Production also needs
// shared/distributed throttling at the ingress/WAF edge across instances.
export function createRequestThrottle({ limit, windowMs, maxEntries = 10000, now = Date.now }) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError('Invalid request throttle limits');
  }
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    // Express req.ip uses the socket peer unless trusted proxy is configured.
    // Do not take IP identities directly from client-supplied forwarding headers.
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
    let record = buckets.get(key);
    if (record && time >= record.resetAt) {
      buckets.delete(key);
      record = null;
    }
    if (!record) {
      if (buckets.size >= maxEntries) {
        for (const [ip, item] of buckets) {
          if (time >= item.resetAt) buckets.delete(ip);
        }
      }
      if (buckets.size >= maxEntries) {
        return res.status(503).set('Cache-Control', 'no-store').json({ error: 'Request capacity temporarily unavailable' });
      }
      record = { count: 0, resetAt: time + windowMs };
      buckets.set(key, record);
    }
    if (record.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - time) / 1000));
      return res.status(429).set('Retry-After', String(retryAfter)).set('Cache-Control', 'no-store').json({ error: 'Too many requests. Try again later.' });
    }
    record.count += 1;
    return next();
  };
}
