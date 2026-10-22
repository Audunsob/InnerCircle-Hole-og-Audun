<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Test mode

The «Test» tab on `/moderator` runs the real app (the same components and store) against a made-up database in the browser, `src/lib/sandbox.ts`. It must always behave exactly like the real app, so when you change the app:

- New or changed database functions in `supabase/schema.sql`: make the same change in `sandboxRpc` in `sandbox.ts`, and raise `SCHEMA_VERSION` there when the schema's version goes up.
- New calls to Supabase (auth, storage, rpc): put them in `src/lib/supabase.ts` and give them a test mode branch (`if (sandbox) …`).
- New data in the team document: add an example to the test team in `seed()` in `sandbox.ts` if it needs one to be tried.

`npm run build` and `npm run lint` run `scripts/check-test-mode.mjs`, which stops when the app calls a database function the test mode doesn't answer, when the schema's version doesn't match, or when code outside `supabase.ts` talks to Supabase directly.
