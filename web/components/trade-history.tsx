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
    return <p className="text-slate-400">No trades yet. Add transactions on the Positions tab.</p>;
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{t.traded_at ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{t.ticker}</td>
                <td className="px-3 py-2">{t.side}</td>
                <td className="px-3 py-2 text-right">{Number(t.quantity)}</td>
                <td className="px-3 py-2 text-right">{money(t.price_per_share)}</td>
                <td className="px-3 py-2 text-right">
                  {t.id && (
                    <button
                      type="button"
                      onClick={() => remove(t.id!)}
                      disabled={pending && deletingId === t.id}
                      className="rounded-md border border-slate-700 px-2 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-red-400 disabled:opacity-50"
                      aria-label={`Delete ${t.side} ${t.ticker}`}
                    >
                      {pending && deletingId === t.id ? "…" : "🗑"}
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
