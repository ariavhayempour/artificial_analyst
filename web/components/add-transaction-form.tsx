"use client";

import { useState, useTransition } from "react";

import { addTransactionAction } from "@/app/(dashboard)/actions";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function AddTransactionForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const input = {
      ticker: String(data.get("ticker") ?? ""),
      side: String(data.get("side") ?? "buy"),
      quantity: String(data.get("quantity") ?? ""),
      pricePerShare: String(data.get("price") ?? ""),
      tradedAt: String(data.get("tradedAt") ?? "") || null,
    };

    startTransition(async () => {
      const res = await addTransactionAction(input);
      if ("error" in res) {
        setError(res.error);
        setDone(null);
      } else {
        setError(null);
        setDone(
          `${input.side.toUpperCase()} ${input.quantity} ${input.ticker.toUpperCase().trim()} recorded`,
        );
        form.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Ticker">
        <input
          name="ticker"
          placeholder="NVDA"
          className="input-term w-28 uppercase"
          required
        />
      </Field>
      <Field label="Side">
        <select name="side" className="input-term w-24">
          <option value="buy">buy</option>
          <option value="sell">sell</option>
        </select>
      </Field>
      <Field label="Quantity">
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          className="input-term w-28"
          required
        />
      </Field>
      <Field label="Price / Share">
        <input
          name="price"
          type="number"
          step="any"
          min="0"
          className="input-term w-32"
          required
        />
      </Field>
      <Field label="Trade Date">
        <input name="tradedAt" type="date" className="input-term w-40" />
      </Field>
      <button type="submit" disabled={pending} className="btn-term btn-exec h-[2.1rem]">
        {pending ? "…" : "+ Record"}
      </button>
      {error && <p className="w-full text-sm text-neg">⚠ {error}</p>}
      {done && <p className="w-full text-sm text-pos">✓ {done}</p>}
    </form>
  );
}
