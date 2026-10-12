import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

const schemas = new URL('../lib/schemas/', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(schemas)) {
      if (specifier === '@/lib/i18n/t') return { url: 'assignment-test:i18n', shortCircuit: true };
      if (specifier.startsWith('@/lib/schemas/')) return { url: new URL(`${specifier.slice('@/lib/schemas/'.length)}.ts`, schemas).href, shortCircuit: true };
      if (specifier.startsWith('./')) return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'assignment-test:i18n') return { format: 'module', source: 'export const t = key => key;', shortCircuit: true };
    if (url.startsWith(schemas) && url.endsWith('.ts')) return {
      format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText,
      shortCircuit: true,
    };
    return next(url, context);
  },
});

const { findRegistryEntry } = await import('../lib/schemas/p1.ts');
const ownerId = 'b8a38866-6e1b-4033-9610-4ff4707da16b';
const busId = '84ea9572-84c4-49d1-b73b-3ea4d6880495';
const schema = findRegistryEntry('POST', `/fleet-owners/${ownerId}/buses/${busId}/driver`).schema;
const payload = { driverUserId: ownerId, tripId: 'a0000001-0000-0000-0000-000000000007' };

test('assignment proxy accepts the reported seeded trip without changing its ID', () => {
  assert.deepEqual(schema.parse(payload), payload);
});

test('assignment accepts standard and seeded database IDs for either field', () => {
  for (const id of [busId, payload.tripId, payload.tripId.toUpperCase()]) {
    assert.equal(schema.safeParse({ tripId: id, driverUserId: id }).success, true);
  }
});

test('assignment still rejects missing and malformed identifiers on the correct field', () => {
  for (const field of ['tripId', 'driverUserId']) {
    for (const invalid of [undefined, null, '', 7, 'not-an-id', payload.tripId.replaceAll('-', ''), `${payload.tripId}0`, payload.tripId.replace('a', 'g')]) {
      const parsed = schema.safeParse({ ...payload, [field]: invalid });
      assert.equal(parsed.success, false);
      assert.deepEqual(parsed.error.issues.map(issue => issue.path), [[field]]);
    }
  }
});
