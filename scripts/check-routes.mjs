/**
 * Route-coverage check — every authenticated dashboard page must appear in
 * the breadcrumb registry (`lib/breadcrumbs.ts`).
 *
 * Compares the actual shell page files against the 30 expected routes
 * (19 root/index + 11 nested). A page file with no registry branch fails the
 * check. Login stays outside the shell on purpose and is asserted absent from
 * the registry; the legacy `/fleets` bookmarks are 308-redirects, so they
 * render the destination trail and need no entry.
 *
 * Run: pnpm routes:check
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SHELL = join(ROOT, "app", "(shell)");
const REGISTRY = join(ROOT, "lib", "breadcrumbs.ts");

/** page.tsx path (relative to the shell) → route pattern it serves. */
function routeOf(rel) {
  if (rel === "page.tsx") return "/";
  const noSuffix = rel.replace(/\/page\.tsx$/, "");
  if (noSuffix === "") return "/";
  const parts = noSuffix.split("/");
  const mapped = parts.map((part) =>
    part.startsWith("[") && part.endsWith("]") ? "[id]" : part,
  );
  return "/" + mapped.join("/");
}

// All 30 authenticated dashboard pages (login excluded by design).
const EXPECTED = [
  "/",
  "/fleet-owners",
  "/drivers",
  "/buses",
  "/brands",
  "/vip-tiers",
  "/markaz",
  "/localities",
  "/stops",
  "/trip-lines",
  "/trips",
  "/bookings",
  "/promotions",
  "/notifications",
  "/service-config",
  "/users",
  "/reports",
  "/roles",
  "/permissions",
  "/fleet-owners/[id]",
  "/buses/[id]",
  "/bookings/[id]",
  "/roles/[id]",
  "/trip-lines/[id]",
  "/trips/[id]",
  "/trips/[id]/feedback",
  "/drivers/[id]",
  "/drivers/[id]/assignments",
  "/drivers/[id]/ratings",
  "/drivers/[id]/trips",
];

function pageFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pageFiles(full, out);
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

const problems = [];

if (!statSync(SHELL, { throwIfNoEntry: false })) {
  console.error("route check failed — app/(shell) not found");
  process.exit(1);
}

const actual = pageFiles(SHELL).map((file) =>
  routeOf(relative(SHELL, file).replace(/\\/g, "/")),
);

for (const route of EXPECTED) {
  if (!actual.includes(route)) problems.push(`missing page file for expected route "${route}"`);
}
for (const route of actual) {
  if (!EXPECTED.includes(route)) problems.push(`page file for unexpected route "${route}" — extend EXPECTED and the registry`);
}

let registry = "";
try {
  registry = readFileSync(REGISTRY, "utf8");
} catch {
  problems.push("cannot read lib/breadcrumbs.ts");
}

// Each expected route must have a matching branch in the registry source.
const REGISTRY_NEEDLES = {
  "/": 'pathname === "/"',
  "/fleet-owners": 'pathname === "/fleet-owners"',
  "/drivers": 'pathname === "/drivers"',
  "/buses": 'pathname === "/buses"',
  "/brands": 'pathname === "/brands"',
  "/vip-tiers": 'pathname === "/vip-tiers"',
  "/markaz": 'pathname === "/markaz"',
  "/localities": 'pathname === "/localities"',
  "/stops": 'pathname === "/stops"',
  "/trip-lines": 'pathname === "/trip-lines"',
  "/trips": 'pathname === "/trips"',
  "/bookings": 'pathname === "/bookings"',
  "/promotions": 'pathname === "/promotions"',
  "/notifications": 'pathname === "/notifications"',
  "/service-config": 'pathname === "/service-config"',
  "/users": 'pathname === "/users"',
  "/reports": 'pathname === "/reports"',
  "/roles": 'pathname === "/roles"',
  "/permissions": 'pathname === "/permissions"',
  "/fleet-owners/[id]": 'segments[0] === "fleet-owners"',
  "/buses/[id]": 'segments[0] === "buses"',
  "/bookings/[id]": 'segments[0] === "bookings"',
  "/roles/[id]": 'segments[0] === "roles"',
  "/trip-lines/[id]": 'segments[0] === "trip-lines"',
  "/trips/[id]": 'segments[0] === "trips" && segments.length === 2',
  "/trips/[id]/feedback": 'segments[2] === "feedback"',
  "/drivers/[id]": 'segments[0] === "drivers" && segments.length === 2',
  "/drivers/[id]/assignments": 'sub === "assignments"',
  "/drivers/[id]/ratings": 'sub === "ratings"',
  "/drivers/[id]/trips": 'sub === "trips"',
};

for (const route of EXPECTED) {
  const needle = REGISTRY_NEEDLES[route];
  if (needle && !registry.includes(needle)) {
    problems.push(`registry covers no branch for route "${route}" (missing ${needle})`);
  }
}

// Login must stay outside the authenticated registry.
if (/\/login/.test(registry)) {
  problems.push('registry must not cover "/login" — it lives outside the authenticated shell');
}

if (problems.length) {
  console.error(`\nroute check failed — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`route check passed — ${EXPECTED.length} routes covered (${actual.length} page files).`);
