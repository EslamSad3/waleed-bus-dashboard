import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function index(owners, schedules) {
  const requests = [];
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../lib/actions/schedules.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, URLSearchParams,
    require(name) {
      if (name.endsWith('/fleet-owners')) return {
        fetchFleetOwnersPage: async (cursor) => { requests.push(['owners', cursor]); return owners(cursor); },
      };
      if (name.endsWith('/http')) return {
        apiGet: async (path) => {
          const url = new URL(path, 'http://dashboard.test');
          const owner = url.pathname.split('/')[3];
          const cursor = url.searchParams.get('cursor');
          requests.push([owner, cursor]);
          return schedules(owner, cursor);
        },
      };
      if (name.endsWith('/t')) return { t: (key) => key };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  return { fetch: loadedModule.exports.fetchSystemSchedulesPage, requests };
}

const page = (items, nextCursor = null) => ({ ok: true, data: { items, nextCursor } });

test('walks every schedule page and owner-directory page, including inactive owners', async () => {
  const { fetch, requests } = index(
    (cursor) => cursor ? page([{ id: 'c', name: 'C', isActive: false }])
      : page([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 'owners+/='),
    (owner, cursor) => owner === 'a' ? (cursor ? page([{ id: 'a2', ownerId: owner }])
      : page([{ id: 'a1', ownerId: owner }], 'schedule+/='))
      : page([{ id: owner + '1', ownerId: owner }]),
  );
  const rows = [];
  let cursor = null;
  do {
    const result = await fetch(cursor);
    assert.equal(result.ok, true);
    rows.push(...result.data.items);
    cursor = result.data.nextCursor;
  } while (cursor);
  assert.deepEqual(rows.map((s) => s.id), ['a1', 'a2', 'b1', 'c1']);
  assert.deepEqual(rows.map((s) => s.ownerName), ['A', 'A', 'B', 'C']);
  assert.deepEqual(requests, [['owners', null], ['a', null], ['a', 'schedule+/='],
    ['b', null], ['owners', 'owners+/='], ['c', null]]);
});

test('skips empty owners without hiding later results', async () => {
  const { fetch } = index(() => page([{ id: 'a' }, { id: 'b' }]),
    (owner) => page(owner === 'a' ? [] : [{ id: 'schedule-b' }]));
  const result = await fetch(null);
  assert.equal(result.data.items[0].id, 'schedule-b');
  assert.equal(result.data.nextCursor, null);
});

test('an empty directory produces a completed empty page', async () => {
  const { fetch } = index(() => page([]), () => { throw new Error('No owner to read'); });
  const result = await fetch(null);
  assert.equal(result.data.items.length, 0);
  assert.equal(result.data.nextCursor, null);
});

test('read failures are returned instead of presenting an incomplete list as complete', async () => {
  const failure = { ok: false, code: 'FORBIDDEN', message: 'Denied' };
  const directory = index(() => failure, () => page([]));
  assert.equal(await directory.fetch(null), failure);
  const owner = index(() => page([{ id: 'a' }]), () => failure);
  assert.equal(await owner.fetch(null), failure);
});

test('a malformed continuation cursor produces a controlled error', async () => {
  const { fetch, requests } = index(() => page([]), () => page([]));
  const result = await fetch('invalid-json');
  assert.equal(result.ok, false);
  assert.equal(requests.length, 0);
});
