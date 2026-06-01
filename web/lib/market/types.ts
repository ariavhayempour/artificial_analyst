/**
 * Provider-agnostic market-data contract. The agent tools and dashboard depend
 * on this interface, not on Polygon directly, so swapping providers is one file.
 *
 * Every method returns typed data on success or `{ error }` on failure — it
 * never throws — mirroring the error-as-data style of the Python `tools.py`.
 */

export type MarketError = { error: string };
export type Result<T> = T | MarketError;

export function isMarketError<T>(r: Result<T>): r is MarketError {
  return typeof r === "object" && r !== null && "error" in r;
}

export interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  dayVolume: number;
  dayOpen: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
}

export interface Bar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface History {
  ticker: string;
  bars: Bar[]; // oldest first
}

export interface TickerDetails {
  ticker: string;
  name: string | null;
  marketCap: number | null;
  primaryExchange: string | null;
}

export interface OptionContract {
  type: "call" | "put";
  strike: number;
  expiration: string; // YYYY-MM-DD
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
}

export interface OptionsChain {
  ticker: string;
  underlyingPrice: number | null;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface NewsItem {
  headline: string;
  source: string | null;
  url: string | null;
  publishedAt: string;
}

export interface News {
  ticker: string;
  articles: NewsItem[];
}

export interface MarketData {
  /** Current price, day change, and day OHLCV for a ticker. */
  quote(ticker: string): Promise<Result<Quote>>;
  /** Daily OHLCV bars (oldest first). Defaults to ~6 months ending today. */
  history(
    ticker: string,
    opts?: { from?: string; to?: string },
  ): Promise<Result<History>>;
  /** Reference details: name, market cap, primary exchange. */
  details(ticker: string): Promise<Result<TickerDetails>>;
  /** Options contracts near the money, split into calls and puts. */
  optionsChain(
    ticker: string,
    opts?: { expiration?: string; strikeRangePct?: number },
  ): Promise<Result<OptionsChain>>;
  /** Recent news headlines for a ticker. */
  news(ticker: string, opts?: { limit?: number }): Promise<Result<News>>;
}
