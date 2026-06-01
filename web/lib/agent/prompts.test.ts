import { describe, expect, it } from "vitest";

import {
  buildHoldingPrompt,
  buildTickerPrompt,
  PORTFOLIO_MODES,
  TICKER_MODES,
} from "./prompts";

describe("buildTickerPrompt", () => {
  it("interpolates an uppercased ticker and leaves no placeholder", () => {
    const p = buildTickerPrompt("Full breakdown", "nvda");
    expect(p).toContain("NVDA");
    expect(p).not.toContain("{t}");
  });

  it("replaces every occurrence of the placeholder", () => {
    // "Compare to peers" references the ticker multiple times.
    const p = buildTickerPrompt("Compare to peers", "aapl");
    expect(p).not.toContain("{t}");
    expect(p.match(/AAPL/g)!.length).toBeGreaterThan(1);
  });
});

describe("portfolio modes", () => {
  it("are ticker-free (no placeholder to fill)", () => {
    for (const prompt of Object.values(PORTFOLIO_MODES)) {
      expect(prompt).not.toContain("{t}");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it("instruct the agent to fetch the portfolio", () => {
    for (const prompt of Object.values(PORTFOLIO_MODES)) {
      expect(prompt.toLowerCase()).toContain("portfolio");
    }
  });
});

describe("buildHoldingPrompt", () => {
  it("builds a per-holding prompt naming the uppercased ticker", () => {
    const p = buildHoldingPrompt("tsla");
    expect(p).toContain("TSLA");
    expect(p.toLowerCase()).toContain("portfolio");
  });
});

describe("TICKER_MODES", () => {
  it("exposes the five single-ticker modes", () => {
    expect(Object.keys(TICKER_MODES)).toHaveLength(5);
  });
});
