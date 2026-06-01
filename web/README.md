# Quant AI — web (Next.js + Vercel)

The Vercel-native rebuild of the Quant AI trading terminal. A multi-user,
portfolio-aware quant analyst: email/password auth behind an invite-only
allowlist, a Schwab-style dashboard (Positions / Realized / Chat), and a
Claude agent that grounds its analysis in the signed-in user's actual book.

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind 4 · shadcn/ui
- **Supabase** — auth + Postgres + RLS (`@supabase/ssr`). Same schema, RLS, and
  invite-only allowlist trigger as the Python app — no migration needed.
- **Vercel AI SDK v6** (`ai` + `@ai-sdk/anthropic`) — the agent runs as the
  `app/api/chat` Route Handler with streaming and a multi-step tool loop.
- **Polygon.io** — market data (quotes, history, options, news) behind the
  `lib/market` `MarketData` interface (swap providers in one file).

## Environment

Copy `.env.example` to `.env.local` and fill in (see `.env.example` for notes):

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | `https://wiozepohqjvavkapksqk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | reserved for admin tasks — never `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | server only | powers the agent |
| `POLYGON_API_KEY` | server only | quotes/history/options/news (options needs a paid tier) |

## Local development

```bash
cd web
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:3000
```

Your email must already be in the Supabase `allowlist` table to sign up.

## Scripts

```bash
npm test          # vitest (unit tests for the pure cores)
npx tsc --noEmit  # typecheck
npm run lint      # eslint
npm run build     # production build
```

## Deploying to Vercel

1. **Link the project** (interactive): `cd web && vercel link`.
2. **Set the Root Directory to `web`** in Vercel → Project → Settings → Build
   (the Next.js app lives in the `web/` subdirectory, not the repo root).
3. **Add the 5 environment variables** above to Vercel (Production + Preview):
   `vercel env add ...` or the dashboard. Keep the service-role and Polygon
   keys server-only (no `NEXT_PUBLIC_` prefix).
4. **Configure Supabase Auth URLs** (Supabase → Authentication → URL
   Configuration): add the Vercel production domain (and preview domains) to
   the Site URL / redirect allow-list.
5. **Deploy**: `vercel` (preview) / `vercel --prod` (production), or push to the
   linked Git branch.

`app/api/chat` sets `maxDuration = 60` for the agent tool-loop; confirm your
Vercel plan allows it (Fluid Compute / Pro).

## Relationship to the Python app

`../quant-ai` is the original Streamlit app and the reference implementation
during the rebuild. Per the plan it is **retired after parity** — once this app
is verified in production, the Streamlit app is archived. Both read the same
Supabase project, so they can run side by side during the transition.
