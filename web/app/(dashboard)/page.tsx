import { DashboardClient } from "@/components/dashboard-client";
import { enrichHoldings } from "@/lib/holdings";
import { isMarketError } from "@/lib/market";
import { polygon } from "@/lib/market/polygon";
import { aggregatePositions, realizedPnl, sortTradeHistory } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/transactions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const txns = await listTransactions(supabase);
  const positions = aggregatePositions(txns);

  // Live prices, fetched server-side and in parallel; a failed quote → null,
  // which the holdings table renders gracefully (cost basis shown, no crash).
  const entries = await Promise.all(
    positions.map(async (p) => {
      const q = await polygon.quote(p.ticker);
      return [p.ticker, isMarketError(q) ? null : q.price] as const;
    }),
  );
  const { rows, totals } = enrichHoldings(positions, Object.fromEntries(entries));

  return (
    <DashboardClient
      rows={rows}
      totals={totals}
      realized={realizedPnl(txns)}
      history={sortTradeHistory(txns)}
      userEmail={user?.email ?? ""}
    />
  );
}
