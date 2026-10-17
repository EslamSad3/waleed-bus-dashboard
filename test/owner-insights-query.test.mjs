import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

// Hermetic: transpile the real lib/actions/insights.ts, stub @/lib/actions/http
// so no fetch/cookies/backend are involved. apiGet just records what it got.
globalThis.__insightsApiCalls = [];
const actions = new URL('../lib/actions/', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(actions) && specifier === '@/lib/actions/http') {
      return { url: 'insights-test:http', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'insights-test:http') {
      return {
        format: 'module',
        source:
          'export const apiGet = async (path, ownerId) => { globalThis.__insightsApiCalls.push({ path, ownerId }); return { ok: true, data: null }; };',
        shortCircuit: true,
      };
    }
    if (url.startsWith(actions) && url.endsWith('.ts')) {
      return {
        format: 'module',
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText,
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { insightsQuery, fetchOwnerInsights } = await import('../lib/actions/insights.ts');

test('insightsQuery asks for all time with period=all', () => {
  assert.equal(insightsQuery({ kind: 'all' }), '?period=all');
});

test('insightsQuery serializes an inclusive from/to range', () => {
  assert.equal(insightsQuery({ kind: 'range', from: '2026-10-01', to: '2026-10-16' }), '?from=2026-10-01&to=2026-10-16');
});

test('fetchOwnerInsights hits the insights endpoint with the x-owner-id header', async () => {
  const calls = globalThis.__insightsApiCalls;
  await fetchOwnerInsights('owner-1', { kind: 'all' });
  await fetchOwnerInsights('owner-1', { kind: 'range', from: '2026-10-01', to: '2026-10-16' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { path: '/api/fleet-owners/insights?period=all', ownerId: 'owner-1' });
  assert.deepEqual(calls[1], { path: '/api/fleet-owners/insights?from=2026-10-01&to=2026-10-16', ownerId: 'owner-1' });
});
