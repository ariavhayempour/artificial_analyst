import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPolygon } from "./polygon";
import { isMarketError } from "./types";

const market = createPolygon();

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const res = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  };
  return vi.fn().mockResolvedValue(res);
}

beforeEach(() => {
  process.env.POLYGON_API_KEY = "poly-test-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("quote", () => {
  it("maps a snapshot into a typed quote", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        status: "OK",
        ticker: {
          ticker: "AAPL",
          todaysChange: 2.5,
          todaysChangePerc: 0.8,
          day: { o: 310, h: 314, l: 309, c: 312.34, v: 50_000_000 },
          lastTrade: { p: 312.34 },
          prevDay: { c: 309.84 },
        },
      }),
    );

    const q = await market.quote("aapl");
    expect(isMarketError(q)).toBe(false);
    if (isMarketError(q)) throw new Error("unexpected error");
    expect(q.ticker).toBe("AAPL");
    expect(q.price).toBe(312.34);
    expect(q.change).toBe(2.5);
    expect(q.prevClose).toBe(309.84);
    expect(q.dayVolume).toBe(50_000_000);
  });

  it("returns error-as-data when the snapshot has no ticker payload", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ status: "OK" }));
    const q = await market.quote("ZZZZ");
    expect(isMarketError(q)).toBe(true);
  });

  it("returns error-as-data on a non-OK HTTP response (never throws)", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({}, { ok: false, status: 403 }));
    const q = await market.quote("AAPL");
    expect(isMarketError(q)).toBe(true);
  });

  it("returns error-as-data when fetch rejects (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const q = await market.quote("AAPL");
    expect(isMarketError(q)).toBe(true);
    if (!isMarketError(q)) throw new Error("expected error");
    expect(q.error).toContain("ECONNRESET");
  });

  it("sends the API key in the Authorization header, never in the URL", async () => {
    const spy = mockFetchOnce({
      status: "OK",
      ticker: { ticker: "AAPL", lastTrade: { p: 1 }, day: {}, prevDay: {} },
    });
    vi.stubGlobal("fetch", spy);

    await market.quote("AAPL");

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).not.toContain("poly-test-key");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer poly-test-key",
    });
  });
});

describe("history", () => {
  it("maps daily aggregates into bars, oldest first", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        status: "OK",
        results: [
          { t: 1_700_000_000_000, o: 100, h: 105, l: 99, c: 104, v: 1000 },
          { t: 1_700_086_400_000, o: 104, h: 108, l: 103, c: 107, v: 1200 },
        ],
      }),
    );

    const h = await market.history("AAPL", { from: "2023-11-01", to: "2023-11-30" });
    expect(isMarketError(h)).toBe(false);
    if (isMarketError(h)) throw new Error("unexpected error");
    expect(h.bars).toHaveLength(2);
    expect(h.bars[0].close).toBe(104);
    expect(h.bars[1].close).toBe(107);
  });
});

describe("optionsChain", () => {
  it("splits contracts into calls and puts within the strike band", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        status: "OK",
        results: [
          {
            details: { contract_type: "call", strike_price: 150, expiration_date: "2026-06-19" },
            last_trade: { price: 3.2 },
            last_quote: { bid: 3.1, ask: 3.3 },
            open_interest: 1200,
            implied_volatility: 0.45,
            day: { volume: 300 },
            underlying_asset: { price: 151 },
          },
          {
            details: { contract_type: "put", strike_price: 145, expiration_date: "2026-06-19" },
            last_trade: { price: 2.1 },
            last_quote: { bid: 2.0, ask: 2.2 },
            open_interest: 800,
            implied_volatility: 0.5,
            day: { volume: 150 },
            underlying_asset: { price: 151 },
          },
        ],
      }),
    );

    const c = await market.optionsChain("AAPL");
    expect(isMarketError(c)).toBe(false);
    if (isMarketError(c)) throw new Error("unexpected error");
    expect(c.calls).toHaveLength(1);
    expect(c.puts).toHaveLength(1);
    expect(c.calls[0].strike).toBe(150);
    expect(c.calls[0].impliedVolatility).toBe(0.45);
    expect(c.underlyingPrice).toBe(151);
  });
});

describe("news", () => {
  it("maps news results into headline items", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        status: "OK",
        results: [
          {
            title: "Apple hits record high",
            article_url: "https://example.com/a",
            published_utc: "2026-05-30T12:00:00Z",
            publisher: { name: "Reuters" },
          },
        ],
      }),
    );

    const n = await market.news("AAPL", { limit: 5 });
    expect(isMarketError(n)).toBe(false);
    if (isMarketError(n)) throw new Error("unexpected error");
    expect(n.articles).toHaveLength(1);
    expect(n.articles[0].headline).toBe("Apple hits record high");
    expect(n.articles[0].source).toBe("Reuters");
  });
});

describe("details", () => {
  it("maps ticker reference details", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        status: "OK",
        results: {
          ticker: "AAPL",
          name: "Apple Inc.",
          market_cap: 3_000_000_000_000,
          primary_exchange: "XNAS",
        },
      }),
    );

    const d = await market.details("AAPL");
    expect(isMarketError(d)).toBe(false);
    if (isMarketError(d)) throw new Error("unexpected error");
    expect(d.name).toBe("Apple Inc.");
    expect(d.marketCap).toBe(3_000_000_000_000);
  });

  it("returns error-as-data when no missing API key", async () => {
    delete process.env.POLYGON_API_KEY;
    vi.stubGlobal("fetch", mockFetchOnce({ status: "OK", results: {} }));
    const d = await market.details("AAPL");
    expect(isMarketError(d)).toBe(true);
  });
});
