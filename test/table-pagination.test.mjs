import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

function harness(file) {
  const mod = { exports: {} }, slots = [], effectDeps = [], cleanups = [];
  let slot = 0, effectIndex = 0, effects = [];
  const Grid = () => null;
  const react = {
    isValidElement: require('react').isValidElement,
    useState(initial) {
      const i = slot++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = slot++; return slots[i] ??= { current: initial }; },
    useCallback: (fn) => fn,
    useEffect(fn, deps) {
      const i = effectIndex++;
      if (!effectDeps[i] || deps.some((d, j) => !Object.is(d, effectDeps[i][j]))) {
        cleanups[i]?.();
        effects.push(() => { cleanups[i] = fn(); });
      }
      effectDeps[i] = deps;
    },
  };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return react;
      if (name === 'ag-grid-react') return { AgGridReact: Grid };
      if (name === 'ag-grid-community') return { AllCommunityModule: {}, themeQuartz: {} };
      if (name.endsWith('/ag-grid-table')) return { AgGridTable: Grid };
      if (name.endsWith('/ag-grid-locale')) return { arabicGridHeaders: {} };
      if (name.endsWith('/t')) return { t: (key) => key };
      if (name === 'next/link') return { default: () => null };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  return {
    Grid,
    render(props) {
      slot = 0; effectIndex = 0; effects = [];
      const element = (mod.exports.AgGridTable ?? mod.exports.CursorList)(props);
      for (const effect of effects) effect();
      return element;
    },
  };
}

function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  for (const child of [element.props?.children].flat(Infinity)) {
    const found = find(child, predicate); if (found) return found;
  }
}
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
const rows = (count) => Array.from({ length: count }, (_, id) => ({ id: String(id) }));

test('native table pagination fetches ahead once and resumes when navigating to the last loaded page', async () => {
  const h = harness('../components/tables/ag-grid-table.tsx');
  const requests = [];
  let resolve;
  let props = { gridId: 'test', rows: rows(20), columnDefs: [], nextCursor: 'next-1',
    loadMore: (cursor) => { requests.push(cursor); return new Promise((done) => { resolve = done; }); } };
  const initial = h.render(props);
  assert.equal(find(initial, (el) => el.props?.className === 'ag-grid-load-more'), undefined);
  await settle();
  h.render(props); await settle();
  assert.deepEqual(requests, ['next-1']); // Re-renders cannot duplicate a pending read.
  resolve(); await settle();
  props = { ...props, rows: rows(40), nextCursor: 'next-2' };
  const grid = find(h.render(props), (el) => el.type === h.Grid);
  grid.props.onPaginationChanged({ api: { paginationGetCurrentPage: () => 0, paginationGetTotalPages: () => 2 } });
  h.render(props); await settle();
  assert.deepEqual(requests, ['next-1']);
  grid.props.onPaginationChanged({ api: { paginationGetCurrentPage: () => 1, paginationGetTotalPages: () => 2 } });
  h.render(props); await settle();
  assert.deepEqual(requests, ['next-1', 'next-2']);
  resolve(); await settle();
  h.render({ ...props, nextCursor: null }); await settle();
  assert.equal(requests.length, 2);
});

test('a failed prefetch stops automatic retries and exposes an explicit retry', async () => {
  const h = harness('../components/tables/ag-grid-table.tsx');
  let calls = 0;
  const props = { gridId: 'test', rows: rows(1), columnDefs: [], nextCursor: 'next',
    loadMore: async () => { calls++; throw new Error('offline'); } };
  h.render(props); await settle();
  const failed = h.render(props); await settle();
  assert.equal(calls, 1);
  const retry = find(failed, (el) => el.type === 'button' && el.props.children === 'common.actions.retry');
  assert.ok(retry);
  await retry.props.onClick(); await settle();
  assert.equal(calls, 2);
});

test('a supplied actions column is the only actions column, retaining every action', () => {
  const h = harness('../components/tables/cursor-list.tsx');
  const renderer = () => 'view/edit/delete';
  const element = h.render({ gridId: 'schedules', initialItems: rows(1), initialCursor: null,
    keyOf: (row) => row.id, columnDefs: [{ field: 'id' }, { colId: 'actions', cellRenderer: renderer }],
    renderItem: () => 'old row layout', loadMore: async () => ({ items: [], nextCursor: null }) });
  assert.equal(element.props.columnDefs.filter((col) => col.colId === 'actions').length, 1);
  assert.equal(element.props.columnDefs.find((col) => col.colId === 'actions').cellRenderer, renderer);
});
