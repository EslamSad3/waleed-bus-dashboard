import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { QueryClient, InfiniteQueryObserver } from '@tanstack/react-query';

const mod = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../lib/queries.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, {
  module: mod, exports: mod.exports,
  require(name) {
    if (name === '@tanstack/react-query') return { useInfiniteQuery: (options) => options };
    if (name.endsWith('/http')) return {};
    throw new Error('Unexpected dependency: ' + name);
  },
});
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };

test('infinite list helpers preserve the app default cache freshness unless overridden', () => {
  const options = mod.exports.useApiInfiniteQuery(['bookings'], async () => ({ ok: true, data: { items: [], nextCursor: null } }), { enabled: true });
  assert.equal(Object.hasOwn(options, 'staleTime'), false);
  assert.equal(options.enabled, true);
});

test('reopening generated trips reuses every cached page; mutations invalidate it', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const requests = [];
  const key = mod.exports.qk.scheduleTrips('owner-a', 'line-a', 'schedule-a');
  const options = mod.exports.useApiInfiniteQuery(key, async (cursor) => {
    requests.push(cursor);
    return { ok: true, data: { items: [{ id: cursor ?? 'first' }], nextCursor: cursor ? null : 'second' } };
  }, { staleTime: 300_000 });
  try {
    const first = new InfiniteQueryObserver(client, options);
    const close = first.subscribe(() => {});
    await settle();
    await first.fetchNextPage();
    close();
    assert.deepEqual(requests, [null, 'second']);

    const reopened = new InfiniteQueryObserver(client, options);
    const closeAgain = reopened.subscribe(() => {});
    await settle();
    assert.deepEqual(requests, [null, 'second']);
    assert.equal(reopened.getCurrentResult().data.pages.length, 2);
    assert.equal(reopened.getCurrentResult().hasNextPage, false);
    closeAgain();

    await client.invalidateQueries({ queryKey: ['schedule-trips', 'owner-a', 'line-a'] });
    const afterMutation = new InfiniteQueryObserver(client, options);
    const cleanup = afterMutation.subscribe(() => {});
    await settle();
    assert.deepEqual(requests, [null, 'second', null, 'second']);
    cleanup();
  } finally { client.clear(); }
});
