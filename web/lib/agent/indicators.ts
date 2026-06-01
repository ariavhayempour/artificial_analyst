/**
 * Technical indicators computed from a series of daily closing prices.
 *
 * Pure math — no network — ported from the Python `analyze_technicals` (which
 * used the `ta` library). Each indicator returns `null` when there isn't enough
 * data, so the agent tool degrades gracefully on thin history.
 */

export type Indicator = "rsi" | "macd" | "bollinger" | "sma" | "support_resistance";

export const ALL_INDICATORS: Indicator[] = [
  "rsi",
  "macd",
  "bollinger",
  "sma",
  "support_resistance",
];

type Value = number | string | boolean | null;

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function mean(arr: number[]): number {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function smaLast(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  return mean(closes.slice(-n));
}

/** EMA series seeded with the first value (k = 2/(period+1)). */
function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI over `period` (default 14). */
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeTechnicals(
  closes: number[],
  indicators: Indicator[] = ALL_INDICATORS,
): Record<string, Value> {
  const result: Record<string, Value> = {};
  if (closes.length === 0) return { error: "No price history" };
  const price = closes[closes.length - 1];
  result.price = round(price, 2);

  if (indicators.includes("rsi")) {
    const r = rsi(closes);
    result.rsi14 = r === null ? null : round(r, 1);
    result.rsiSignal =
      r === null ? null : r > 70 ? "Overbought" : r < 30 ? "Oversold" : "Neutral";
  }

  if (indicators.includes("macd")) {
    if (closes.length < 26) {
      result.macd = null;
    } else {
      const e12 = emaSeries(closes, 12);
      const e26 = emaSeries(closes, 26);
      const macdLine = closes.map((_, i) => e12[i] - e26[i]);
      const signalLine = emaSeries(macdLine, 9);
      const macd = macdLine[macdLine.length - 1];
      const signal = signalLine[signalLine.length - 1];
      const hist = macd - signal;
      result.macd = round(macd, 4);
      result.macdSignal = round(signal, 4);
      result.macdHistogram = round(hist, 4);
      result.macdTrend = hist > 0 ? "Bullish crossover" : "Bearish crossover";
    }
  }

  if (indicators.includes("bollinger")) {
    if (closes.length < 20) {
      result.bbMid = null;
    } else {
      const window = closes.slice(-20);
      const mid = mean(window);
      const sd = Math.sqrt(mean(window.map((x) => (x - mid) ** 2)));
      const upper = mid + 2 * sd;
      const lower = mid - 2 * sd;
      const pctB = upper === lower ? 0.5 : (price - lower) / (upper - lower);
      result.bbUpper = round(upper, 2);
      result.bbMid = round(mid, 2);
      result.bbLower = round(lower, 2);
      result.bbPctB = round(pctB, 2);
      result.bbPosition =
        pctB > 0.8 ? "Near upper band" : pctB < 0.2 ? "Near lower band" : "Mid-range";
    }
  }

  if (indicators.includes("sma")) {
    const sma20 = smaLast(closes, 20);
    const sma50 = smaLast(closes, 50);
    const sma200 = smaLast(closes, 200);
    result.sma20 = sma20 === null ? null : round(sma20, 2);
    result.sma50 = sma50 === null ? null : round(sma50, 2);
    result.sma200 = sma200 === null ? null : round(sma200, 2);
    result.above200Sma = sma200 === null ? null : price > sma200;
    result.goldenCross = sma50 === null || sma200 === null ? null : sma50 > sma200;
  }

  if (indicators.includes("support_resistance")) {
    const last60 = closes.slice(-60);
    const support = Math.min(...last60);
    const resistance = Math.max(...last60);
    result.support = round(support, 2);
    result.resistance = round(resistance, 2);
    result.pctFromSupport = round(((price - support) / support) * 100, 1);
    result.pctFromResistance = round(((resistance - price) / resistance) * 100, 1);
  }

  return result;
}
