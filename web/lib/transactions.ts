/**
 * Transactions data layer. All operations run under the signed-in user's JWT
 * (the caller passes an `@supabase/ssr` server client), so Postgres RLS scopes
 * every row to `auth.uid()`. Validation and error-as-data mirror `db.py`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Transaction } from "./portfolio";

export interface NewTransaction {
  ticker: string;
  side: string;
  quantity: number | string;
  pricePerShare: number | string;
  tradedAt?: string | null;
}

interface TxnRow {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price_per_share: number;
  traded_at?: string;
}

export type TxnResult = { data: unknown[] } | { error: string };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Validate and normalize a transaction. Returns `{ row }` ready to insert, or
 * `{ error }`. Ported from the input checks in `db.add_transaction`.
 */
export function validateTransaction(
  input: NewTransaction,
): { error: string } | { row: TxnRow } {
  const side = (input.side ?? "").toLowerCase();
  if (side !== "buy" && side !== "sell") {
    return { error: "side must be 'buy' or 'sell'" };
  }
  if (!(input.ticker ?? "").trim()) {
    return { error: "ticker is required" };
  }
  const quantity = Number(input.quantity);
  const pricePerShare = Number(input.pricePerShare);
  if (!Number.isFinite(quantity) || !Number.isFinite(pricePerShare)) {
    return { error: "quantity and price must be numbers" };
  }
  if (quantity <= 0) {
    return { error: "quantity must be greater than 0" };
  }
  if (pricePerShare < 0) {
    return { error: "price must be 0 or greater" };
  }

  const row: TxnRow = {
    ticker: input.ticker.toUpperCase().trim(),
    side,
    quantity,
    price_per_share: pricePerShare,
  };
  if (input.tradedAt) row.traded_at = input.tradedAt;
  return { row };
}

/** Insert a buy/sell after validation. Error-as-data; never throws. */
export async function addTransaction(
  supabase: SupabaseClient,
  input: NewTransaction,
): Promise<TxnResult> {
  const v = validateTransaction(input);
  if ("error" in v) return v;
  try {
    const { data, error } = await supabase.from("transactions").insert(v.row).select();
    if (error) return { error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** All of the signed-in user's transactions, oldest first. `[]` on failure. */
export async function listTransactions(
  supabase: SupabaseClient,
): Promise<Transaction[]> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("traded_at");
    if (error) return [];
    return (data ?? []) as Transaction[];
  } catch {
    return [];
  }
}

/** Delete one of the user's transactions by id. Error-as-data on failure. */
export async function deleteTransaction(
  supabase: SupabaseClient,
  id: string,
): Promise<TxnResult> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .select();
    if (error) return { error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
