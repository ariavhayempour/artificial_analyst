/**
 * The portfolio read behind the agent's `get_portfolio` tool.
 *
 * Scoping is enforced by the *injected reader*: the route handler binds
 * `listTransactions` to the signed-in user's session client (RLS), so this can
 * only ever return the current user's book. There is no `user_id` parameter for
 * the model to set — see `buildTools`. Returns error-as-data; never throws.
 */
import { aggregatePositions, realizedPnl, type Transaction } from "@/lib/portfolio";

export interface PortfolioDeps {
  /** Reads the signed-in user's transactions (session-scoped — RLS). */
  listTransactions: () => Promise<Transaction[]>;
  /** Live price for a ticker, or null when unavailable. */
  quote: (ticker: string) => Promise<number | null>;
}

export interface EnrichedPosition {
  ticker: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  price: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
}

export interface PortfolioSummary {
  positions: EnrichedPosition[];
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  realizedPnlTotal: number;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export async function loadPortfolio(
  deps: PortfolioDeps,
): Promise<PortfolioSummary | { error: string }> {
  const txns = await deps.listTransactions();
  const positions = aggregatePositions(txns);
  if (positions.length === 0) {
    return { error: "Your portfolio is empty — no open positions." };
  }

  const priced = await Promise.all(
    positions.map(async (p) => ({ p, price: await deps.quote(p.ticker) })),
  );

  let totalValue = 0;
  let totalCostPriced = 0;
  const enriched: EnrichedPosition[] = priced.map(({ p, price }) => {
    const marketValue = price !== null ? round(price * p.quantity, 2) : null;
    const unrealizedPnl =
      marketValue !== null ? round(marketValue - p.costBasis, 2) : null;
    if (marketValue !== null) {
      totalValue += marketValue;
      totalCostPriced += p.costBasis;
    }
    return {
      ticker: p.ticker,
      quantity: p.quantity,
      avgCost: p.avgCost,
      costBasis: p.costBasis,
      price,
      marketValue,
      unrealizedPnl,
    };
  });

  return {
    positions: enriched,
    totalMarketValue: round(totalValue, 2),
    totalCostBasis: round(totalCostPriced, 2),
    totalUnrealizedPnl: round(totalValue - totalCostPriced, 2),
    realizedPnlTotal: realizedPnl(txns).total,
  };
}
