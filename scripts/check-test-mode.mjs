// Keeps the test mode on the moderator page as close to the real app as possible. The test mode runs the
// app's own screens, so they follow every change by themselves; only the made-up database in
// src/lib/sandbox.ts copies the real one, and that is what this checks. Runs before every build.
//
// 1. Every database function the app calls (rpc('…') in src/lib/supabase.ts) is answered in sandbox.ts.
// 2. sandbox.ts says which version of supabase/schema.sql it copies. When the schema's version goes up,
//    the build stops until sandbox.ts has been brought up to date and its SCHEMA_VERSION changed to match.
// 3. Only src/lib/supabase.ts talks to Supabase directly in the browser, so the test mode can switch every
//    call over. Server routes (src/app/api) are left out: the test mode never calls them.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const supabase = read('src/lib/supabase.ts');
const sandbox = read('src/lib/sandbox.ts');
const schema = read('supabase/schema.sql');
const problems = [];

// The moderator's own pages read real data and are not part of the test mode.
const notInTestMode = new Set(['mod_overview', 'mod_view_as']);
const called = new Set([...supabase.matchAll(/rpc<[^(]*\(\s*'([a-z_]+)'/g)].map((m) => m[1]));
const answered = new Set([...sandbox.matchAll(/^\s*case '([a-z_]+)':/gm)].map((m) => m[1]));
for (const fn of called)
  if (!notInTestMode.has(fn) && !answered.has(fn))
    problems.push(`The app calls the database function «${fn}», but the test mode (src/lib/sandbox.ts, sandboxRpc) doesn't answer it.`);

const schemaVersion = /version (\d+)/.exec(schema)?.[1];
const copied = /SCHEMA_VERSION = (\d+)/.exec(sandbox)?.[1];
if (schemaVersion !== copied)
  problems.push(
    `supabase/schema.sql is version ${schemaVersion}, but src/lib/sandbox.ts copies version ${copied}. ` +
      'Bring the rules in sandbox.ts up to date with the schema, then set SCHEMA_VERSION to match.',
  );

const walk = (dir) =>
  readdirSync(new URL('../' + dir, import.meta.url)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(new URL('../' + p, import.meta.url)).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
for (const f of walk('src'))
  if (f !== join('src', 'lib', 'supabase.ts') && !f.startsWith(join('src', 'app', 'api')) && /\bdb\(\)|createClient\(/.test(read(f)))
    problems.push(`${f} talks to Supabase directly. Go through src/lib/supabase.ts, so the test mode can answer it instead.`);

if (problems.length) {
  console.error('Test mode is out of step with the app:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(`Test mode matches the app (${answered.size} database functions, schema version ${copied}).`);
