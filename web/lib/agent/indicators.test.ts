import { describe, expect, it } from "vitest";

import { computeTechnicals } from "./indicators";

// A 1..n ramp of closing prices.
function ramp(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

describe("computeTechnicals", () => {
  it("always reports the latest price", () => {
    const r = computeTechnicals(ramp(60));
    expect(r.price).toBe(60);
  });

  it("computes RSI = 100 for a strictly increasing series (all gains)", () => {
    const r = computeTechnicals(ramp(60), ["rsi"]);
    expect(r.rsi14).toBe(100);
    expect(r.rsiSignal).toBe("Overbought");
  });

  it("computes simple moving averages over the ramp", () => {
    const r = computeTechnicals(ramp(60), ["sma"]);
    expect(r.sma20).toBe(50.5); // mean(41..60)
    expect(r.sma50).toBe(35.5); // mean(11..60)
    expect(r.sma200).toBeNull(); // not enough data
    expect(r.above200Sma).toBeNull();
  });

  it("collapses Bollinger bands on a constant series (zero volatility)", () => {
    const r = computeTechnicals(Array(30).fill(100), ["bollinger"]);
    expect(r.bbMid).toBe(100);
    expect(r.bbUpper).toBe(100);
    expect(r.bbLower).toBe(100);
  });

  it("reports support and resistance from recent lows/highs", () => {
    const closes = [...ramp(40), 5, 80, 30]; // last values define the window
    const r = computeTechnicals(closes, ["support_resistance"]);
    expect(r.support).toBe(1);
    expect(r.resistance).toBe(80);
  });

  it("returns null indicator values when the series is too short", () => {
    const r = computeTechnicals([100, 101, 102], ["rsi", "sma"]);
    expect(r.rsi14).toBeNull();
    expect(r.sma20).toBeNull();
  });

  it("only includes the requested indicators", () => {
    const r = computeTechnicals(ramp(60), ["rsi"]);
    expect(r.rsi14).toBeDefined();
    expect(r.sma20).toBeUndefined();
    expect(r.bbMid).toBeUndefined();
  });
});
