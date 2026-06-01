import { describe, expect, it } from "vitest";

import { aggregatePositions, realizedPnl, type Transaction } from "./portfolio";

// Mirrors tests/test_portfolio.py — pins the average-cost math for parity with
// the Python reference implementation.
function txn(
  ticker: string,
  side: "buy" | "sell",
  quantity: number,
  pricePerShare: number,
  tradedAt: string,
): Transaction {
  return { ticker, side, quantity, price_per_share: pricePerShare, traded_at: tradedAt };
}

describe("aggregatePositions", () => {
  it("turns a single buy into one position", () => {
    const positions = aggregatePositions([txn("NVDA", "buy", 10, 100, "2026-01-01")]);
    expect(positions).toEqual([
      {
        ticker: "NVDA",
        quantity: 10,
        avgCost: 100,
        costBasis: 1000,
        batches: [{ quantity: 10, pricePerShare: 100, tradedAt: "2026-01-01" }],
      },
    ]);
  });

  it("weight-averages cost across multiple buys", () => {
    const [pos] = aggregatePositions([
      txn("NVDA", "buy", 10, 100, "2026-01-01"),
      txn("NVDA", "buy", 5, 130, "2026-02-01"),
    ]);
    expect(pos.quantity).toBe(15);
    expect(pos.avgCost).toBe(110); // (1000 + 650) / 15
    expect(pos.costBasis).toBe(1650);
    expect(pos.batches).toHaveLength(2);
  });

  it("a sell reduces quantity but keeps average cost", () => {
    const [pos] = aggregatePositions([
      txn("NVDA", "buy", 10, 100, "2026-01-01"),
      txn("NVDA", "sell", 4, 130, "2026-02-01"),
    ]);
    expect(pos.quantity).toBe(6);
    expect(pos.avgCost).toBe(100);
    expect(pos.costBasis).toBe(600);
  });

  it("excludes a fully-sold ticker from holdings", () => {
    expect(
      aggregatePositions([
        txn("NVDA", "buy", 10, 100, "2026-01-01"),
        txn("NVDA", "sell", 10, 120, "2026-02-01"),
      ]),
    ).toEqual([]);
  });

  it("separates multiple tickers and sorts them", () => {
    const tickers = aggregatePositions([
      txn("TSLA", "buy", 2, 200, "2026-01-01"),
      txn("AAPL", "buy", 3, 150, "2026-01-01"),
    ]).map((p) => p.ticker);
    expect(tickers).toEqual(["AAPL", "TSLA"]);
  });

  it("has no positions for an empty ledger", () => {
    expect(aggregatePositions([])).toEqual([]);
  });

  it("coerces string numerics (as PostgREST returns them)", () => {
    const [pos] = aggregatePositions([
      { ticker: "NVDA", side: "buy", quantity: "10", price_per_share: "100", traded_at: "2026-01-01" },
    ]);
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000);
  });
});

describe("realizedPnl", () => {
  it("computes realized P&L on a simple sale", () => {
    const result = realizedPnl([
      txn("NVDA", "buy", 10, 100, "2026-01-01"),
      txn("NVDA", "sell", 4, 130, "2026-02-01"),
    ]);
    expect(result.total).toBe(120); // (130 - 100) * 4
    expect(result.sales).toHaveLength(1);
    const [sale] = result.sales;
    expect(sale.ticker).toBe("NVDA");
    expect(sale.proceeds).toBe(520);
    expect(sale.costBasis).toBe(400);
    expect(sale.realized).toBe(120);
  });

  it("uses average cost across buys", () => {
    const result = realizedPnl([
      txn("NVDA", "buy", 10, 100, "2026-01-01"),
      txn("NVDA", "buy", 10, 200, "2026-02-01"), // avg cost now 150
      txn("NVDA", "sell", 5, 300, "2026-03-01"),
    ]);
    expect(result.total).toBe(750); // (300 - 150) * 5
  });

  it("is empty when there are no sells", () => {
    expect(realizedPnl([txn("NVDA", "buy", 10, 100, "2026-01-01")])).toEqual({
      sales: [],
      total: 0,
    });
  });
});
