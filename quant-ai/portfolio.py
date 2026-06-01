"""Pure portfolio derivation: a transactions ledger → holdings and realized P&L.

No network, no database — just math, so it's fast and trivially unit-testable.
Cost basis uses the **average-cost** method: each buy re-averages the cost of the
held shares; a sell books realized P&L against that running average and leaves the
average unchanged. (FIFO / tax lots are intentionally out of scope.)
"""
from collections import OrderedDict

_EPS = 1e-9


def _chrono(txns: list) -> list:
    """Transactions oldest-first. Ties broken by created_at, then original order."""
    return [
        t
        for _, t in sorted(
            enumerate(txns),
            key=lambda it: (
                str(it[1].get("traded_at", "")),
                str(it[1].get("created_at", "")),
                it[0],
            ),
        )
    ]


def _group_by_ticker(txns: list) -> "OrderedDict[str, list]":
    groups: "OrderedDict[str, list]" = OrderedDict()
    for t in txns:
        groups.setdefault(t["ticker"], []).append(t)
    return groups


def _walk(ticker_txns: list):
    """Replay one ticker's transactions in time order.

    Returns ``(quantity, avg_cost, buy_batches, sales)`` where sales is a list of
    per-sell realized-P&L records.
    """
    quantity = 0.0
    cost_total = 0.0   # cost basis of the shares currently held
    buys = []
    sales = []

    for t in _chrono(ticker_txns):
        qty = float(t["quantity"])
        price = float(t["price_per_share"])

        if t["side"] == "buy":
            quantity += qty
            cost_total += qty * price
            buys.append(
                {"quantity": qty, "price_per_share": price, "traded_at": t.get("traded_at")}
            )
        else:  # sell
            avg = cost_total / quantity if quantity > _EPS else 0.0
            basis = avg * qty
            proceeds = price * qty
            sales.append(
                {
                    "ticker": t["ticker"],
                    "quantity": qty,
                    "price_per_share": price,
                    "traded_at": t.get("traded_at"),
                    "cost_basis": round(basis, 2),
                    "proceeds": round(proceeds, 2),
                    "realized": round(proceeds - basis, 2),
                }
            )
            quantity -= qty
            cost_total -= basis
            if quantity < _EPS:   # fully closed (or over-sold) — reset cleanly
                quantity = 0.0
                cost_total = 0.0

    avg_cost = cost_total / quantity if quantity > _EPS else 0.0
    return quantity, avg_cost, buys, sales


def aggregate_positions(txns: list) -> list:
    """One entry per open ticker, with net quantity, average cost, and buy batches.

    Tickers whose net quantity is zero (fully sold) are omitted. Sorted by ticker.
    """
    positions = []
    for ticker, group in _group_by_ticker(txns).items():
        quantity, avg_cost, buys, _ = _walk(group)
        if quantity <= _EPS:
            continue
        positions.append(
            {
                "ticker": ticker,
                "quantity": round(quantity, 4),
                "avg_cost": round(avg_cost, 4),
                "cost_basis": round(quantity * avg_cost, 2),
                "batches": buys,
            }
        )
    positions.sort(key=lambda p: p["ticker"])
    return positions


def realized_pnl(txns: list) -> dict:
    """Realized gain/loss per sell (average-cost basis) plus the grand total."""
    sales = []
    for group in _group_by_ticker(txns).values():
        sales.extend(_walk(group)[3])
    total = round(sum(s["realized"] for s in sales), 2)
    return {"sales": sales, "total": total}
