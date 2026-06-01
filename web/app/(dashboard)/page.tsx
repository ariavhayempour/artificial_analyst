import { AddTransactionForm } from "@/components/add-transaction-form";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { HoldingsTable } from "@/components/holdings-table";
import { RealizedTable } from "@/components/realized-table";
import { TradeHistory } from "@/components/trade-history";
import { enrichHoldings } from "@/lib/holdings";
import { isMarketError } from "@/lib/market";
import { polygon } from "@/lib/market/polygon";
import {
  aggregatePositions,
  realizedPnl,
  sortTradeHistory,
  type Transaction,
} from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/transactions";

export const dynamic = "force-dynamic";

async function positionsContent(txns: Transaction[]) {
  const positions = aggregatePositions(txns);

  // Live prices, fetched server-side and in parallel. A failed quote → null,
  // which the table renders gracefully (cost basis shown, no crash).
  const entries = await Promise.all(
    positions.map(async (p) => {
      const q = await polygon.quote(p.ticker);
      return [p.ticker, isMarketError(q) ? null : q.price] as const;
    }),
  );
  const { rows, totals } = enrichHoldings(positions, Object.fromEntries(entries));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Add transaction</h2>
        <AddTransactionForm />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Holdings</h2>
        <HoldingsTable rows={rows} totals={totals} />
      </section>
    </div>
  );
}

function realizedContent(txns: Transaction[]) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Realized gains</h2>
        <RealizedTable realized={realizedPnl(txns)} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Trade history</h2>
        <TradeHistory txns={sortTradeHistory(txns)} />
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const txns = await listTransactions(supabase);

  return (
    <DashboardTabs
      positions={await positionsContent(txns)}
      realized={realizedContent(txns)}
      chat={<p className="text-slate-400">The portfolio-aware chat lands soon.</p>}
    />
  );
}
