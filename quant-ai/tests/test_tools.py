"""Tests for the financial data tools."""
from unittest.mock import MagicMock, patch

import pandas as pd

from tools import analyze_technicals, get_stock_data


def _fake_ticker(closes, volumes, info, calendar=None):
    fake = MagicMock()
    fake.history.return_value = pd.DataFrame({"Close": closes, "Volume": volumes})
    fake.info = info
    fake.calendar = calendar if calendar is not None else {"Earnings Date": ["2026-06-15"]}
    return fake


def _fake_close_ticker(closes):
    fake = MagicMock()
    fake.history.return_value = pd.DataFrame({"Close": closes})
    return fake


# ---- get_stock_data -------------------------------------------------------

def test_get_stock_data_returns_base_and_fundamental_keys():
    closes = [float(i) for i in range(1, 31)]  # 1..30, last = 30, [-2] = 29, [-22] = 9
    info = {
        "currentPrice": 30.0,
        "fiftyTwoWeekHigh": 50.0,
        "fiftyTwoWeekLow": 10.0,
        "marketCap": 1_000_000,
        "trailingPE": 25.0,
        "forwardPE": 20.0,
        "pegRatio": 1.5,
        "trailingEps": 1.2,
        "earningsGrowth": 0.1,
        "revenueGrowth": 0.2,
        "profitMargins": 0.3,
        "targetMeanPrice": 35.0,
        "recommendationMean": 2.0,
        "shortPercentOfFloat": 0.05,
    }
    fake = _fake_ticker(closes, [1000] * 30, info)

    with patch("tools.yf.Ticker", return_value=fake):
        result = get_stock_data("aapl")

    # base keys
    assert result["ticker"] == "AAPL"
    assert result["price"] == 30.0
    assert result["change_1d_pct"] == round((30 / 29 - 1) * 100, 2)
    assert result["change_1mo_pct"] == round((30 / 9 - 1) * 100, 2)
    assert result["52w_high"] == 50.0
    assert result["52w_low"] == 10.0
    assert result["avg_volume"] == 1000
    assert result["market_cap"] == 1_000_000
    # fundamentals (default include_fundamentals=True)
    assert result["pe_ttm"] == 25.0
    assert result["pe_forward"] == 20.0
    assert result["peg_ratio"] == 1.5
    assert result["analyst_rating"] == 2.0
    assert result["next_earnings"] == "2026-06-15"


def test_get_stock_data_excludes_fundamentals_when_disabled():
    closes = [float(i) for i in range(1, 31)]
    fake = _fake_ticker(closes, [1000] * 30, {"currentPrice": 30.0})

    with patch("tools.yf.Ticker", return_value=fake):
        result = get_stock_data("MSFT", include_fundamentals=False)

    assert result["ticker"] == "MSFT"
    assert result["price"] == 30.0
    assert "pe_ttm" not in result
    assert "analyst_rating" not in result


def test_get_stock_data_falls_back_to_last_close_when_no_current_price():
    closes = [float(i) for i in range(1, 31)]
    fake = _fake_ticker(closes, [1000] * 30, {"currentPrice": None})

    with patch("tools.yf.Ticker", return_value=fake):
        result = get_stock_data("NVDA", include_fundamentals=False)

    assert result["price"] == 30.0


def test_get_stock_data_returns_error_dict_on_exception():
    with patch("tools.yf.Ticker", side_effect=RuntimeError("network down")):
        result = get_stock_data("BADTICKER", include_fundamentals=False)

    assert result["ticker"] == "BADTICKER"
    assert "error" in result
    assert "network down" in result["error"]


# ---- analyze_technicals ---------------------------------------------------

def test_analyze_technicals_returns_all_indicators_by_default():
    closes = [float(i) for i in range(1, 251)]  # strictly rising 1..250
    fake = _fake_close_ticker(closes)

    with patch("tools.yf.Ticker", return_value=fake):
        result = analyze_technicals("aapl")

    assert result["ticker"] == "aapl"
    assert result["price"] == 250.0
    # rsi
    assert result["rsi_signal"] == "Overbought"  # all gains -> RSI ~100
    # macd
    assert "macd" in result and "macd_trend" in result
    # bollinger
    assert "bb_upper" in result and result["bb_position"] == "Near upper band"
    # sma — rising series sits above its long average with 50 > 200
    assert result["above_200sma"] is True
    assert result["golden_cross"] is True
    # support/resistance from last 60 closes (191..250)
    assert result["support"] == 191.0
    assert result["resistance"] == 250.0
    assert result["pct_from_resistance"] == 0.0


def test_analyze_technicals_respects_indicator_filter():
    closes = [float(i) for i in range(1, 251)]
    fake = _fake_close_ticker(closes)

    with patch("tools.yf.Ticker", return_value=fake):
        result = analyze_technicals("MSFT", ["rsi"])

    assert set(result.keys()) == {"ticker", "price", "rsi_14", "rsi_signal"}


def test_analyze_technicals_flags_oversold_on_falling_series():
    closes = [float(i) for i in range(250, 0, -1)]  # strictly falling 250..1
    fake = _fake_close_ticker(closes)

    with patch("tools.yf.Ticker", return_value=fake):
        result = analyze_technicals("NVDA", ["rsi", "sma"])

    assert result["rsi_signal"] == "Oversold"  # all losses -> RSI ~0
    assert result["above_200sma"] is False
    assert result["golden_cross"] is False


def test_analyze_technicals_returns_error_dict_on_exception():
    with patch("tools.yf.Ticker", side_effect=RuntimeError("boom")):
        result = analyze_technicals("BAD")

    assert result["ticker"] == "BAD"
    assert "boom" in result["error"]
