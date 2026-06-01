import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RealizedPnl } from "@/lib/portfolio";

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RealizedTable({ realized }: { realized: RealizedPnl }) {
  const pnlClass = realized.total >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Total realized P&amp;L
        </div>
        <div className={`mt-1 text-2xl font-semibold ${pnlClass}`}>
          {money(realized.total)}
        </div>
      </div>

      {realized.sales.length === 0 ? (
        <p className="text-slate-400">
          No closed lots yet — realized P&amp;L appears once you record a sell.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Sell price</TableHead>
              <TableHead className="text-right">Cost basis</TableHead>
              <TableHead className="text-right">Proceeds</TableHead>
              <TableHead className="text-right">Realized</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {realized.sales.map((s, i) => (
              <TableRow key={i}>
                <TableCell>{s.tradedAt ?? "—"}</TableCell>
                <TableCell className="font-medium">{s.ticker}</TableCell>
                <TableCell className="text-right">{s.quantity}</TableCell>
                <TableCell className="text-right">{money(s.pricePerShare)}</TableCell>
                <TableCell className="text-right">{money(s.costBasis)}</TableCell>
                <TableCell className="text-right">{money(s.proceeds)}</TableCell>
                <TableCell
                  className={`text-right ${s.realized >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {money(s.realized)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
