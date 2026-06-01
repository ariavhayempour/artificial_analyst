/**
 * AI SDK tool definitions for the quant agent. Ported from the Python `tools.py`
 * + `agent.py` tool registry, backed by the `MarketData` interface and the pure
 * `computeTechnicals` / `loadPortfolio` cores.
 *
 * SECURITY: `get_portfolio` takes NO arguments. Its data source is the bound
 * `listTransactions` reader (the route binds it to the signed-in user's session
 * client → RLS), so the model can never read another user's book.
 */
import { tool } from "ai";
import { z } from "zod";

import { isMarketError, type MarketData } from "@/lib/market/types";
import type { Transaction } from "@/lib/portfolio";

import { ALL_INDICATORS, computeTechnicals, type Indicator } from "./indicators";
import { loadPortfolio } from "./portfolio-tool";

export interface ToolDeps {
  market: MarketData;
  /** Reads the signed-in user's transactions (session-scoped — RLS). */
  listTransactions: () => Promise<Transaction[]>;
}

export function buildTools(deps: ToolDeps) {
  const quote = async (ticker: string): Promise<number | null> => {
    const q = await deps.market.quote(ticker);
    return isMarketError(q) ? null : q.price;
  };

  return {
    get_stock_data: tool({
      description:
        "Fetch current price, day change, volume, and reference details (company name, market cap) for a stock.",
      inputSchema: z.object({
        ticker: z.string().describe("Stock ticker symbol, e.g. AAPL, NVDA, SPY"),
        include_fundamentals: z.boolean().optional(),
      }),
      execute: async ({ ticker }) => {
        const [q, d] = await Promise.all([
          deps.market.quote(ticker),
          deps.market.details(ticker),
        ]);
        if (isMarketError(q)) return { ticker, error: q.error };
        return {
          ...q,
          name: isMarketError(d) ? null : d.name,
          marketCap: isMarketError(d) ? null : d.marketCap,
        };
      },
    }),

    analyze_technicals: tool({
      description:
        "Compute technical indicators (RSI-14, MACD, Bollinger Bands, SMA 20/50/200, support/resistance) from ~6 months of daily closes.",
      inputSchema: z.object({
        ticker: z.string(),
        indicators: z
          .array(z.enum(["rsi", "macd", "bollinger", "sma", "support_resistance"]))
          .optional()
          .describe("Subset of indicators to compute. Omit for all five."),
      }),
      execute: async ({ ticker, indicators }) => {
        const h = await deps.market.history(ticker);
        if (isMarketError(h)) return { ticker, error: h.error };
        const closes = h.bars.map((b) => b.close);
        const inds = (indicators?.length ? indicators : ALL_INDICATORS) as Indicator[];
        return { ticker, ...computeTechnicals(closes, inds) };
      },
    }),

    get_options_chain: tool({
      description:
        "Retrieve the options chain (calls and puts) for a stock, optionally filtered to a strike band around the current price.",
      inputSchema: z.object({
        ticker: z.string(),
        expiration: z.string().optional().describe("Expiration date YYYY-MM-DD"),
        strike_range_pct: z
          .number()
          .optional()
          .describe("Only strikes within this fraction of price, e.g. 0.10 for ±10%"),
      }),
      execute: async ({ ticker, expiration, strike_range_pct }) =>
        deps.market.optionsChain(ticker, {
          expiration,
          strikeRangePct: strike_range_pct,
        }),
    }),

    get_market_news: tool({
      description: "Fetch recent news headlines for a stock.",
      inputSchema: z.object({
        ticker: z.string(),
        days_back: z.number().optional(),
      }),
      execute: async ({ ticker }) => deps.market.news(ticker),
    }),

    get_portfolio: tool({
      description:
        "Fetch the current user's own saved portfolio: every open position with ticker, quantity, average cost, live price, market value, and unrealized P&L, plus totals and realized P&L. Takes no arguments — it always returns the signed-in user's holdings. Use this whenever the user asks about 'my portfolio', 'my positions', 'my book', or how their holdings are doing.",
      inputSchema: z.object({}),
      // No user identifier in the schema; scope comes from the bound reader.
      execute: async () =>
        loadPortfolio({ listTransactions: deps.listTransactions, quote }),
    }),
  };
}
