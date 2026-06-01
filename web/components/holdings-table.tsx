import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HoldingRow, Totals } from "@/lib/holdings";

function money(n: number | null): string {
  return n === null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(2)}%`;
}
function pnlClass(n: number | null): string {
  if (n === null) return "text-slate-400";
  return n >= 0 ? "text-emerald-400" : "text-red-400";
}

export function HoldingsTable({ rows, totals }: { rows: HoldingRow[]; totals: Totals }) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-400">
        No open positions yet. Add a buy above to start tracking your book.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Metric label="Portfolio value" value={money(totals.marketValue)} />
        <Metric label="Cost basis" value={money(totals.costBasis)} />
        <Metric
          label="Unrealized P&L"
          value={money(totals.unrealized)}
          className={pnlClass(totals.unrealized)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Avg cost</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Mkt value</TableHead>
            <TableHead className="text-right">Unreal $</TableHead>
            <TableHead className="text-right">Unreal %</TableHead>
            <TableHead className="text-right">Weight</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.ticker}>
              <TableCell className="font-medium">{r.ticker}</TableCell>
              <TableCell className="text-right">{r.quantity}</TableCell>
              <TableCell className="text-right">{money(r.avgCost)}</TableCell>
              <TableCell className="text-right">
                {r.price === null ? (
                  <span className="text-amber-400" title="Live price unavailable">
                    —
                  </span>
                ) : (
                  money(r.price)
                )}
              </TableCell>
              <TableCell className="text-right">{money(r.marketValue)}</TableCell>
              <TableCell className={`text-right ${pnlClass(r.unrealized)}`}>
                {money(r.unrealized)}
              </TableCell>
              <TableCell className={`text-right ${pnlClass(r.unrealized)}`}>
                {pct(r.unrealizedPct)}
              </TableCell>
              <TableCell className="text-right">
                {r.weightPct === null ? "—" : `${r.weightPct}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <details key={r.ticker} className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
            <summary className="cursor-pointer text-sm text-slate-300">
              {r.ticker} — {r.batches.length} purchase batch(es)
            </summary>
            <table className="mt-2 w-full text-sm text-slate-400">
              <thead>
                <tr className="text-left">
                  <th className="py-1">Qty</th>
                  <th className="py-1">Price / share</th>
                  <th className="py-1">Date</th>
                </tr>
              </thead>
              <tbody>
                {r.batches.map((b, i) => (
                  <tr key={i}>
                    <td className="py-1">{b.quantity}</td>
                    <td className="py-1">{money(b.pricePerShare)}</td>
                    <td className="py-1">{b.tradedAt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${className}`}>{value}</div>
    </div>
  );
}
