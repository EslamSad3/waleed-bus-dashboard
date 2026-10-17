import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { can } from '../lib/access.ts';
import * as fares from '../lib/line-fares.ts';
const require = createRequire(import.meta.url);
function load(file, identity, { states = [], queryData, actions } = {}) {
  let stateIndex = 0;
  const mod = { exports: {} };
  const symbols = new Map();
  const symbol = name => { if (!symbols.has(name)) symbols.set(name, () => null); return symbols.get(name); };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, { module: mod, exports: mod.exports,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return { useState: initial => [stateIndex < states.length ? states[stateIndex++] : (stateIndex++, typeof initial === 'function' ? initial() : initial), () => {}], useMemo: fn => fn(), useRef: value => ({ current: value }) };
      if (name.endsWith('/use-dashboard-access')) return { useDashboardAccess: () => identity };
      if (name.endsWith('/access')) return { can };
      if (name.endsWith('/queries')) return { qk: new Proxy({}, { get: (_, key) => (...args) => [key, ...args] }), upsertInCursorList() {}, useQueryClient: () => ({ invalidateQueries() {} }), useApiQuery: key => ({ data: queryData ? queryData(key) : { items: [], nextCursor: null } }) };
      if (name.endsWith('/field-validation')) return { useFieldValidation: () => ({ validate: () => true, reset() {} }), ValidationScope: symbol('ValidationScope') };
      if (name.endsWith('/confirm-dialog')) return { useConfirm: () => () => {} };
      if (name.endsWith('/line-fares')) return fares;
      if (name.endsWith('/actions/trip-lines') && actions) return actions;
      if (name === 'sonner') return { toast: { success() {}, error() {} } };
      if (name.endsWith('/t')) return { t: key => key };
      return new Proxy({}, { get: (_, key) => symbol(key) });
    },
  });
  return { api: mod.exports, symbols };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
for (const identity of [null, { appRole: 'platform_staff', permissions: ['fleet-owners.read'] }]) {
  test(`owner list is read-only with ${identity ? 'read permission' : 'session still loading'}`, () => {
    const h = load('../app/(shell)/fleet-owners/page.tsx', identity);
    const tree = h.api.default();
    assert.equal(nodes(tree).some(n => n.props?.children === 'fleetOwners.newOwner'), false);
    const list = nodes(tree).find(n => n.type === h.symbols.get('CursorList'));
    const row = list.props.renderItem({ id: 'owner', name: 'Owner' });
    assert.deepEqual(Array.from(row.props.actions, a => a.label), ['common.actions.openDetails']);
  });
}
test('owner mutations are independently gated for platform staff and all remain available to super admins', () => {
  for (const [identity, labels, create] of [
    [{ appRole: 'platform_staff', permissions: ['fleet-owners.update'] }, ['common.actions.openDetails', 'common.actions.edit'], false],
    [{ appRole: 'platform_staff', permissions: ['fleet-owners.delete', 'fleet-owners.create'] }, ['common.actions.openDetails', 'common.actions.delete'], true],
    [{ appRole: 'super_admin', permissions: [] }, ['common.actions.openDetails', 'common.actions.edit', 'common.actions.delete'], true],
  ]) {
    const h = load('../app/(shell)/fleet-owners/page.tsx', identity);
    const tree = h.api.default();
    assert.equal(nodes(tree).some(n => n.props?.children === 'fleetOwners.newOwner'), create);
    const list = nodes(tree).find(n => n.type === h.symbols.get('CursorList'));
    assert.deepEqual(Array.from(list.props.renderItem({ id: 'owner', name: 'Owner' }).props.actions, a => a.label), labels);
  }
});
test('fare reader has no editable matrix or save control without fares.update', () => {
  const h = load('../components/trip-lines/line-fares-editor.tsx', { appRole: 'platform_staff', permissions: ['fleet-owners.lines.read'] });
  const table = { pricingRevision: 3, pairs: [], fares: [] };
  const tree = h.api.LineFaresEditor({ ownerId: 'owner', lineId: 'line', table, onReload() {} });
  assert.equal(nodes(tree).find(n => n.type === h.symbols.get('FareMatrix')).props.readOnly, true);
  assert.equal(nodes(tree).some(n => n.props?.children?.includes?.('pricing.saveAll')), false);
});
test('fare writer retains revision-aware editable matrix', () => {
  const h = load('../components/trip-lines/line-fares-editor.tsx', { appRole: 'platform_staff', permissions: ['fares.update'] });
  const table = { pricingRevision: 3, pairs: [], fares: [] };
  const tree = h.api.LineFaresEditor({ ownerId: 'owner', lineId: 'line', table, onReload() {} });
  assert.equal(nodes(tree).find(n => n.type === h.symbols.get('FareMatrix')).props.readOnly, false);
  assert.equal(nodes(tree).some(n => n.props?.children?.includes?.('pricing.saveAll')), true);
});

const stops = [
  { key: 'a', stop: { id: 'a', name: 'A' }, stopType: 'BOARDING' },
  { key: 'b', stop: { id: 'b', name: 'B' }, stopType: 'LANDING' },
];
for (const writable of [false, true]) {
  test(`line creation ${writable ? 'includes' : 'omits'} fares according to the operator permission`, async () => {
    const sent = [];
    const identity = { appRole: 'platform_staff', permissions: ['fleet-owners.lines.create', ...(writable ? ['fares.update'] : [])] };
    const h = load('../components/trip-lines/create-trip-line-dialog.tsx', identity, {
      states: ['', 'New line', '', '', stops, { 'a:b': '25.00' }], queryData: () => [],
      actions: { createOwnerTripLine: async (...args) => { sent.push(args); return { ok: true, data: { id: 'line' } }; } },
    });
    const tree = h.api.CreateTripLineDialog({ open: true, lockedOwnerId: 'owner', onClose() {} });
    nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    await new Promise(setImmediate);
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], 'owner');
    assert.equal('fares' in sent[0][1], writable);
    if (writable) assert.equal(sent[0][1].fares[0].unitFare, '25.00');
  });
}
test('line metadata edits succeed without adding a fare write', async () => {
  const sent = [];
  const line = { id: 'line', ownerId: 'owner', name: 'Original', code: null, isActive: true,
    stops: stops.map((s, i) => ({ id: s.key, station: s.stop, stationId: s.stop.id, stopType: s.stopType, stopOrder: i + 1 })) };
  const prices = { 'a:b': '25.00' };
  const table = { pricingRevision: 3, pairs: [{ boardingStationId: 'a', landingStationId: 'b' }], fares: [{ boardingStationId: 'a', landingStationId: 'b', unitFare: '25.00' }] };
  const h = load('../components/trip-lines/edit-trip-line-dialog.tsx', { appRole: 'platform_staff', permissions: ['fleet-owners.lines.update'] }, {
    states: ['Changed', '', '', true, stops, stops, prices, table, prices, '', null],
    queryData: key => key[0] === 'line-fares' ? table : key[0] === 'tripLine' ? line : [],
    actions: { updateOwnerTripLine: async (...args) => { sent.push(args); return { ok: true, data: line }; } },
  });
  const loader = h.api.EditTripLineDialog({ line, onClose() {} });
  const editor = loader.type(loader.props);
  const tree = editor.type(editor.props);
  const save = nodes(tree).find(n => n.props?.onClick && n.props.children === 'common.actions.saveChanges');
  await save.props.onClick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0][2].name, 'Changed');
  assert.equal('fares' in sent[0][2], false);
});
