import "server-only";

import type {
  History,
  MarketData,
  News,
  OptionContract,
  OptionsChain,
  Quote,
  Result,
  TickerDetails,
} from "./types";

const BASE = "https://api.polygon.io";

// Short TTLs mirror the Python diskcache expiries: quotes/options are volatile,
// reference data and history change slowly.
const TTL = { quote: 60, history: 300, details: 86_400, options: 120, news: 600 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET a Polygon REST endpoint. The API key travels in the Authorization header
 * (never the URL), so it stays out of logs and the fetch cache key. Throws on a
 * missing key or non-OK response; callers convert to error-as-data.
 */
async function polyGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  revalidate: number,
): Promise<T> {
  const key = process.env.POLYGON_API_KEY;
  if (!key) throw new Error("POLYGON_API_KEY is not set");

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Polygon ${res.status} for ${path}`);
  return (await res.json()) as T;
}

// --- Polygon response shapes (only the fields we read) ---------------------

interface SnapshotResp {
  ticker?: {
    ticker?: string;
    todaysChange?: number;
    todaysChangePerc?: number;
    day?: { o?: number; h?: number; l?: number; c?: number; v?: number };
    lastTrade?: { p?: number };
    prevDay?: { c?: number };
  };
}
interface AggsResp {
  results?: { t: number; o: number; h: number; l: number; c: number; v: number }[];
}
interface DetailsResp {
  results?: {
    ticker?: string;
    name?: string;
    market_cap?: number;
    primary_exchange?: string;
  };
}
interface OptionsResp {
  results?: {
    details?: { contract_type?: string; strike_price?: number; expiration_date?: string };
    last_trade?: { price?: number };
    last_quote?: { bid?: number; ask?: number };
    open_interest?: number;
    implied_volatility?: number;
    day?: { volume?: number };
    underlying_asset?: { price?: number };
  }[];
}
interface NewsResp {
  results?: {
    title?: string;
    article_url?: string;
    published_utc?: string;
    publisher?: { name?: string };
  }[];
}

export function createPolygon(): MarketData {
  return {
    async quote(ticker: string): Promise<Result<Quote>> {
      const t = ticker.toUpperCase();
      try {
        const j = await polyGet<SnapshotResp>(
          `/v2/snapshot/locale/us/markets/stocks/tickers/${t}`,
          {},
          TTL.quote,
        );
        const s = j.ticker;
        const price = s?.lastTrade?.p ?? s?.day?.c ?? s?.prevDay?.c;
        if (!s || price == null) {
          return { error: `No quote available for ${t}` };
        }
        return {
          ticker: t,
          price: round2(price),
          change: round2(s.todaysChange ?? 0),
          changePercent: round2(s.todaysChangePerc ?? 0),
          dayVolume: s.day?.v ?? 0,
          dayOpen: s.day?.o ?? null,
          dayHigh: s.day?.h ?? null,
          dayLow: s.day?.l ?? null,
          prevClose: s.prevDay?.c ?? null,
        };
      } catch (e) {
        return { error: errMsg(e) };
      }
    },

    async history(
      ticker: string,
      opts: { from?: string; to?: string } = {},
    ): Promise<Result<History>> {
      const t = ticker.toUpperCase();
      const to = opts.to ?? isoDate(new Date());
      const from =
        opts.from ?? isoDate(new Date(Date.now() - 183 * 24 * 60 * 60 * 1000));
      try {
        const j = await polyGet<AggsResp>(
          `/v2/aggs/ticker/${t}/range/1/day/${from}/${to}`,
          { adjusted: "true", sort: "asc", limit: 50_000 },
          TTL.history,
        );
        const bars = (j.results ?? []).map((b) => ({
          date: isoDate(new Date(b.t)),
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
        }));
        if (bars.length === 0) return { error: `No history for ${t}` };
        return { ticker: t, bars };
      } catch (e) {
        return { error: errMsg(e) };
      }
    },

    async details(ticker: string): Promise<Result<TickerDetails>> {
      const t = ticker.toUpperCase();
      try {
        const j = await polyGet<DetailsResp>(
          `/v3/reference/tickers/${t}`,
          {},
          TTL.details,
        );
        const r = j.results;
        if (!r) return { error: `No details for ${t}` };
        return {
          ticker: t,
          name: r.name ?? null,
          marketCap: r.market_cap ?? null,
          primaryExchange: r.primary_exchange ?? null,
        };
      } catch (e) {
        return { error: errMsg(e) };
      }
    },

    async optionsChain(
      ticker: string,
      opts: { expiration?: string; strikeRangePct?: number } = {},
    ): Promise<Result<OptionsChain>> {
      const t = ticker.toUpperCase();
      try {
        const j = await polyGet<OptionsResp>(
          `/v3/snapshot/options/${t}`,
          {
            limit: 250,
            ...(opts.expiration ? { expiration_date: opts.expiration } : {}),
          },
          TTL.options,
        );
        const rows = j.results ?? [];
        if (rows.length === 0) return { error: `No options for ${t}` };

        let underlyingPrice: number | null = null;
        const calls: OptionContract[] = [];
        const puts: OptionContract[] = [];
        for (const row of rows) {
          const d = row.details;
          if (!d?.strike_price || !d.contract_type || !d.expiration_date) continue;
          underlyingPrice = row.underlying_asset?.price ?? underlyingPrice;
          const contract: OptionContract = {
            type: d.contract_type === "put" ? "put" : "call",
            strike: d.strike_price,
            expiration: d.expiration_date,
            lastPrice: row.last_trade?.price ?? null,
            bid: row.last_quote?.bid ?? null,
            ask: row.last_quote?.ask ?? null,
            volume: row.day?.volume ?? null,
            openInterest: row.open_interest ?? null,
            impliedVolatility: row.implied_volatility ?? null,
          };
          (contract.type === "put" ? puts : calls).push(contract);
        }

        // Optional near-the-money band around the underlying price.
        if (opts.strikeRangePct && underlyingPrice) {
          const lo = underlyingPrice * (1 - opts.strikeRangePct);
          const hi = underlyingPrice * (1 + opts.strikeRangePct);
          const within = (c: OptionContract) => c.strike >= lo && c.strike <= hi;
          return {
            ticker: t,
            underlyingPrice,
            calls: calls.filter(within),
            puts: puts.filter(within),
          };
        }
        return { ticker: t, underlyingPrice, calls, puts };
      } catch (e) {
        return { error: errMsg(e) };
      }
    },

    async news(
      ticker: string,
      opts: { limit?: number } = {},
    ): Promise<Result<News>> {
      const t = ticker.toUpperCase();
      try {
        const j = await polyGet<NewsResp>(
          `/v2/reference/news`,
          { ticker: t, limit: opts.limit ?? 8, order: "desc", sort: "published_utc" },
          TTL.news,
        );
        const articles = (j.results ?? []).map((a) => ({
          headline: a.title ?? "",
          source: a.publisher?.name ?? null,
          url: a.article_url ?? null,
          publishedAt: a.published_utc ?? "",
        }));
        return { ticker: t, articles };
      } catch (e) {
        return { error: errMsg(e) };
      }
    },
  };
}

/** Shared default provider. Server-only — depends on POLYGON_API_KEY. */
export const polygon = createPolygon();
