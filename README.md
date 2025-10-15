# utils-helpers

Small utility helpers with no dependencies.

## Install

npm install utils-helpers

## Usage

const { deepMerge, debounce, memoize } = require('utils-helpers');

const cfg = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
// => { a: 1, b: { c: 2, d: 3 } }

const onResize = debounce(() => console.log('resized'), 200);

const fib = memoize((n) => n < 2 ? n : fib(n - 1) + fib(n - 2));

## License

MIT
