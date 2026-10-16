import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, { states = [], data, error, actions = {} } = {}) {
  const mod = { exports: {} }, calls = [];
  let index = 0;
  const component = () => null;
  const cursor = () => null;
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return { useState(initial) { const value = index < states.length ? states[index] : typeof initial === 'function' ? initial() : initial; index++; return [value, () => {}]; }, useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {} };
      if (name.endsWith('/queries')) return { qk: new Proxy({}, { get: (_, key) => (...args) => [key, ...args] }), useApiQuery: (key, fetcher, options) => { calls.push({ key, fetcher, options }); return { data, error, isLoading: false }; }, useApiInfiniteQuery: (key, fetcher, options) => { calls.push({ key, fetcher, options }); return { error, isLoading: false }; }, useQueryClient: () => ({}) };
      if (name.endsWith('/filters')) return { useFilterStore: fn => fn({ ownerId: 'filter-owner' }) };
      if (name.endsWith('/cursor-list')) return { CursorList: cursor };
      if (name.endsWith('/confirm-dialog')) return { useConfirm: () => () => {} };
      if (name.endsWith('/t')) return { t: key => key };
      if (name.endsWith('/utils')) return { cn: () => '' };
      if (name.includes('/actions/')) return actions;
      return new Proxy({}, { get: () => component });
    },
  });
  return { api: mod.exports, calls, cursor };
}
function find(element, type) {
  if (!element || typeof element !== 'object') return undefined;
  if (element.type === type) return element;
  for (const child of [element.props?.children].flat(Infinity)) { const match = find(child, type); if (match) return match; }
}
test('trip editor loads full detail from the row owner and line before mounting its form', async () => {
  const requests = [];
  const detail = { id: 'trip', ownerId: 'actual-owner', lineId: 'actual-line', stops: [{ name: 'A', stopOrder: 1 }], pricingEnabled: true };
  const { api, calls } = load('../components/trips/edit-trip-dialog.tsx', { data: detail, actions: { fetchTrip: async (...args) => { requests.push(args); return { ok: true, data: detail }; } } });
  const loader = api.EditTripDialog({ open: true, trip: { id: 'trip', ownerId: 'actual-owner', lineId: 'actual-line' }, lineId: 'filter-line', onClose() {} });
  const editor = loader.type(loader.props);
  await calls[0].fetcher();
  assert.deepEqual(requests[0], ['actual-owner', 'actual-line', 'trip']);
  assert.equal(editor.props.trip.stops, detail.stops);
  assert.equal(editor.props.trip.pricingEnabled, true);
});
test('trip editor shows loading or failure without mounting an editable form', () => {
  for (const error of [undefined, new Error('detail failed')]) {
    const { api } = load('../components/trips/edit-trip-dialog.tsx', { error });
    const props = { open: true, trip: { id: 'trip', ownerId: 'owner', lineId: 'line' }, lineId: 'line', onClose() {} };
    const loader = api.EditTripDialog(props);
    const dialog = loader.type(loader.props);
    assert.equal(dialog.props.children.props.role, error ? 'alert' : 'status');
    assert.equal(api.EditTripDialog({ ...props, open: false }), null);
  }
});
test('audit predicate applies to later pages without filtering the supplied first page', () => {
  const row = { id: 'one', action: 'match', resource: 'trip', success: true };
  const { api, cursor } = load('../app/(shell)/audit/page.tsx', { states: ['match', 'success', null], data: { items: [row], nextCursor: 'next' } });
  const list = find(api.default(), cursor);
  assert.equal(list.props.initialItems[0], row);
  assert.equal(list.props.filter({ id: 'later', action: 'match', resource: 'trip', success: false }), false);
  assert.equal(list.props.filter({ id: 'later', action: 'other', resource: 'trip', success: true }), false);
  assert.equal(list.props.filter({ id: 'later', action: 'match', resource: 'trip', success: true }), true);
});
test('schedule list spans all owners and filters subsequent rows', () => {
  const { api, cursor } = load('../app/(shell)/schedules/page.tsx', { states: ['cairo', false, null, null, null], data: { items: [], nextCursor: 'next' } });
  const list = find(api.default(), cursor);
  assert.equal(list.props.scopeKey, 'all-owners');
  assert.equal(list.props.filter({ line: { name: 'Alex' }, bus: {}, driver: null }), false);
  assert.equal(list.props.filter({ line: { name: 'Cairo' }, bus: {}, driver: null }), true);
  assert.equal(list.props.filter({ ownerName: 'Cairo owner', line: { name: 'Alex' }, bus: {}, driver: null }), true);
});

test('generated trips use the shared cache scoped to the owner, line and schedule', async () => {
  const schedule = { id: 'schedule-a', ownerId: 'owner-a', lineId: 'line-a', line: { name: 'A' }, bus: {} };
  const requests = [];
  const { api, calls } = load('../app/(shell)/schedules/page.tsx', {
    states: ['', false, null, schedule, null],
    actions: { fetchScheduleTrips: async (...args) => { requests.push(args); return { ok: true, data: { items: [], nextCursor: null } }; } },
  });
  const page = api.default();
  const occurrence = page.props.children.find((child) => child?.type?.name === 'OccurrencesDialog');
  occurrence.type(occurrence.props);
  assert.deepEqual(Array.from(calls[1].key), ['scheduleTrips', 'owner-a', 'line-a', 'schedule-a']);
  assert.equal(calls[1].options.staleTime, 300_000);
  await calls[1].fetcher('next-page');
  assert.deepEqual(requests[0], ['owner-a', 'line-a', 'schedule-a', 'next-page']);
});
