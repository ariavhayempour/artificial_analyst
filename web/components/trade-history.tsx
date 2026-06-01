"use client";

import { useState, useTransition } from "react";

import { deleteTransactionAction } from "@/app/(dashboard)/actions";
import type { Transaction } from "@/lib/portfolio";

function money(v: number | string): string {
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TradeHistory({ txns }: { txns: Transaction[] }) {
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (txns.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        <span className="text-amber">$</span> no trades yet — add transactions on
        the Positions view.
      </p>
    );
  }

  function remove(id: string) {
    setDeletingId(id);
    setError(null);
    startTransition(async () => {
      const res = await deleteTransactionAction(id);
      if ("error" in res) setError(res.error);
      setDeletingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-neg">⚠ {error}</p>}
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ticker</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td className="!text-left">{t.traded_at ?? "—"}</td>
                <td className="!text-left font-semibold text-ink">{t.ticker}</td>
                <td className="!text-left">
                  <span
                    className={`inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-wider ${
                      t.side === "buy" ? "text-pos" : "text-neg"
                    }`}
                  >
                    {t.side === "buy" ? "▲ buy" : "▼ sell"}
                  </span>
                </td>
                <td>{Number(t.quantity)}</td>
                <td>{money(t.price_per_share)}</td>
                <td>
                  {t.id && (
                    <button
                      type="button"
                      onClick={() => remove(t.id!)}
                      disabled={pending && deletingId === t.id}
                      className="btn-term px-2 py-1 hover:!border-neg/50 hover:!text-neg"
                      aria-label={`Delete ${t.side} ${t.ticker}`}
                    >
                      {pending && deletingId === t.id ? "…" : "✕"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
