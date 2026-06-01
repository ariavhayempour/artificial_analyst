/**
 * Pure enrichment of aggregated positions with live prices → the holdings table
 * model: market value, unrealized P&L ($ and %), portfolio weight, and totals.
 *
 * Mirrors the math in the Python `app.render_positions`: only positions with a
 * known live price contribute to the totals, so a failed price fetch degrades
 * gracefully (that row shows cost basis with null market fields, no crash).
 */
import type { Position } from "./portfolio";

export interface HoldingRow extends Position {
  price: number | null;
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  weightPct: number | null;
}

export interface Totals {
  marketValue: number;
  costBasis: number;
  unrealized: number;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function enrichHoldings(
  positions: Position[],
  prices: Record<string, number | null>,
): { rows: HoldingRow[]; totals: Totals } {
  // Totals first — only priced positions count — so weights can reference them.
  let totalValue = 0;
  let totalCostPriced = 0;
  const priced = positions.map((p) => {
    const price = prices[p.ticker] ?? null;
    const marketValue = price !== null ? round(price * p.quantity, 2) : null;
    if (marketValue !== null) {
      totalValue += marketValue;
      totalCostPriced += p.costBasis;
    }
    return { p, price, marketValue };
  });

  const rows: HoldingRow[] = priced.map(({ p, price, marketValue }) => {
    const unrealized =
      marketValue !== null ? round(marketValue - p.costBasis, 2) : null;
    const unrealizedPct =
      unrealized !== null && p.costBasis
        ? round((unrealized / p.costBasis) * 100, 2)
        : null;
    const weightPct =
      marketValue !== null && totalValue
        ? round((marketValue / totalValue) * 100, 1)
        : null;
    return { ...p, price, marketValue, unrealized, unrealizedPct, weightPct };
  });

  return {
    rows,
    totals: {
      marketValue: round(totalValue, 2),
      costBasis: round(totalCostPriced, 2),
      unrealized: round(totalValue - totalCostPriced, 2),
    },
  };
}
