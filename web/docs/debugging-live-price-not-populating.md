# Debug log — live price not populating in portfolio

**Date:** 2026-05-31
**Symptom:** Portfolio agent returns the position, but the *live price* field is empty
("The portfolio feed returned your position but the live price didn't populate" — for NBIS).

---

## TL;DR

The Polygon API key is on a plan that **does not include the real-time *snapshot*
endpoint** — and that snapshot endpoint is the *only* one `quote()` uses for the live
price. Polygon returns **HTTP 403 `NOT_AUTHORIZED`**, the error is mapped to `null`, and
the price renders empty.

This is **not NBIS-specific** — every ticker's live price fails identically. NBIS was just
the position in focus. Only the *live price* breaks (not technicals/details/news) because
price is the one field routed through the gated snapshot endpoint.

---

## Evidence (real API calls with the actual key)

| Endpoint | Used by | Result |
|---|---|---|
| `/v2/snapshot/locale/us/markets/stocks/tickers/NBIS` | **`quote()` → live price** | ❌ **HTTP 403 `NOT_AUTHORIZED` — "You are not entitled to this data. Please upgrade your plan"** |
| `/v2/aggs/ticker/NBIS/prev` | (unused for price) | ✅ 200 — close **$231.09** |
| `/v2/aggs/ticker/NBIS/range/1/day/...` | `history()` / `analyze_technicals` | ✅ 200 — 20 daily bars |
| `/v3/reference/tickers/NBIS` | `details()` | ✅ 200 — "Nebius Group N.V." |

The plan includes **end-of-day aggregates** and **reference data**, but **not** the
real-time snapshot.

---

## Root-cause data flow

1. `web/lib/market/polygon.ts` → `quote()` calls the **snapshot** endpoint → Polygon
   returns **403** → `polyGet` throws.
2. `quote()` catches and returns `{ error }` (error-as-data).
3. Agent adapter `web/lib/agent/tools.ts:28` maps any error to `null`:
   `return isMarketError(q) ? null : q.price`.
4. `web/lib/agent/portfolio-tool.ts:57` sees `price === null` → `marketValue` and
   `unrealizedPnl` stay `null` → **"live price didn't populate."**

---

## Secondary issues found while tracing

- **`web/` has no `.env` / `.env.local`.** The only file with a real `POLYGON_API_KEY` is
  `quant-ai/.env` (the Python app). Running the web app **locally** leaves the key
  undefined → same `null` for a different reason. Confirm the key is set in **Vercel
  project env vars** for the deployed app.
- **`quant-ai/.env` has malformed lines:**
  - `POLYGON_API_KEY = R2…` — spaces around `=`
  - `FINNHUB_API_KEY= X…` — leading space in the value

  python-dotenv tolerates these, but copy/paste into other tooling won't (this caused an
  initial empty-key extraction during debugging).

---

## Fix options (cost/data tradeoff — product decision)

### Option A — derive the quote price from the aggregate endpoint (recommended, $0)
Change `quote()` to fall back to `/v2/aggs/ticker/{t}/prev` (or the last bar of a daily
range) when the snapshot 403s. That endpoint is on the current plan and returns a price
today. Tradeoff: **previous-close** instead of real-time — identical data on
weekends/after-hours, and adequate for a portfolio health check. A snapshot→prev-close
fallback self-heals and automatically uses real-time data if the plan is later upgraded.

### Option B — upgrade the Polygon plan
The 403 links to pricing. No code change; unlocks true real-time / 15-min-delayed
snapshots.

---

## Reproduction

```bash
# Extract key (note: handles the 'KEY = value' spacing in quant-ai/.env)
KEY=$(grep -E "^POLYGON_API_KEY[[:space:]]*=" quant-ai/.env | head -1 \
  | sed -E 's/^[^=]*=[[:space:]]*//; s/[[:space:]]+$//' | tr -d '"'"'"'"'"')

# Fails (gated): snapshot endpoint used by quote()
curl -s -w "\nHTTP %{http_code}\n" \
  "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/NBIS" \
  -H "Authorization: Bearer $KEY"

# Works (on-plan): aggregate price
curl -s -w "\nHTTP %{http_code}\n" \
  "https://api.polygon.io/v2/aggs/ticker/NBIS/prev" \
  -H "Authorization: Bearer $KEY"
```
