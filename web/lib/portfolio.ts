/**
 * Pure portfolio derivation: a transactions ledger → holdings and realized P&L.
 *
 * No network, no database — just math, so it's fast and trivially unit-testable.
 * Ported from the Python `portfolio.py` reference (kept in numeric parity).
 *
 * Cost basis uses the **average-cost** method: each buy re-averages the cost of
 * the held shares; a sell books realized P&L against that running average and
 * leaves the average unchanged. (FIFO / tax lots are intentionally out of scope.)
 */

const EPS = 1e-9;

/** A ledger row. Numerics may arrive as strings from PostgREST — coerced below. */
export interface Transaction {
  ticker: string;
  side: "buy" | "sell";
  quantity: number | string;
  price_per_share: number | string;
  traded_at?: string | null;
  created_at?: string | null;
}

export interface Batch {
  quantity: number;
  pricePerShare: number;
  tradedAt: string | null;
}

export interface Position {
  ticker: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  batches: Batch[];
}

export interface Sale {
  ticker: string;
  quantity: number;
  pricePerShare: number;
  tradedAt: string | null;
  costBasis: number;
  proceeds: number;
  realized: number;
}

export interface RealizedPnl {
  sales: Sale[];
  total: number;
}

function num(v: number | string): number {
  return typeof v === "number" ? v : Number(v);
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Transactions oldest-first. Ties broken by created_at, then original order. */
function chrono(txns: Transaction[]): Transaction[] {
  return txns
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const ka = [String(a.t.traded_at ?? ""), String(a.t.created_at ?? "")];
      const kb = [String(b.t.traded_at ?? ""), String(b.t.created_at ?? "")];
      for (let j = 0; j < ka.length; j++) {
        if (ka[j] < kb[j]) return -1;
        if (ka[j] > kb[j]) return 1;
      }
      return a.i - b.i;
    })
    .map(({ t }) => t);
}

/** Group by ticker, preserving first-appearance order (Map keeps insertion order). */
function groupByTicker(txns: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const arr = groups.get(t.ticker);
    if (arr) arr.push(t);
    else groups.set(t.ticker, [t]);
  }
  return groups;
}

/** Replay one ticker's transactions in time order. */
function walk(tickerTxns: Transaction[]): {
  quantity: number;
  avgCost: number;
  buys: Batch[];
  sales: Sale[];
} {
  let quantity = 0;
  let costTotal = 0; // cost basis of the shares currently held
  const buys: Batch[] = [];
  const sales: Sale[] = [];

  for (const t of chrono(tickerTxns)) {
    const qty = num(t.quantity);
    const price = num(t.price_per_share);

    if (t.side === "buy") {
      quantity += qty;
      costTotal += qty * price;
      buys.push({ quantity: qty, pricePerShare: price, tradedAt: t.traded_at ?? null });
    } else {
      const avg = quantity > EPS ? costTotal / quantity : 0;
      const basis = avg * qty;
      const proceeds = price * qty;
      sales.push({
        ticker: t.ticker,
        quantity: qty,
        pricePerShare: price,
        tradedAt: t.traded_at ?? null,
        costBasis: round(basis, 2),
        proceeds: round(proceeds, 2),
        realized: round(proceeds - basis, 2),
      });
      quantity -= qty;
      costTotal -= basis;
      if (quantity < EPS) {
        // fully closed (or over-sold) — reset cleanly
        quantity = 0;
        costTotal = 0;
      }
    }
  }

  const avgCost = quantity > EPS ? costTotal / quantity : 0;
  return { quantity, avgCost, buys, sales };
}

/**
 * One entry per open ticker, with net quantity, average cost, and buy batches.
 * Tickers whose net quantity is zero (fully sold) are omitted. Sorted by ticker.
 */
export function aggregatePositions(txns: Transaction[]): Position[] {
  const positions: Position[] = [];
  for (const [ticker, group] of groupByTicker(txns)) {
    const { quantity, avgCost, buys } = walk(group);
    if (quantity <= EPS) continue;
    positions.push({
      ticker,
      quantity: round(quantity, 4),
      avgCost: round(avgCost, 4),
      costBasis: round(quantity * avgCost, 2),
      batches: buys,
    });
  }
  positions.sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));
  return positions;
}

/** Realized gain/loss per sell (average-cost basis) plus the grand total. */
export function realizedPnl(txns: Transaction[]): RealizedPnl {
  const sales: Sale[] = [];
  for (const group of groupByTicker(txns).values()) {
    sales.push(...walk(group).sales);
  }
  const total = round(
    sales.reduce((sum, s) => sum + s.realized, 0),
    2,
  );
  return { sales, total };
}
