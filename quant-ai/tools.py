"""Financial data tools for the Quant AI agent.

Each function returns a plain dict and never raises: on failure it returns
``{"ticker": ticker, "error": <message>}`` so the agent loop and UI degrade
gracefully. Results are memoized to disk to stay within free-tier rate limits.
"""
import os
from datetime import datetime, timedelta

import diskcache
import finnhub
import pandas as pd  # noqa: F401  (used by callers / future tools)
import ta.momentum
import ta.trend
import ta.volatility
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

fh = finnhub.Client(api_key=os.getenv("FINNHUB_API_KEY"))
cache = diskcache.Cache(".cache")


@cache.memoize(expire=300)
def get_stock_data(ticker: str, period: str = "3mo", include_fundamentals: bool = True) -> dict:
    """Current price, volume, 52-week range, and (optionally) fundamentals."""
    ticker = ticker.upper()
    try:
        stk = yf.Ticker(ticker)
        hist = stk.history(period=period)
        info = stk.info

        if hist.empty:
            return {"ticker": ticker, "error": "No data found — verify ticker symbol"}

        close = hist["Close"]
        price = info.get("currentPrice") or close.iloc[-1]

        result = {
            "ticker": ticker,
            "price": round(float(price), 2),
            "change_1d_pct": round((close.iloc[-1] / close.iloc[-2] - 1) * 100, 2),
            "change_1mo_pct": round((close.iloc[-1] / close.iloc[-22] - 1) * 100, 2),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": int(hist["Volume"].mean()),
            "market_cap": info.get("marketCap"),
        }

        if include_fundamentals:
            try:
                next_earnings = str(stk.calendar.get("Earnings Date", ["N/A"])[0])
            except Exception:
                next_earnings = "N/A"

            result.update({
                "pe_ttm": info.get("trailingPE"),
                "pe_forward": info.get("forwardPE"),
                "peg_ratio": info.get("pegRatio"),
                "eps_ttm": info.get("trailingEps"),
                "eps_growth_yoy": info.get("earningsGrowth"),
                "revenue_growth": info.get("revenueGrowth"),
                "profit_margin": info.get("profitMargins"),
                "analyst_target": info.get("targetMeanPrice"),
                "analyst_rating": info.get("recommendationMean"),
                "short_float": info.get("shortPercentOfFloat"),
                "next_earnings": next_earnings,
            })

        return result
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}
