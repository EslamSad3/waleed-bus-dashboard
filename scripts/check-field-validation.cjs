/* Regression checks for shared form rules; uses the existing TypeScript runtime. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = new Module(file, moduleParent);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, loaded);
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (name) => {
    const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    if (local && fs.existsSync(`${local}.ts`)) return load(`${local}.ts`);
    return nativeRequire(local ?? name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file);
  return loaded.exports;
}
const moduleParent = module;
const { schemaErrors, coordinatesFromMapLink } = load('lib/field-validation.ts');
const schemas = load('lib/schemas/p1.ts');
const admin = load('lib/schemas/admin-forms.ts');
const payment = load('lib/schemas/admin-bookings.ts');
const id = 'a0000000-0000-4000-8000-000000000001';
let checks = 0;
function fields(schema, input, names) {
  const errors = schemaErrors(schema, input);
  assert.deepEqual(Object.keys(errors).sort(), names.sort());
  for (const message of Object.values(errors)) assert.match(message, /\p{Script=Arabic}/u);
  checks++;
}
fields(schemas.createStopSchema, { name: 'Stop', governorateId: id, localityId: id, latitude: 30, longitude: 31 }, []);
fields(schemas.createStopSchema, { name: '', governorateId: '', latitude: 91, longitude: 181 }, ['name', 'governorateId', 'latitude', 'longitude']);
fields(schemas.createBookingSchema, { tripId: '', passengerName: '', passengerPhone: 'abc' }, ['tripId', 'passengerName', 'passengerPhone']);
fields(schemas.createBookingSchema, { tripId: id, passengerName: 'Passenger', passengerPhone: '01012345678' }, []);
fields(schemas.createDriverAccountSchema, { phone: 'abc', password: 'x' }, ['ownerId', 'phone', 'password']);
fields(schemas.createDriverAccountSchema, { ownerId: id, name: 'Driver', nickname: 'driver', phone: '01012345678', password: 'Passw0rd!123' }, []);
fields(schemas.createDriverAccountSchema, { ownerId: id, phone: '01012345678', password: 'Passw0rd!123' }, []);
fields(schemas.updateDriverSchema, { status: 'SUSPENDED' }, []);
fields(schemas.updateDriverSchema, { status: 'ACTIVE' }, []);
fields(schemas.createBusSchema, { plateNumber: '', color: '', capacity: 0, modelYear: 1979, imageUrl: '' }, ['plateNumber', 'color', 'capacity', 'modelYear', 'imageUrl']);
fields(schemas.createBusSchema, { plateNumber: 'ABC', color: 'WHITE', capacity: 40, modelYear: 2025, imageUrl: 'https://storage.example/bus.jpg', brandId: null }, []);
fields(schemas.createTripSchema, { busId: '', departAt: 'bad', fare: '-5' }, ['busId', 'departAt', 'fare']);
fields(schemas.createTripSchema, { busId: id, departAt: '2026-10-05T09:00:00Z', fare: '10.50' }, []);
fields(schemas.createTripLineSchema, { name: 'Line', code: 'L1', stops: [{ stopId: id, stopType: 'BAD' }] }, ['stops', 'stops.0.stopType']);
fields(admin.createUserSchema, { email: 'bad', password: 'x' }, ['email', 'password']);
fields(admin.updateUserSchema, { name: 'New', password: undefined, maxBookingSeats: null }, []);
fields(admin.updateUserSchema, { maxBookingSeats: 1.5 }, ['maxBookingSeats']);
fields(admin.createRoleSchema, { name: '', slug: 'bad_slug' }, ['name', 'slug']);
fields(admin.rolePermissionsSchema, { permissionKeys: [] }, ['permissionKeys']);
fields(admin.rolePermissionsSchema, { permissionKeys: ['buses.read'] }, []);
assert.deepEqual(admin.updateUserSchema.parse({ picture: 'https://example.com/photo.jpg' }), { picture: 'https://example.com/photo.jpg' }); checks++;
assert.deepEqual(admin.createRoleSchema.parse({ name: 'Role', slug: 'test-role', permissionKeys: ['buses.read'] }).permissionKeys, ['buses.read']); checks++;
fields(admin.notificationSchema, { title: '', body: '', isGlobal: false, category: 'TRIP' }, ['title', 'body', 'userId', 'tripId']);
fields(admin.notificationSchema, { title: 'Title', body: 'Body', isGlobal: true, category: 'TEXT' }, []);
fields(admin.serviceConfigSchema, { entries: [{ text: '', type: 'WEBSITE', value: 'bad' }, { text: 'Support', type: 'PHONE', value: 'abc' }] }, ['entries.0.text', 'entries.0.value', 'entries.1.value']);
fields(admin.serviceConfigSchema, { entries: [{ text: 'Support', type: 'PHONE', value: '+201012345678' }, { text: 'Website', type: 'WEBSITE', value: 'https://example.com' }] }, []);
fields(payment.adminRefundPaymentSchema, { refundReference: '', refundAmount: 0, reason: '' }, ['refundReference', 'refundAmount', 'reason']);
fields(payment.adminRefundPaymentSchema, { refundReference: 'R1', refundAmount: 10.001, reason: 'Reason' }, ['refundAmount']);
fields(payment.adminVerifyPaymentSchema, { amount: 10.001 }, ['amount']);
fields(payment.adminVerifyPaymentSchema, { amount: 10.50 }, []);
fields(payment.adminResolveReportSchema, { status: 'RESOLVED', resolutionNote: 'x' }, ['resolutionNote']);
fields(admin.dateRangeSchema, { fromDate: '2026-10-05', toDate: '2026-10-04' }, ['toDate']);
fields(admin.dateRangeSchema, { fromDate: '2026-02-31', toDate: '' }, ['fromDate']);
fields(admin.dateRangeSchema, { fromDate: '', toDate: '' }, []);
fields(admin.dateRangeSchema, { fromDate: '2026-10-04', toDate: '2026-10-04' }, []);
for (const url of ['', 'bad', 'https://evil.com/?q=30,31', 'https://google.evil.com/?q=30,31', 'https://maps.google.com/?q=91,31', 'https://maps.app.goo.gl/short']) {
  assert.equal(coordinatesFromMapLink(url), null); checks++;
}
for (const url of ['maps.google.com/?q=30,31', 'https://www.google.com/maps/@30,31,12z', 'https://www.google.com/maps?query=30%2C31']) {
  assert.deepEqual(coordinatesFromMapLink(url), { latitude: 30, longitude: 31 }); checks++;
}
assert.deepEqual(coordinatesFromMapLink('https://www.google.com/maps/@20,21,10z/data=!3d30!4d31'), { latitude: 30, longitude: 31 }); checks++;
for (const [method, route] of [['POST', '/users'], ['PATCH', `/users/${id}`], ['PUT', `/users/${id}/roles`], ['PUT', `/roles/${id}/permissions`], ['POST', '/platform/notifications'], ['PUT', '/platform/config/customer-service']]) {
  assert.ok(schemas.findRegistryEntry(method, route)); checks++;
}
console.log(`${checks} field-validation regression checks passed.`);
