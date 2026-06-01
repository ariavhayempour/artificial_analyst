import { describe, expect, it } from "vitest";

import { enrichHoldings } from "./holdings";
import type { Position } from "./portfolio";

function pos(ticker: string, quantity: number, costBasis: number): Position {
  return {
    ticker,
    quantity,
    avgCost: costBasis / quantity,
    costBasis,
    batches: [{ quantity, pricePerShare: costBasis / quantity, tradedAt: "2026-01-01" }],
  };
}

describe("enrichHoldings", () => {
  it("computes market value, unrealized P&L $/%, weight, and totals", () => {
    const positions = [pos("NVDA", 10, 1000), pos("AAPL", 5, 750)];
    const { rows, totals } = enrichHoldings(positions, { NVDA: 120, AAPL: 160 });

    const nvda = rows.find((r) => r.ticker === "NVDA")!;
    expect(nvda.marketValue).toBe(1200);
    expect(nvda.unrealized).toBe(200);
    expect(nvda.unrealizedPct).toBe(20); // 200 / 1000
    expect(nvda.weightPct).toBe(60); // 1200 / 2000

    const aapl = rows.find((r) => r.ticker === "AAPL")!;
    expect(aapl.marketValue).toBe(800);
    expect(aapl.unrealized).toBe(50);
    expect(aapl.weightPct).toBe(40);

    expect(totals.marketValue).toBe(2000);
    expect(totals.costBasis).toBe(1750);
    expect(totals.unrealized).toBe(250);
  });

  it("degrades gracefully when a price is missing (null), excluding it from totals", () => {
    const positions = [pos("NVDA", 10, 1000), pos("ZZZZ", 5, 500)];
    const { rows, totals } = enrichHoldings(positions, { NVDA: 120, ZZZZ: null });

    const zzzz = rows.find((r) => r.ticker === "ZZZZ")!;
    expect(zzzz.price).toBeNull();
    expect(zzzz.marketValue).toBeNull();
    expect(zzzz.unrealized).toBeNull();
    expect(zzzz.unrealizedPct).toBeNull();
    expect(zzzz.weightPct).toBeNull();

    // Only the priced NVDA position contributes to the totals.
    expect(totals.marketValue).toBe(1200);
    expect(totals.costBasis).toBe(1000);
    expect(totals.unrealized).toBe(200);
  });

  it("returns zeroed totals and no rows for an empty book", () => {
    const { rows, totals } = enrichHoldings([], {});
    expect(rows).toEqual([]);
    expect(totals).toEqual({ marketValue: 0, costBasis: 0, unrealized: 0 });
  });

  it("treats a ticker absent from the price map as unpriced", () => {
    const { rows } = enrichHoldings([pos("NVDA", 10, 1000)], {});
    expect(rows[0].marketValue).toBeNull();
  });
});
