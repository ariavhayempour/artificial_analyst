# artificial_analyst

AI financial analysis and stock prediction — a multi-user, portfolio-aware quant
analyst powered by Claude.

## Layout

- **`web/`** — the current app: Next.js 16 + Vercel AI SDK on Vercel, Supabase
  for auth/DB. Schwab-style dashboard (Positions / Realized / Chat) with a
  portfolio-aware Claude agent. See [`web/README.md`](web/README.md) for setup
  and deployment.
- **`quant-ai/`** — the original Streamlit app and reference implementation.
  Being **retired after parity** once `web/` is verified in production. See
  [`quant-ai/app.py`](quant-ai/app.py).
- **`tasks/`** — the implementation plan (`plan.md`) and task checklist
  (`todo.md`).

## Status

The Vercel rebuild has reached feature parity with the Streamlit app (auth +
invite-only allowlist, positions with live P&L, realized gains + trade history,
and the portfolio-aware agent). Remaining: production deploy, live verification,
and Streamlit cutover — see `tasks/todo.md` (Task 17).
