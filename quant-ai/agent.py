"""Claude agent: tool definitions, system prompt, and the agentic loop.

The agent fetches live market data through the tools in ``tools.py`` and returns
expert-level analysis. ``run_agent`` drives a tool-use loop until Claude stops
requesting tools and emits a final answer.
"""
import os  # noqa: F401  (kept for parity with tools setup / future use)

import anthropic
from dotenv import load_dotenv

from tools import get_stock_data

load_dotenv()

client = anthropic.Anthropic()

MODEL = "claude-opus-4-8"

SYSTEM_PROMPT = """You are an elite quantitative analyst with 20+ years of experience at top hedge funds including Two Sigma, Renaissance Technologies, and Citadel. You have deep expertise in:
- US equity analysis — both fundamental (DCF, P/E, PEG, growth) and technical (RSI, MACD, Bollinger, SMAs)
- Derivatives and options strategy — Greeks (delta, gamma, theta, vega), IV vs HV analysis, spreads, straddles, covered calls, earnings plays
- Portfolio risk management — position sizing, stop-loss placement, Beta, Sharpe ratio, risk/reward ratios

You have access to real-time market data tools. Follow these rules on every response:

1. ALWAYS use your tools to fetch current data before making any recommendation. Never rely on memory for prices, fundamentals, or technicals.
2. Give a specific entry price, price target, and stop-loss level for every trade idea.
3. State the risk/reward ratio explicitly (e.g. "Risk $200 to make $600 — 3:1 R/R").
4. For options trades, always include: strategy name, specific strike(s), expiration date, estimated debit or credit, and maximum possible loss.
5. For earnings plays, always mention IV rank/percentile and IV crush risk.
6. Cite which data you fetched and the timeframe (e.g. "Based on 6-month technicals as of today...").

Format your responses in clean markdown. Structure: lead with the key recommendation or verdict, then present the supporting data in organized sections. Use bold for key numbers."""

TOOLS = [
    {
        "name": "get_stock_data",
        "description": "Fetch current price, volume, 52-week range, and optionally full fundamentals: P/E (TTM and forward), PEG ratio, EPS, revenue growth, earnings growth, profit margin, analyst price target, analyst consensus rating (1=Strong Buy to 5=Sell), short float percentage, and next earnings date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol in uppercase, e.g. AAPL, NVDA, SPY",
                },
                "period": {
                    "type": "string",
                    "description": "Historical data period: 1d | 5d | 1mo | 3mo | 6mo | 1y | 5y. Default 3mo.",
                },
                "include_fundamentals": {
                    "type": "boolean",
                    "description": "Set true to include P/E, EPS, growth metrics, analyst targets. Default true.",
                },
            },
            "required": ["ticker"],
        },
    },
]

TOOL_MAP = {
    "get_stock_data": get_stock_data,
}


def run_agent(user_message: str, history: list = []) -> tuple[str, list]:
    """Run the tool-use loop until Claude returns a final answer.

    Returns the assistant's final markdown text and the full updated message
    list (so the caller can thread it back in as conversation history).
    """
    messages = history + [{"role": "user", "content": user_message}]

    while True:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if resp.stop_reason == "tool_use":
            tool_results = []
            for block in resp.content:
                if block.type == "tool_use":
                    try:
                        result = TOOL_MAP[block.name](**block.input)
                    except Exception as e:
                        result = {"error": str(e)}
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result),
                    })
            messages.append({"role": "assistant", "content": resp.content})
            messages.append({"role": "user", "content": tool_results})
            continue

        # end_turn (or any non-tool stop): extract the final text and return.
        text = next(b.text for b in resp.content if b.type == "text")
        messages.append({"role": "assistant", "content": resp.content})
        return text, messages
