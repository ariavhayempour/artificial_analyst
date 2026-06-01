import type { RealizedPnl } from "@/lib/portfolio";

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RealizedTable({ realized }: { realized: RealizedPnl }) {
  const positive = realized.total >= 0;
  const pnlClass = positive ? "text-pos" : "text-neg";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-sm border border-line bg-panel p-4">
        <div className="label">Total Realized P&L</div>
        <div className={`mt-1.5 text-2xl font-semibold tnum ${pnlClass}`}>
          {positive ? "▲" : "▼"} {money(realized.total)}
        </div>
      </div>

      {realized.sales.length === 0 ? (
        <p className="text-sm text-ink-faint">
          <span className="text-amber">$</span> no closed lots yet — realized P&L
          appears once you record a sell.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticker</th>
                <th>Qty</th>
                <th>Sell Price</th>
                <th>Cost Basis</th>
                <th>Proceeds</th>
                <th>Realized</th>
              </tr>
            </thead>
            <tbody>
              {realized.sales.map((s, i) => (
                <tr key={i}>
                  <td className="!text-left">{s.tradedAt ?? "—"}</td>
                  <td className="!text-left font-semibold text-ink">
                    {s.ticker}
                  </td>
                  <td>{s.quantity}</td>
                  <td>{money(s.pricePerShare)}</td>
                  <td>{money(s.costBasis)}</td>
                  <td>{money(s.proceeds)}</td>
                  <td className={s.realized >= 0 ? "text-pos" : "text-neg"}>
                    {s.realized >= 0 ? "▲" : "▼"} {money(s.realized)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
