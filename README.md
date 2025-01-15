# express-cache-helpers

In-memory cache middleware for Express with TTL, LRU eviction, and stampede protection.

## Setup

    git clone https://github.com/NorthBridge-Solutions/express-cache-helpers.git
    cd express-cache-helpers
    npm install
    npm test

Requires Node 18 or newer.

## The exercise

npm test will fail on the handles concurrent requests without stampede case.
Your job: make it pass.

The middleware is supposed to deduplicate concurrent in-flight requests for the
same key so only one upstream call happens per key. It isn't doing that. Find the
bug, fix it, and add a regression test that would have caught it.

Submit by pushing your solution to your own fork and replying with the link.

## Options

| Option        | Type       | Default                  | Description                              |
|---------------|------------|--------------------------|------------------------------------------|
| ttl         | number     | 60000                  | Entry TTL in milliseconds                |
| max         | number     | 500                    | Maximum entries before LRU eviction      |
| keyFn       | function   | req => req.originalUrl | Derives the cache key from the request   |
| shouldCache | function   | () => true             | Predicate for whether to cache a request |

## Usage

    const express = require('express');
    const { cacheMiddleware } = require('express-cache-helpers');

    const app = express();

    app.use(cacheMiddleware({
      ttl: 30_000,
      max: 1000,
      keyFn: (req) => req.originalUrl
    }));

    app.get('/api/data', async (req, res) => {
      const data = await fetchFromUpstream();
      res.json(data);
    });

    app.listen(3000);

## Contributing

PRs welcome. Please run npm test before opening a PR.

## License

MIT
