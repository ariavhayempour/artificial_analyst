import { describe, expect, it } from "vitest";

import {
  buildImport,
  detectMapping,
  findSnapshotDate,
  normalizeHeader,
  parseNumber,
} from "./csv-mapping";

// A Schwab "Individual Positions" export: a title row, a blank row, the real
// header on row index 2, then position rows, a cash sweep, and an account total.
const SCHWAB_HEADER = [
  "Symbol",
  "Description",
  "Qty (Quantity)",
  "Price",
  "Price Chng $ (Price Change $)",
  "Price Chng % (Price Change %)",
  "Mkt Val (Market Value)",
  "Day Chng $ (Day Change $)",
  "Day Chng % (Day Change %)",
  "Cost Basis",
  "Cost/Share",
  "Gain $ (Gain/Loss $)",
  "Gain % (Gain/Loss %)",
  "Reinvest?",
  "Reinvest Capital Gains?",
  "Asset Type",
];

function schwabRow(
  symbol: string,
  qty: string,
  costBasis: string,
  costShare: string,
): string[] {
  const r = new Array(16).fill("");
  r[0] = symbol;
  r[1] = `${symbol} INC`;
  r[2] = qty;
  r[3] = "0.00";
  r[6] = "0.00";
  r[9] = costBasis;
  r[10] = costShare;
  r[15] = "Equity";
  return r;
}

const SCHWAB_GRID: string[][] = [
  [
    "Positions for account Individual ...751 as of 05:49 PM ET, 2026/06/02",
    ...new Array(15).fill(""),
  ],
  new Array(16).fill(""),
  SCHWAB_HEADER,
  schwabRow("NVDA", "10", "9,000.00", "900.00"),
  schwabRow("AAPL", "20", "3,000.00", "150.00"),
  ["Cash & Cash Investments", ...new Array(15).fill("")],
  ["Account Total", ...new Array(15).fill("")],
  new Array(16).fill(""),
];

describe("normalizeHeader", () => {
  it("lowercases, strips parenthetical content and non-alphanumerics", () => {
    expect(normalizeHeader("Qty (Quantity)")).toBe("qty");
    expect(normalizeHeader("Cost/Share")).toBe("costshare");
    expect(normalizeHeader("Cost Basis")).toBe("costbasis");
    expect(normalizeHeader("  Average Cost Basis ")).toBe("averagecostbasis");
  });
});

describe("parseNumber", () => {
  it("strips currency, thousands separators and percent signs", () => {
    expect(parseNumber("$1,234.56")).toBe(1234.56);
    expect(parseNumber("12%")).toBe(12);
    expect(parseNumber("900.00")).toBe(900);
  });

  it("treats parentheses as negative", () => {
    expect(parseNumber("(50.00)")).toBe(-50);
  });

  it("returns null for blank or non-numeric cells", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber("—")).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
  });
});

describe("findSnapshotDate", () => {
  it("extracts an ISO date from a Schwab preamble", () => {
    expect(findSnapshotDate(SCHWAB_GRID)).toBe("2026-06-02");
  });

  it("parses US-style MM/DD/YYYY dates", () => {
    expect(findSnapshotDate([["Positions as of 06/02/2026"]])).toBe(
      "2026-06-02",
    );
  });

  it("returns null when no date is present", () => {
    expect(findSnapshotDate([["Symbol", "Qty"], ["NVDA", "10"]])).toBeNull();
  });
});

describe("detectMapping", () => {
  it("finds the buried header row and resolves canonical columns", () => {
    const r = detectMapping(SCHWAB_GRID);
    expect(r.headerRowIndex).toBe(2);
    expect(r.mapping.symbol).toBe(0);
    expect(r.mapping.quantity).toBe(2);
    expect(r.mapping.costBasis).toBe(9);
    expect(r.mapping.costPerShare).toBe(10);
    expect(r.unresolved).toEqual([]);
  });

  it("resolves Fidelity-style headers (Average Cost Basis as per-share)", () => {
    const grid = [
      [
        "Account Number",
        "Account Name",
        "Symbol",
        "Description",
        "Quantity",
        "Last Price",
        "Current Value",
        "Average Cost Basis",
        "Cost Basis Total",
      ],
      ["X1", "Indiv", "MSFT", "MICROSOFT", "5", "400", "2000", "300", "1500"],
    ];
    const r = detectMapping(grid);
    expect(r.headerRowIndex).toBe(0);
    expect(r.mapping.symbol).toBe(2);
    expect(r.mapping.quantity).toBe(4);
    expect(r.mapping.costPerShare).toBe(7);
    expect(r.mapping.costBasis).toBe(8);
  });

  it("flags a missing cost column as unresolved", () => {
    const grid = [
      ["Ticker", "Shares", "Last Price"],
      ["GOOG", "4", "200"],
    ];
    const r = detectMapping(grid);
    expect(r.mapping.symbol).toBe(0);
    expect(r.mapping.quantity).toBe(1);
    expect(r.unresolved).toContain("costPerShare");
  });
});

describe("buildImport", () => {
  it("maps Schwab positions to synthetic buys at cost basis", () => {
    const { headerRowIndex, mapping } = detectMapping(SCHWAB_GRID);
    const res = buildImport(SCHWAB_GRID, headerRowIndex, mapping, "2026-06-02");

    expect(res.rows).toEqual([
      {
        ticker: "NVDA",
        side: "buy",
        quantity: 10,
        pricePerShare: 900,
        tradedAt: "2026-06-02",
      },
      {
        ticker: "AAPL",
        side: "buy",
        quantity: 20,
        pricePerShare: 150,
        tradedAt: "2026-06-02",
      },
    ]);
    expect(res.totalCostBasis).toBe(12000);
  });

  it("skips cash and total rows, reporting them", () => {
    const { headerRowIndex, mapping } = detectMapping(SCHWAB_GRID);
    const res = buildImport(SCHWAB_GRID, headerRowIndex, mapping);
    const skippedSymbols = res.skipped.map((s) => s.symbol);
    expect(skippedSymbols).toContain("Cash & Cash Investments");
    expect(skippedSymbols).toContain("Account Total");
    expect(res.rows).toHaveLength(2);
  });

  it("derives cost/share from total cost basis when no per-share column exists", () => {
    const grid = [
      ["Ticker", "Shares", "Total Cost"],
      ["GOOG", "4", "800"],
    ];
    const { headerRowIndex, mapping } = detectMapping(grid);
    const res = buildImport(grid, headerRowIndex, mapping);
    expect(res.rows).toEqual([
      { ticker: "GOOG", side: "buy", quantity: 4, pricePerShare: 200, tradedAt: null },
    ]);
    expect(res.warnings.join(" ")).toMatch(/derived/i);
  });

  it("returns no rows with a clear warning for an empty export", () => {
    const grid = [
      ["Positions ... as of 2026/06/02", ...new Array(15).fill("")],
      new Array(16).fill(""),
      SCHWAB_HEADER,
    ];
    const { headerRowIndex, mapping } = detectMapping(grid);
    const res = buildImport(grid, headerRowIndex, mapping);
    expect(res.rows).toEqual([]);
    expect(res.warnings.join(" ")).toMatch(/no positions/i);
  });
});
