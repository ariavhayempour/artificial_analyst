import { describe, expect, it, vi } from "vitest";

import {
  addTransaction,
  deleteTransaction,
  listTransactions,
  validateTransaction,
} from "./transactions";

/**
 * Minimal chainable Supabase stub. Every query method returns `this`; awaiting
 * the query resolves to the canned `{ data, error }`. Mirrors how supabase-js
 * resolves a built query without throwing.
 */
class FakeQuery {
  constructor(private result: { data?: unknown; error?: { message: string } | null }) {}
  insert() {
    return this;
  }
  select() {
    return this;
  }
  order() {
    return this;
  }
  delete() {
    return this;
  }
  eq() {
    return this;
  }
  then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve({
      data: this.result.data ?? null,
      error: this.result.error ?? null,
    }).then(onF, onR);
  }
}

function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const from = vi.fn(() => new FakeQuery(result));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { from } as any, from };
}

const VALID = { ticker: "nvda", side: "buy", quantity: 10, pricePerShare: 100 };

describe("validateTransaction", () => {
  it("rejects a side that is not buy or sell", () => {
    expect(validateTransaction({ ...VALID, side: "hold" })).toEqual({
      error: "side must be 'buy' or 'sell'",
    });
  });

  it("rejects an empty ticker", () => {
    expect(validateTransaction({ ...VALID, ticker: "   " })).toEqual({
      error: "ticker is required",
    });
  });

  it("rejects a non-numeric quantity or price", () => {
    expect(validateTransaction({ ...VALID, quantity: "abc" })).toEqual({
      error: "quantity and price must be numbers",
    });
  });

  it("rejects quantity <= 0", () => {
    expect(validateTransaction({ ...VALID, quantity: 0 })).toEqual({
      error: "quantity must be greater than 0",
    });
  });

  it("rejects a negative price", () => {
    expect(validateTransaction({ ...VALID, pricePerShare: -1 })).toEqual({
      error: "price must be 0 or greater",
    });
  });

  it("normalizes a valid input into an insertable row (ticker upper, side lower)", () => {
    const v = validateTransaction({
      ticker: " nvda ",
      side: "BUY",
      quantity: 10,
      pricePerShare: 100,
      tradedAt: "2026-01-01",
    });
    expect(v).toEqual({
      row: {
        ticker: "NVDA",
        side: "buy",
        quantity: 10,
        price_per_share: 100,
        traded_at: "2026-01-01",
      },
    });
  });

  it("omits traded_at when not provided (DB default applies)", () => {
    const v = validateTransaction(VALID);
    expect(v).toEqual({ row: { ticker: "NVDA", side: "buy", quantity: 10, price_per_share: 100 } });
  });
});

describe("addTransaction", () => {
  it("does not touch the database when validation fails", async () => {
    const { client, from } = fakeClient({ data: [] });
    const res = await addTransaction(client, { ...VALID, side: "hold" });
    expect(res).toEqual({ error: "side must be 'buy' or 'sell'" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts a valid transaction and returns the data", async () => {
    const { client, from } = fakeClient({ data: [{ id: "abc", ticker: "NVDA" }] });
    const res = await addTransaction(client, VALID);
    expect(from).toHaveBeenCalledWith("transactions");
    expect(res).toEqual({ data: [{ id: "abc", ticker: "NVDA" }] });
  });

  it("maps a Supabase error to error-as-data (never throws)", async () => {
    const { client } = fakeClient({ error: { message: "RLS denied" } });
    const res = await addTransaction(client, VALID);
    expect(res).toEqual({ error: "RLS denied" });
  });
});

describe("listTransactions", () => {
  it("returns the rows on success", async () => {
    const rows = [{ id: "1", ticker: "NVDA" }];
    const { client } = fakeClient({ data: rows });
    expect(await listTransactions(client)).toEqual(rows);
  });

  it("returns an empty array on error", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });
    expect(await listTransactions(client)).toEqual([]);
  });
});

describe("deleteTransaction", () => {
  it("returns the deleted data on success", async () => {
    const { client, from } = fakeClient({ data: [{ id: "1" }] });
    const res = await deleteTransaction(client, "1");
    expect(from).toHaveBeenCalledWith("transactions");
    expect(res).toEqual({ data: [{ id: "1" }] });
  });

  it("maps a Supabase error to error-as-data", async () => {
    const { client } = fakeClient({ error: { message: "not found" } });
    expect(await deleteTransaction(client, "1")).toEqual({ error: "not found" });
  });
});
