import { describe, expect, it, vi } from "vitest";

import { loadPortfolio } from "./portfolio-tool";
import type { Transaction } from "@/lib/portfolio";

function buy(ticker: string, qty: number, price: number): Transaction {
  return { ticker, side: "buy", quantity: qty, price_per_share: price, traded_at: "2026-01-01" };
}

describe("loadPortfolio", () => {
  it("returns error-as-data for an empty book (never throws / 500s)", async () => {
    const result = await loadPortfolio({
      listTransactions: async () => [],
      quote: async () => 100,
    });
    expect(result).toHaveProperty("error");
  });

  it("reads holdings from the injected (session-bound) reader and enriches with live price", async () => {
    const listTransactions = vi.fn(async () => [buy("NVDA", 10, 100)]);
    const result = await loadPortfolio({
      listTransactions,
      quote: async () => 120,
    });

    expect(listTransactions).toHaveBeenCalledOnce();
    if ("error" in result) throw new Error("unexpected error");
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toMatchObject({
      ticker: "NVDA",
      quantity: 10,
      avgCost: 100,
      price: 120,
      marketValue: 1200,
      unrealizedPnl: 200,
    });
    expect(result.totalMarketValue).toBe(1200);
    expect(result.totalUnrealizedPnl).toBe(200);
  });

  it("degrades gracefully when a live price is unavailable", async () => {
    const result = await loadPortfolio({
      listTransactions: async () => [buy("NVDA", 10, 100), buy("ZZZZ", 5, 50)],
      quote: async (t) => (t === "ZZZZ" ? null : 120),
    });
    if ("error" in result) throw new Error("unexpected error");

    const zzzz = result.positions.find((p) => p.ticker === "ZZZZ")!;
    expect(zzzz.price).toBeNull();
    expect(zzzz.marketValue).toBeNull();
    // Only the priced NVDA contributes to the total.
    expect(result.totalMarketValue).toBe(1200);
  });

  it("includes the realized-P&L total derived from the same ledger", async () => {
    const result = await loadPortfolio({
      listTransactions: async () => [
        buy("NVDA", 10, 100),
        { ticker: "NVDA", side: "sell", quantity: 4, price_per_share: 130, traded_at: "2026-02-01" },
      ],
      quote: async () => 120,
    });
    if ("error" in result) throw new Error("unexpected error");
    expect(result.realizedPnlTotal).toBe(120); // (130 - 100) * 4
  });
});
