import { describe, expect, it, vi } from "vitest";

import { buildTools } from "./tools";
import type { PortfolioSummary } from "./portfolio-tool";
import type { MarketData } from "@/lib/market/types";
import type { Transaction } from "@/lib/portfolio";

// The AI SDK widens an execute() return to include AsyncIterable; our tool
// returns a plain value, so narrow it for assertions.
type PortfolioResult = PortfolioSummary | { error: string };

// A market stub: quote returns a fixed price; the rest are unused here.
function marketStub(price = 120): MarketData {
  return {
    quote: async (ticker) => ({
      ticker,
      price,
      change: 0,
      changePercent: 0,
      dayVolume: 0,
      dayOpen: null,
      dayHigh: null,
      dayLow: null,
      prevClose: null,
    }),
    history: async (ticker) => ({ ticker, bars: [] }),
    details: async (ticker) => ({ ticker, name: null, marketCap: null, primaryExchange: null }),
    optionsChain: async (ticker) => ({ ticker, underlyingPrice: null, calls: [], puts: [] }),
    news: async (ticker) => ({ ticker, articles: [] }),
  };
}

// AI SDK passes a second options arg to execute; tests don't need it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const opts = { toolCallId: "t1", messages: [] } as any;

const NVDA: Transaction = {
  ticker: "NVDA",
  side: "buy",
  quantity: 10,
  price_per_share: 100,
  traded_at: "2026-01-01",
};

describe("buildTools", () => {
  it("exposes the five expected tools", () => {
    const tools = buildTools({ market: marketStub(), listTransactions: async () => [] });
    expect(Object.keys(tools).sort()).toEqual([
      "analyze_technicals",
      "get_market_news",
      "get_options_chain",
      "get_portfolio",
      "get_stock_data",
    ]);
  });

  it("get_portfolio reads ONLY from the bound session reader, ignoring tool input", async () => {
    const sessionReader = vi.fn(async () => [NVDA]);
    const tools = buildTools({ market: marketStub(120), listTransactions: sessionReader });

    // A malicious model tries to scope to another user via tool input.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await tools.get_portfolio.execute!({ user_id: "attacker" } as any, opts)) as PortfolioResult;

    expect(sessionReader).toHaveBeenCalledOnce();
    if ("error" in result) throw new Error("unexpected error");
    expect(result.positions[0].ticker).toBe("NVDA");
    expect(result.totalMarketValue).toBe(1200);
  });

  it("get_portfolio returns error-as-data for an empty book (no throw)", async () => {
    const tools = buildTools({ market: marketStub(), listTransactions: async () => [] });
    const result = await tools.get_portfolio.execute!({}, opts);
    expect(result).toHaveProperty("error");
  });

  it("each tool's input schema is independent of the bound reader (no user field on get_portfolio)", async () => {
    const readerA = vi.fn(async () => [NVDA]);
    const toolsA = buildTools({ market: marketStub(120), listTransactions: readerA });
    const readerB = vi.fn(async () => [{ ...NVDA, ticker: "TSLA" }]);
    const toolsB = buildTools({ market: marketStub(120), listTransactions: readerB });

    const a = (await toolsA.get_portfolio.execute!({}, opts)) as PortfolioResult;
    const b = (await toolsB.get_portfolio.execute!({}, opts)) as PortfolioResult;
    if ("error" in a || "error" in b) throw new Error("unexpected error");

    // Scope is determined solely by which reader was bound — not by anything
    // the model can influence.
    expect(a.positions[0].ticker).toBe("NVDA");
    expect(b.positions[0].ticker).toBe("TSLA");
  });
});
