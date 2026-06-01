"""Tests for pure portfolio derivation (portfolio.py).

These are small, fast unit tests: no network, no database. They pin down the
average-cost math for aggregated holdings and realized P&L.
"""
import portfolio


def _txn(ticker, side, qty, price, traded_at):
    return {
        "ticker": ticker,
        "side": side,
        "quantity": qty,
        "price_per_share": price,
        "traded_at": traded_at,
    }


# ---- aggregate_positions --------------------------------------------------

def test_single_buy_becomes_one_position():
    positions = portfolio.aggregate_positions([_txn("NVDA", "buy", 10, 100.0, "2026-01-01")])

    assert positions == [
        {
            "ticker": "NVDA",
            "quantity": 10.0,
            "avg_cost": 100.0,
            "cost_basis": 1000.0,
            "batches": [{"quantity": 10.0, "price_per_share": 100.0, "traded_at": "2026-01-01"}],
        }
    ]


def test_multiple_buys_weight_average_the_cost():
    txns = [
        _txn("NVDA", "buy", 10, 100.0, "2026-01-01"),
        _txn("NVDA", "buy", 5, 130.0, "2026-02-01"),
    ]

    [pos] = portfolio.aggregate_positions(txns)

    assert pos["quantity"] == 15.0
    assert pos["avg_cost"] == 110.0          # (1000 + 650) / 15
    assert pos["cost_basis"] == 1650.0
    assert len(pos["batches"]) == 2


def test_sell_reduces_quantity_but_keeps_avg_cost():
    txns = [
        _txn("NVDA", "buy", 10, 100.0, "2026-01-01"),
        _txn("NVDA", "sell", 4, 130.0, "2026-02-01"),
    ]

    [pos] = portfolio.aggregate_positions(txns)

    assert pos["quantity"] == 6.0
    assert pos["avg_cost"] == 100.0
    assert pos["cost_basis"] == 600.0


def test_fully_sold_ticker_is_excluded_from_holdings():
    txns = [
        _txn("NVDA", "buy", 10, 100.0, "2026-01-01"),
        _txn("NVDA", "sell", 10, 120.0, "2026-02-01"),
    ]

    assert portfolio.aggregate_positions(txns) == []


def test_multiple_tickers_are_separated_and_sorted():
    txns = [
        _txn("TSLA", "buy", 2, 200.0, "2026-01-01"),
        _txn("AAPL", "buy", 3, 150.0, "2026-01-01"),
    ]

    tickers = [p["ticker"] for p in portfolio.aggregate_positions(txns)]

    assert tickers == ["AAPL", "TSLA"]


def test_empty_ledger_has_no_positions():
    assert portfolio.aggregate_positions([]) == []


# ---- realized_pnl ---------------------------------------------------------

def test_realized_pnl_on_a_simple_sale():
    txns = [
        _txn("NVDA", "buy", 10, 100.0, "2026-01-01"),
        _txn("NVDA", "sell", 4, 130.0, "2026-02-01"),
    ]

    result = portfolio.realized_pnl(txns)

    assert result["total"] == 120.0          # (130 - 100) * 4
    [sale] = result["sales"]
    assert sale["ticker"] == "NVDA"
    assert sale["proceeds"] == 520.0
    assert sale["cost_basis"] == 400.0
    assert sale["realized"] == 120.0


def test_realized_pnl_uses_average_cost_across_buys():
    txns = [
        _txn("NVDA", "buy", 10, 100.0, "2026-01-01"),
        _txn("NVDA", "buy", 10, 200.0, "2026-02-01"),   # avg cost now 150
        _txn("NVDA", "sell", 5, 300.0, "2026-03-01"),
    ]

    result = portfolio.realized_pnl(txns)

    assert result["total"] == 750.0          # (300 - 150) * 5


def test_realized_pnl_empty_when_no_sells():
    txns = [_txn("NVDA", "buy", 10, 100.0, "2026-01-01")]

    result = portfolio.realized_pnl(txns)

    assert result == {"sales": [], "total": 0.0}
