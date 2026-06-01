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

load_dotenv(override=True)  # .env is the source of truth, even over stale shell vars

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


@cache.memoize(expire=300)
def analyze_technicals(ticker: str, indicators: list = None) -> dict:
    """Compute technical indicators from 6 months of daily closes."""
    if indicators is None:
        indicators = ["rsi", "macd", "bollinger", "sma", "support_resistance"]
    try:
        close = yf.Ticker(ticker).history(period="6mo")["Close"]
        if close.empty:
            return {"ticker": ticker, "error": "No data found — verify ticker symbol"}

        result = {"ticker": ticker, "price": round(float(close.iloc[-1]), 2)}

        if "rsi" in indicators:
            rsi = ta.momentum.RSIIndicator(close, window=14).rsi().iloc[-1]
            result["rsi_14"] = round(float(rsi), 1)
            result["rsi_signal"] = (
                "Overbought" if rsi > 70 else "Oversold" if rsi < 30 else "Neutral"
            )

        if "macd" in indicators:
            macd = ta.trend.MACD(close)
            hist = macd.macd_diff().iloc[-1]
            result["macd"] = round(float(macd.macd().iloc[-1]), 4)
            result["macd_signal"] = round(float(macd.macd_signal().iloc[-1]), 4)
            result["macd_histogram"] = round(float(hist), 4)
            result["macd_trend"] = (
                "Bullish crossover" if hist > 0 else "Bearish crossover"
            )

        if "bollinger" in indicators:
            bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
            pct_b = bb.bollinger_pband().iloc[-1]
            result["bb_upper"] = round(float(bb.bollinger_hband().iloc[-1]), 2)
            result["bb_mid"] = round(float(bb.bollinger_mavg().iloc[-1]), 2)
            result["bb_lower"] = round(float(bb.bollinger_lband().iloc[-1]), 2)
            result["bb_pct_b"] = round(float(pct_b), 2)
            result["bb_position"] = (
                "Near upper band" if pct_b > 0.8
                else "Near lower band" if pct_b < 0.2
                else "Mid-range"
            )

        if "sma" in indicators:
            sma_20 = close.rolling(20).mean().iloc[-1]
            sma_50 = close.rolling(50).mean().iloc[-1]
            sma_200 = close.rolling(200).mean().iloc[-1]
            result["sma_20"] = round(float(sma_20), 2)
            result["sma_50"] = round(float(sma_50), 2)
            result["sma_200"] = round(float(sma_200), 2)
            result["above_200sma"] = bool(close.iloc[-1] > sma_200)
            result["golden_cross"] = bool(sma_50 > sma_200)

        if "support_resistance" in indicators:
            last60 = close.iloc[-60:]
            price = close.iloc[-1]
            support = round(float(last60.min()), 2)
            resistance = round(float(last60.max()), 2)
            result["support"] = support
            result["resistance"] = resistance
            result["pct_from_support"] = round((price - support) / support * 100, 1)
            result["pct_from_resistance"] = round(
                (resistance - price) / resistance * 100, 1
            )

        return result
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


_OPTION_COLUMNS = ["strike", "lastPrice", "bid", "ask", "volume", "openInterest", "impliedVolatility"]


@cache.memoize(expire=120)
def get_options_chain(ticker: str, expiration: str = "next", strike_range_pct: float = 0.10) -> dict:
    """Calls and puts within a strike band around the current price."""
    try:
        stk = yf.Ticker(ticker)
        price = stk.info.get("currentPrice")
        if not price:
            price = stk.history(period="1d")["Close"].iloc[-1]

        dates = stk.options
        if not dates:
            return {"ticker": ticker, "error": "No options data available"}

        exp_date = dates[0] if expiration == "next" else expiration
        chain = stk.option_chain(exp_date)

        lo = price * (1 - strike_range_pct)
        hi = price * (1 + strike_range_pct)

        def _band(df):
            within = df[(df["strike"] >= lo) & (df["strike"] <= hi)]
            return within[_OPTION_COLUMNS].to_dict("records")

        return {
            "ticker": ticker,
            "current_price": round(float(price), 2),
            "expiration": exp_date,
            "available_expirations": list(dates[:5]),
            "calls": _band(chain.calls),
            "puts": _band(chain.puts),
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


@cache.memoize(expire=600)
def get_market_news(ticker: str, days_back: int = 7) -> dict:
    """Recent Finnhub news headlines plus a sentiment breakdown."""
    if not os.getenv("FINNHUB_API_KEY"):
        return {"ticker": ticker, "error": "Finnhub API key not configured"}
    try:
        end = datetime.now()
        start = end - timedelta(days=days_back)
        news = fh.company_news(
            ticker,
            _from=start.strftime("%Y-%m-%d"),
            to=end.strftime("%Y-%m-%d"),
        )
        sent = fh.news_sentiment(ticker)
        sentiment = sent.get("sentiment", {}) or {}

        top_news = [
            {
                "headline": item.get("headline"),
                "source": item.get("source"),
                "time": datetime.fromtimestamp(item.get("datetime", 0)).strftime("%m-%d %H:%M"),
            }
            for item in news[:8]
        ]

        return {
            "ticker": ticker,
            "sentiment_score": sent.get("companyNewsScore"),
            "bullish_pct": sentiment.get("bullishPercent"),
            "bearish_pct": sentiment.get("bearishPercent"),
            "article_count": len(news),
            "top_news": top_news,
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}
