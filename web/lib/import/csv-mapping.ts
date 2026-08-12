/**
 * Dynamic broker-CSV → synthetic-buy mapping. Pure and parser-agnostic: it
 * operates on a `string[][]` grid (PapaParse runs at the UI edge), so it's
 * trivially unit-testable.
 *
 * A positions export is a *snapshot*, not a trade log, so each position row maps
 * to one synthetic `buy` at its cost basis (`price_per_share = Cost/Share`).
 * Feeding those into the existing ledger derivation (`portfolio.ts`) repopulates
 * the whole dashboard; live prices still come from Polygon, so storing cost
 * keeps unrealized P&L correct.
 *
 * Headers differ per platform, so columns resolve via a normalized synonym
 * dictionary; whatever can't be auto-resolved is surfaced for a manual mapping
 * step in the UI.
 */
import type { NewTransaction } from "../transactions";

export type CanonicalField =
  | "symbol"
  | "quantity"
  | "costPerShare"
  | "costBasis"
  | "price"
  | "description";

/** Column index per canonical field within a header row (`null` = unmapped). */
export interface ColumnMapping {
  symbol: number | null;
  quantity: number | null;
  costPerShare: number | null;
  costBasis: number | null;
  price: number | null;
  description: number | null;
}

export interface DetectResult {
  /** Index of the resolved header row, or -1 if none was found. */
  headerRowIndex: number;
  headers: string[];
  mapping: ColumnMapping;
  /** Required fields (symbol, quantity, a cost source) still needing a column. */
  unresolved: CanonicalField[];
}

export interface SkippedRow {
  /** 0-based row index in the original grid. */
  row: number;
  symbol: string;
  reason: string;
}

export interface BuildResult {
  rows: NewTransaction[];
  warnings: string[];
  skipped: SkippedRow[];
  totalCostBasis: number;
}

// Synonyms keyed by canonical field, already normalized (see normalizeHeader).
// Matching is exact-on-normalized so e.g. "Cost Basis" never collides with
// "Cost Basis Per Share".
const SYNONYMS: Record<CanonicalField, string[]> = {
  symbol: ["symbol", "ticker", "symbolcusip", "instrument", "security", "securitysymbol"],
  quantity: ["qty", "quantity", "shares", "sharequantity", "units", "noofshares", "position"],
  costPerShare: [
    "costshare",
    "costpershare",
    "avgcost",
    "averagecost",
    "avgcostbasis",
    "averagecostbasis",
    "unitcost",
    "purchaseprice",
    "costbasispershare",
  ],
  costBasis: ["costbasis", "totalcost", "costbasistotal", "totalcostbasis", "adjustedcostbasis"],
  price: ["price", "lastprice", "last", "currentprice", "marketprice"],
  description: ["description", "name", "securityname"],
};

const JUNK_SYMBOL = /^(cash|cash & cash investments|account total|total|pending activity)/i;

const CANONICAL_FIELDS = Object.keys(SYNONYMS) as CanonicalField[];

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Lowercase, drop parenthetical content, strip every non-alphanumeric char. */
export function normalizeHeader(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Parse a money/quantity cell, tolerating `$ , %` and `(…)` negatives. */
export function parseNumber(raw: string): number | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t) return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[$,%\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const iso = (y: string, m: string, d: string) =>
  `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

/** Pull a snapshot date out of the preamble; ISO `YYYY-MM-DD` or null. */
export function findSnapshotDate(grid: string[][]): string | null {
  for (const row of grid) {
    for (const cell of row) {
      const text = String(cell ?? "");
      const ymd = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (ymd) return iso(ymd[1], ymd[2], ymd[3]);
      const mdy = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (mdy) return iso(mdy[3], mdy[1], mdy[2]);
    }
  }
  return null;
}

/** First column whose normalized header matches one of the field's synonyms. */
function resolveColumn(headers: string[], field: CanonicalField): number | null {
  const wanted = SYNONYMS[field];
  for (let i = 0; i < headers.length; i++) {
    if (wanted.includes(normalizeHeader(headers[i]))) return i;
  }
  return null;
}

function mapHeaders(headers: string[]): ColumnMapping {
  const mapping = {} as ColumnMapping;
  for (const field of CANONICAL_FIELDS) {
    mapping[field] = resolveColumn(headers, field);
  }
  return mapping;
}

/**
 * Locate the header row (the first that resolves both symbol and quantity) and
 * resolve every canonical column from it. `headerRowIndex` is -1 if none fits.
 */
export function detectMapping(grid: string[][]): DetectResult {
  for (let i = 0; i < grid.length; i++) {
    const mapping = mapHeaders(grid[i]);
    if (mapping.symbol !== null && mapping.quantity !== null) {
      return {
        headerRowIndex: i,
        headers: grid[i],
        mapping,
        unresolved: missingRequired(mapping),
      };
    }
  }
  return {
    headerRowIndex: -1,
    headers: [],
    mapping: mapHeaders([]),
    unresolved: ["symbol", "quantity", "costPerShare"],
  };
}

/** symbol, quantity, and at least one cost source must be mapped to import. */
function missingRequired(mapping: ColumnMapping): CanonicalField[] {
  const missing: CanonicalField[] = [];
  if (mapping.symbol === null) missing.push("symbol");
  if (mapping.quantity === null) missing.push("quantity");
  if (mapping.costPerShare === null && mapping.costBasis === null) {
    missing.push("costPerShare");
  }
  return missing;
}

const cell = (row: string[], idx: number | null): string =>
  idx === null ? "" : (row[idx] ?? "");

/**
 * Apply a (possibly user-edited) mapping to the data rows below the header,
 * producing synthetic buys. Junk/invalid rows are skipped and reported.
 */
export function buildImport(
  grid: string[][],
  headerRowIndex: number,
  mapping: ColumnMapping,
  snapshotDate?: string | null,
): BuildResult {
  const rows: NewTransaction[] = [];
  const skipped: SkippedRow[] = [];
  const warnings: string[] = [];
  let totalCostBasis = 0;
  let derivedCount = 0;
  const tradedAt = snapshotDate ?? null;

  const start = headerRowIndex < 0 ? grid.length : headerRowIndex + 1;
  for (let i = start; i < grid.length; i++) {
    const row = grid[i];
    // Fully blank lines (Schwab pads exports with them) are silent spacers.
    if (row.every((c) => String(c ?? "").trim() === "")) continue;

    const symbol = cell(row, mapping.symbol).trim();
    if (!symbol) continue;
    if (JUNK_SYMBOL.test(symbol)) {
      skipped.push({ row: i, symbol, reason: "non-position row (cash/total)" });
      continue;
    }

    const quantity = parseNumber(cell(row, mapping.quantity));
    if (quantity === null || quantity <= 0) {
      skipped.push({ row: i, symbol, reason: "missing or invalid quantity" });
      continue;
    }

    let pricePerShare = parseNumber(cell(row, mapping.costPerShare));
    if (pricePerShare === null) {
      const basis = parseNumber(cell(row, mapping.costBasis));
      if (basis !== null) {
        pricePerShare = round(basis / quantity, 4);
        derivedCount += 1;
      }
    }
    if (pricePerShare === null) {
      skipped.push({ row: i, symbol, reason: "no cost basis or cost/share" });
      continue;
    }
    if (pricePerShare < 0) {
      skipped.push({ row: i, symbol, reason: "negative cost" });
      continue;
    }

    rows.push({
      ticker: symbol.toUpperCase(),
      side: "buy",
      quantity,
      pricePerShare,
      tradedAt,
    });
    totalCostBasis += quantity * pricePerShare;
  }

  if (derivedCount > 0) {
    warnings.push(
      `Cost/share derived from total cost basis for ${derivedCount} position${derivedCount === 1 ? "" : "s"}.`,
    );
  }
  if (rows.length === 0) {
    warnings.push("No positions found in the file.");
  }

  return { rows, warnings, skipped, totalCostBasis: round(totalCostBasis, 2) };
}
