import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

const row = { id: 'order-a', orderId: 'order-a', seats: 4, totalAmount: '600.00', passengerName: 'Passenger', status: 'CONFIRMED' };
function load(file, { rows = [row], states = [] } = {}) {
  const mod = { exports: {} }, calls = [];
  let index = 0;
  const component = () => null;
  const query = { items: rows, nextCursor: null, isLoading: false, isPending: false, error: null };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    module: mod, exports: mod.exports, URLSearchParams,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return {
        useState(initial) { const value = index < states.length ? states[index] : typeof initial === 'function' ? initial() : initial; index++; return [value, () => {}]; },
        useEffect: () => {}, useMemo: (fn) => fn(), useCallback: (fn) => fn, useTransition: () => [false, (fn) => fn()], Suspense: component,
      };
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams(), useRouter: () => ({}) };
      if (name.endsWith('/use-booking-summaries')) return { useBookingSummaries: (...args) => { calls.push(args); return query; } };
      if (name.endsWith('/queries')) return { qk: new Proxy({}, { get: () => () => [] }),
        useApiQuery: () => ({ isLoading: false }), useDataQuery: () => ({ isLoading: false }), useQueryClient: () => ({}) };
      if (name.endsWith('/t')) return { t: (key) => key };
      if (name.endsWith('/field-validation')) return { schemaErrors: () => ({}), useFieldValidation: () => ({}) };
      if (name.endsWith('/access')) return { can: (identity, key) => Boolean(identity && (identity.appRole === 'super_admin' || identity.permissions?.includes(key))) };
      if (name.endsWith('/nav-permissions')) return { canNavigate: (_access, href) => href === '/bookings' };
      if (name.endsWith('/confirm-dialog')) return { useConfirm: () => async () => false };
      if (name.endsWith('/filters')) return { useFilterStore: (fn) => fn({ setOwnerId() {} }) };
      return new Proxy({}, { get: () => component });
    },
  });
  return { api: mod.exports, calls };
}
function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  for (const child of [element.props?.children].flat(Infinity)) {
    const match = find(child, predicate); if (match) return match;
  }
}

test('bookings grid renders one booking with four seats and opens its group instead of deleting one child', () => {
  const { api } = load('../app/(shell)/bookings/page.tsx');
  const inner = api.default().props.children;
  const table = find(inner.type(inner.props), (el) => el.props?.gridId === 'bookings');
  assert.equal(table.props.rows.length, 1);
  assert.equal(table.props.rows[0].seats, 4);
  const actions = table.props.columnDefs.find((col) => col.colId === 'actions').cellRenderer({ data: row });
  assert.equal(actions.props.actions.length, 1);
  assert.equal(actions.props.actions[0].href, '/bookings?bookingId=order-a');
  const standalone = { ...row, id: 'legacy', orderId: null };
  const legacyActions = table.props.columnDefs.find((col) => col.colId === 'actions').cellRenderer({ data: standalone });
  assert.equal(legacyActions.props.actions.length, 2);
  assert.equal(legacyActions.props.actions[0].href, '/bookings/legacy');
});

test('owner booking table uses the same grouped contract and full seat totals', () => {
  const { api, calls } = load('../components/owners/owner-sections.tsx', { states: ['bookings', false] });
  const section = api.OwnerSections({ ownerId: 'owner-a', access: { appRole: 'platform_staff', permissions: ['bookings.read'] } });
  const child = find(section, (el) => el.type?.name === 'OwnerBookings');
  const table = find(child.type(child.props), (el) => el.props?.gridId === 'owner-bookings');
  assert.equal(calls[0][0].ownerId, 'owner-a');
  assert.equal(table.props.rows[0].seats, 4);
  const actions = table.props.columnDefs.find((col) => col.colId === 'actions').cellRenderer({ data: row });
  assert.equal(actions.props.actions.length, 1);
  assert.equal(actions.props.actions[0].href, '/bookings?bookingId=order-a');
});

test('overview counts a multi-seat booking once', () => {
  const { api } = load('../components/home/overview-insights.tsx');
  const page = api.OverviewInsights({ access: {} });
  const card = find(page, (el) => el.props?.label === 'home.insights.confirmedBookings');
  assert.ok(card);
  assert.equal(card.props.value, 1);
});
