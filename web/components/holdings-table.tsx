"use client";

import type { HoldingRow, Totals } from "@/lib/holdings";

function money(n: number | null): string {
  return n === null
    ? "—"
    : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(2)}%`;
}
function pnlClass(n: number | null): string {
  if (n === null) return "text-ink-faint";
  return n >= 0 ? "text-pos" : "text-neg";
}
function arrow(n: number | null): string {
  if (n === null) return "·";
  return n >= 0 ? "▲" : "▼";
}

export function HoldingsTable({
  rows,
  totals,
  onAnalyze,
}: {
  rows: HoldingRow[];
  totals: Totals;
  onAnalyze?: (ticker: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        <span className="text-amber">$</span> no open positions — record a buy
        above to start tracking your book.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
        <Metric label="Portfolio Value" value={money(totals.marketValue)} />
        <Metric label="Cost Basis" value={money(totals.costBasis)} />
        <Metric
          label="Unrealized P&L"
          value={`${arrow(totals.unrealized)} ${money(totals.unrealized)}`}
          className={pnlClass(totals.unrealized)}
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Qty</th>
              <th>Avg Cost</th>
              <th>Price</th>
              <th>Mkt Value</th>
              <th>Unreal $</th>
              <th>Unreal %</th>
              <th>Weight</th>
              {onAnalyze && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker}>
                <td>
                  <span className="font-semibold text-ink">{r.ticker}</span>
                </td>
                <td>{r.quantity}</td>
                <td>{money(r.avgCost)}</td>
                <td>
                  {r.price === null ? (
                    <span className="text-amber" title="Live price unavailable">
                      ⚠ —
                    </span>
                  ) : (
                    money(r.price)
                  )}
                </td>
                <td className="text-ink">{money(r.marketValue)}</td>
                <td className={pnlClass(r.unrealized)}>
                  {arrow(r.unrealized)} {money(r.unrealized)}
                </td>
                <td className={pnlClass(r.unrealized)}>{pct(r.unrealizedPct)}</td>
                <td>
                  <span className="flex items-center justify-end gap-2">
                    <span className="tnum text-ink-dim">
                      {r.weightPct === null ? "—" : `${r.weightPct}%`}
                    </span>
                    {r.weightPct !== null && (
                      <span
                        className="wbar"
                        style={{ width: `${Math.max(4, r.weightPct * 0.6)}px` }}
                        aria-hidden
                      />
                    )}
                  </span>
                </td>
                {onAnalyze && (
                  <td>
                    <button
                      type="button"
                      onClick={() => onAnalyze(r.ticker)}
                      className="btn-term px-2 py-1"
                      aria-label={`Analyze ${r.ticker}`}
                    >
                      ⌕ Analyze
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <details
            key={r.ticker}
            className="group rounded-sm border border-line bg-panel-2/40 px-3 py-2"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-ink-dim">
              <span className="text-ink-faint transition-transform group-open:rotate-90">
                ▸
              </span>
              <span className="font-semibold text-ink">{r.ticker}</span>
              <span className="text-ink-faint">
                {r.batches.length} purchase batch
                {r.batches.length === 1 ? "" : "es"}
              </span>
            </summary>
            <table className="grid-table mt-2">
              <thead>
                <tr>
                  <th>Qty</th>
                  <th>Price / Share</th>
                  <th>Trade Date</th>
                </tr>
              </thead>
              <tbody>
                {r.batches.map((b, i) => (
                  <tr key={i}>
                    <td className="!text-left">{b.quantity}</td>
                    <td className="!text-left">{money(b.pricePerShare)}</td>
                    <td className="!text-left">{b.tradedAt ?? "—"}</td>
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
    <div className="bg-panel p-4">
      <div className="label">{label}</div>
      <div className={`mt-1.5 text-xl font-semibold tnum ${className || "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
