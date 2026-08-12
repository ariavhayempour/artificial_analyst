# Repository structure

## Top level

- `web/` — the live app. Next.js 16 App Router on Vercel, Supabase for
  auth/DB, Vercel AI SDK for the Claude agent. All active development.
- `quant-ai/` — the original Streamlit implementation and reference. Retired
  after production parity; no new features.
- `docs/claude/` — this documentation.
- `tasks/` — planning artifacts. Untracked by design (`CLAUDE.md` rule 5).

## `web/`

- `app/` — routes. `(dashboard)/` holds the Positions / Realized / Chat views,
  `api/` holds route handlers, `auth/` and `login/` the auth gate.
- `lib/` — domain logic, unit-tested alongside the source:
  - `portfolio.ts`, `holdings.ts` — position and P&L derivation math
  - `transactions.ts` — transaction data layer over Supabase (RLS-backed)
  - `market/` — market data providers (Polygon)
  - `agent/` — the portfolio-aware Claude agent and its tools
  - `import/` — broker-CSV position mapping
  - `supabase/`, `auth/` — client construction and the auth gate
- `components/` — UI, built on shadcn + Base UI with Tailwind 4.
- `test/` — shared test stubs. Unit tests sit next to their source as
  `*.test.ts`.
- `proxy.ts` — request interception for the auth gate.

## Boundaries worth preserving

- Server-only modules are marked with `server-only` so provider keys
  (Supabase service role, Polygon, Anthropic) cannot reach a client component.
- Route handlers validate input with `zod`; Supabase RLS is the second line of
  defense, not the only one.
