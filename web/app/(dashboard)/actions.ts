"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  addTransaction,
  deleteTransaction,
  type NewTransaction,
  type TxnResult,
} from "@/lib/transactions";

/** Add a transaction for the signed-in user, then refresh the dashboard. */
export async function addTransactionAction(
  input: NewTransaction,
): Promise<TxnResult> {
  const supabase = await createClient();
  const res = await addTransaction(supabase, input);
  if (!("error" in res)) revalidatePath("/");
  return res;
}

/** Delete one of the user's transactions, then refresh the dashboard. */
export async function deleteTransactionAction(id: string): Promise<TxnResult> {
  const supabase = await createClient();
  const res = await deleteTransaction(supabase, id);
  if (!("error" in res)) revalidatePath("/");
  return res;
}
