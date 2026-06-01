"use client";

import { useState, useTransition } from "react";

import { addTransactionAction } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        setDone(`Added ${input.side} ${input.quantity} ${input.ticker.toUpperCase().trim()}`);
        form.reset();
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticker">Ticker</Label>
        <Input id="ticker" name="ticker" placeholder="NVDA" className="w-28" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="side">Side</Label>
        <select
          id="side"
          name="side"
          className="h-9 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200"
        >
          <option value="buy">buy</option>
          <option value="sell">sell</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Quantity</Label>
        <Input id="quantity" name="quantity" type="number" step="any" min="0" className="w-28" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="price">Price / share</Label>
        <Input id="price" name="price" type="number" step="any" min="0" className="w-32" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tradedAt">Trade date</Label>
        <Input id="tradedAt" name="tradedAt" type="date" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "➕ Add"}
      </Button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
      {done && <p className="w-full text-sm text-emerald-400">{done}</p>}
    </form>
  );
}
