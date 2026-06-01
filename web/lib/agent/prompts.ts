/** Quick-action prompt templates. Ported from the Streamlit `app.py`. */

export const TICKER_MODES = {
  "Full breakdown":
    "Give me a complete analysis of {t}. Fetch current price, run technical analysis, " +
    "pull fundamentals and recent news, then give me your top recommendation with a " +
    "specific entry price, price target, stop-loss, and risk/reward ratio.",

  "Best options play":
    "What is the best options trade on {t} right now? Fetch the options chain and check " +
    "current implied volatility. Recommend a specific strategy with exact strike(s), " +
    "expiration date, estimated debit or credit, maximum loss, and your reasoning.",

  "Technical analysis":
    "Run a full technical analysis on {t}. I want RSI, MACD, Bollinger Bands, all key " +
    "SMA levels, and the most important support and resistance zones. Tell me whether " +
    "the technical picture is bullish, bearish, or neutral and what level to watch.",

  "Earnings setup & IV risk":
    "Analyze {t} as an earnings trade. When is the next earnings date? What is the " +
    "implied volatility situation right now? What options strategy makes the most sense " +
    "given current IV, and what is the IV crush risk after earnings?",

  "Compare to peers":
    "Compare {t} to its 3 closest publicly traded competitors. Fetch data on {t} and " +
    "compare valuation and growth. Is {t} cheap or expensive relative to the group? " +
    "Which would you buy?",
} as const;

export type TickerMode = keyof typeof TICKER_MODES;

export const PORTFOLIO_MODES = {
  "Analyze my whole book":
    "Fetch my current portfolio and give me a full health check: total value, " +
    "unrealized P&L, and your read on each position. Flag anything overextended and " +
    "give concrete hold / trim / add guidance with specific levels.",

  "Biggest risk / concentration":
    "Fetch my portfolio and identify my single biggest risk right now. Assess " +
    "concentration (position weights), correlation across holdings, stretched " +
    "technicals, and any upcoming earnings. What would you de-risk first, and how?",

  "What to trim or add":
    "Fetch my portfolio and tell me specifically what to trim and what to add. For " +
    "each call give a reason, a target weight, and entry/exit levels.",
} as const;

export type PortfolioMode = keyof typeof PORTFOLIO_MODES;

/** Single-ticker quick-action prompt with the ticker interpolated (uppercased). */
export function buildTickerPrompt(mode: TickerMode, ticker: string): string {
  return TICKER_MODES[mode].replaceAll("{t}", ticker.toUpperCase().trim());
}

/** Per-holding "analyze this position" prompt for the holdings table. */
export function buildHoldingPrompt(ticker: string): string {
  const t = ticker.toUpperCase().trim();
  return (
    `I hold ${t} in my portfolio. Fetch my portfolio plus current data on ${t} and ` +
    "tell me whether to hold, add, or trim — with specific entry/target/stop levels " +
    "and how it fits my overall book."
  );
}
