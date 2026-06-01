import { AddTransactionForm } from "@/components/add-transaction-form";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { HoldingsTable } from "@/components/holdings-table";
import { enrichHoldings } from "@/lib/holdings";
import { isMarketError } from "@/lib/market";
import { polygon } from "@/lib/market/polygon";
import { aggregatePositions } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/transactions";

export const dynamic = "force-dynamic";

async function PositionsTab() {
  const supabase = await createClient();
  const txns = await listTransactions(supabase);
  const positions = aggregatePositions(txns);

  // Live prices, fetched server-side and in parallel. A failed quote → null,
  // which the table renders gracefully (cost basis shown, no crash).
  const entries = await Promise.all(
    positions.map(async (p) => {
      const q = await polygon.quote(p.ticker);
      return [p.ticker, isMarketError(q) ? null : q.price] as const;
    }),
  );
  const prices = Object.fromEntries(entries);
  const { rows, totals } = enrichHoldings(positions, prices);

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

export default async function DashboardPage() {
  return (
    <DashboardTabs
      positions={await PositionsTab()}
      realized={<p className="text-slate-400">Realized gains land in the next task.</p>}
      chat={<p className="text-slate-400">The portfolio-aware chat lands soon.</p>}
    />
  );
}
