'use strict';

const { deepMerge } = require('utils-helpers');

/**
 * In-memory cache middleware for Express.
 *
 * Features:
 *   - Per-key TTL
 *   - LRU eviction when max size is reached
 *   - Stampede protection via in-flight tracking
 *
 * @param {Object} opts
 * @param {number} opts.ttl        - default TTL in ms
 * @param {number} opts.max        - max number of keys
 * @param {Function} opts.keyFn    - (req) => string   cache key from request
 * @param {Function} opts.shouldCache - (req, res) => boolean
 */
function cacheMiddleware(opts) {
  const options = deepMerge({
    ttl: 60_000,
    max: 500,
    keyFn: (req) => req.originalUrl,
    shouldCache: () => true
  }, opts || {});

  const store = new Map();
  const inFlight = new Map();

  function evictIfNeeded() {
    if (store.size <= options.max) return;
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }

  return async function cache(req, res, next) {
    if (!options.shouldCache(req, res)) return next();

    const key = options.keyFn(req);
    const now = Date.now();

    const hit = store.get(key);
    if (hit && hit.expires > now) {
      res.set('X-Cache', 'HIT');
      return res.send(hit.body);
    }

    // ---- intended stampede protection ----
    // If a fill for this key is already in progress, wait for it.
    // (This is where the race condition lives — see test/cache.test.js)
    if (inFlight.has(key)) {
      const body = await inFlight.get(key);
      res.set('X-Cache', 'HIT');
      return res.send(body);
    }

    const fillPromise = (async () => {
      let captured = null;
      const origSend = res.send.bind(res);
      res.send = (body) => {
        captured = body;
        return origSend(body);
      };
      await new Promise((resolve) => {
        res.on('finish', resolve);
        next();
      });
      return captured;
    })();

    inFlight.set(key, fillPromise);
    try {
      const body = await fillPromise;
      if (body !== null && body !== undefined) {
        store.set(key, { body, expires: Date.now() + options.ttl });
        evictIfNeeded();
      }
      res.set('X-Cache', 'MISS');
    } finally {
      inFlight.delete(key);
    }
  };
}

module.exports = { cacheMiddleware };
