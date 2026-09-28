/**
 * i18n guard — fails when the single-source-of-truth rule is broken.
 *
 *   1. Every `t("…")` key must exist in the active dictionary (ar.json).
 *   2. No Arabic copy may live in source files (comments excluded).
 *
 * Run: pnpm i18n:check
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DICTIONARY = join(ROOT, "lib", "i18n", "ar.json");
const SCAN_DIRS = ["app", "components", "lib", "stores", "proxy.ts"];
const SKIP = new Set(["node_modules", ".next", ".git", "generated"]);
const ARABIC = /[\u0600-\u06FF]/;

const dictionary = JSON.parse(readFileSync(DICTIONARY, "utf8"));

function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else if (value && typeof value === "object") flatten(value, path, out);
  }
  return out;
}

const messages = flatten(dictionary);

function files(dir) {
  const stat = statSync(dir);
  if (stat.isFile()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Drops block and line comments so Arabic in prose comments is not flagged. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const problems = [];
const scanned = SCAN_DIRS.flatMap((entry) => (statSync(join(ROOT, entry), { throwIfNoEntry: false }) ? files(join(ROOT, entry)) : []));

for (const file of scanned) {
  const raw = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const code = stripComments(raw);

  for (const match of code.matchAll(/\bt\(\s*"([^"]+)"/g)) {
    if (!(match[1] in messages)) problems.push(`${rel}: missing key "${match[1]}"`);
  }

  code.split(/\r?\n/).forEach((line, index) => {
    if (!ARABIC.test(line)) return;
    problems.push(`${rel}:${index + 1}: hardcoded Arabic copy — ${line.trim().slice(0, 90)}`);
  });
}

const unused = new Set(Object.keys(messages));
for (const file of scanned) {
  for (const match of stripComments(readFileSync(file, "utf8")).matchAll(/\b(?:t|tr)\(\s*"([^"]+)"/g)) unused.delete(match[1]);
}

if (unused.size) {
  console.warn(`\nunused keys (${unused.size}) — no t() call references these:`);
  for (const key of unused) console.warn(`  ${key}`);
}

if (problems.length) {
  console.error(`\ni18n check failed — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`i18n check passed — ${Object.keys(messages).length} keys, ${unused.size} not referenced by t() directly.`);
