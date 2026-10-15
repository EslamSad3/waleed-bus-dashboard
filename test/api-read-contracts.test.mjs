import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real action module with its HTTP boundary replaced. No browser,
// auth cookie, or live API is needed to verify the outgoing read contracts.
function actions(file) {
  const requests = [];
  const loadedModule = { exports: {} };
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, {
    module: loadedModule, exports: loadedModule.exports, URLSearchParams,
    require: (name) => {
      if (name.endsWith('/http')) return { apiGet: async (path) => { requests.push(new URL(path, 'http://dashboard.test')); return { ok: true, data: {} }; } };
      if (name.endsWith('/toast')) return { notifyResult: (_message, result) => result };
      if (name.endsWith('/t')) return { t: (key) => key };
      throw new Error('Unexpected runtime dependency: ' + name);
    },
  });
  return { api: loadedModule.exports, requests };
}

test('bus grid reads request statistics on the first and following pages', async () => {
  const { api, requests } = actions('../lib/actions/buses.ts');
  await api.fetchSystemBusesPage(null, { stats: true });
  await api.fetchSystemBusesPage('opaque+/=', { stats: true });
  await api.fetchBusesPage('owner', null, { stats: true });
  await api.fetchBusesPage('owner', 'next', { stats: true });
  assert.equal(requests[0].pathname, '/api/fleet-owners/buses');
  assert.equal(requests[2].pathname, '/api/fleet-owners/owner/buses');
  assert.ok(requests.every((url) => url.searchParams.get('stats') === '1'));
  assert.equal(requests[1].searchParams.get('cursor'), 'opaque+/=');
  assert.equal(requests[3].searchParams.get('cursor'), 'next');
});

test('bus pickers keep the lightweight default', async () => {
  const { api, requests } = actions('../lib/actions/buses.ts');
  await api.fetchBusesPage('owner', null);
  assert.equal(requests[0].searchParams.has('stats'), false);
});

test('report reads forward the page cursor without changing its value', async () => {
  const { api, requests } = actions('../lib/actions/reports.ts');
  await api.fetchOwnerReports('owner');
  await api.fetchOwnerReports('owner', 'opaque+/=');
  assert.equal(requests[0].pathname, '/api/fleet-owners/owner/reports');
  assert.equal(requests[0].searchParams.get('limit'), '20');
  assert.equal(requests[0].searchParams.has('cursor'), false);
  assert.equal(requests[1].searchParams.get('cursor'), 'opaque+/=');
});
