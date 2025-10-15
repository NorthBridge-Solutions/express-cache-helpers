'use strict';

const express = require('express');
const request = require('supertest');
const { cacheMiddleware } = require('../src/cache');

/**
 * The concurrency test below is the one that fails.
 *
 * Under concurrent load, multiple requests for the same key can all miss
 * the cache simultaneously, all execute the upstream handler, and all
 * attempt to write to the store. This is a stampede.
 *
 * Expected behavior: only ONE upstream call should happen. All other
 * concurrent requests for the same key should wait for the first one
 * and receive the same body.
 *
 * Actual behavior: the middleware's in-flight tracking doesn't actually
 * prevent concurrent upstream execution because the promise is created
 * but the upstream call hasn't been deduplicated by the time the second
 * request enters the block.
 *
 * Fix: ensure that when two requests for the same key arrive concurrently,
 * the second one awaits the SAME fillPromise that the first one created.
 * A per-key mutex or a "fill-in-progress" promise cache does the trick.
 */

describe('cacheMiddleware', () => {
  test('serves cached response on second request', async () => {
    let upstreamCalls = 0;
    const app = express();
    app.use(cacheMiddleware({ ttl: 5000 }));
    app.get('/slow', async (req, res) => {
      upstreamCalls++;
      await new Promise((r) => setTimeout(r, 100));
      res.json({ data: 'value', call: upstreamCalls });
    });

    await request(app).get('/slow');
    await request(app).get('/slow');

    expect(upstreamCalls).toBe(1);
  });

  test('handles concurrent requests without stampede', async () => {
    let upstreamCalls = 0;
    const app = express();
    app.use(cacheMiddleware({ ttl: 5000 }));
    app.get('/slow', async (req, res) => {
      upstreamCalls++;
      await new Promise((r) => setTimeout(r, 200));
      res.json({ data: 'value' });
    });

    const concurrent = Array.from({ length: 20 }, () => request(app).get('/slow'));
    await Promise.all(concurrent);

    // THE BUG: this will be > 1 because of the race condition.
    expect(upstreamCalls).toBe(1);
  });

  test('expires entries after ttl', async () => {
    let upstreamCalls = 0;
    const app = express();
    app.use(cacheMiddleware({ ttl: 50 }));
    app.get('/slow', async (req, res) => {
      upstreamCalls++;
      res.json({ data: 'value' });
    });

    await request(app).get('/slow');
    await new Promise((r) => setTimeout(r, 100));
    await request(app).get('/slow');

    expect(upstreamCalls).toBe(2);
  });
});
