import * as XLSX from "xlsx";

// Excel column letter <-> 0-based index
export const colLetterToIndex = (letters: string): number => {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
};

export const indexToColLetter = (index: number): string => {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export type FieldKey =
  | "COUNTRY"
  | "MAKE"
  | "VERSION_Spec"
  | "VERSION_CC"
  | "VERSION_Hp"
  | "VERSION_Fuel_type"
  | "VERSION_Bodytype"
  | "VERSION_Transmission"
  | "VERSION_Driven_wheels"
  | "UID"
  | "MODEL_MARKET_NAME";

// Shared columns and their expected header (trimmed exact)
export const SHARED_COLUMNS: { col: string; key: FieldKey; header: string; aliases?: string[] }[] = [
  { col: "J", key: "COUNTRY", header: "COUNTRY" },
  { col: "P", key: "MAKE", header: "MAKE" },
  { col: "U", key: "VERSION_Spec", header: "VERSION_Spec" },
  { col: "V", key: "VERSION_CC", header: "VERSION_CC" },
  { col: "W", key: "VERSION_Hp", header: "VERSION_Hp" },
  { col: "Y", key: "VERSION_Fuel_type", header: "VERSION_Fuel_type" },
  { col: "Z", key: "VERSION_Bodytype", header: "VERSION_Bodytype" },
  { col: "AA", key: "VERSION_Transmission", header: "VERSION_Transmission" },
  { col: "AB", key: "VERSION_Driven_wheels", header: "VERSION_Driven_wheels" },
  { col: "BV", key: "UID", header: "UID (POLK/MSI)", aliases: ["UID", "UID(POLK/MSI)", "UID POLK MSI", "UID POLK/MSI"] },
  { col: "BX", key: "MODEL_MARKET_NAME", header: "MODEL_MARKET_NAME" },
];

export const PRICER_PRICE_COL = "AF";
export const PRICER_PRICE_HEADER = "List_Price";

export const OUTPUT_CONFIDENCE_COL = "DF";
export const OUTPUT_PRICE_COL = "DG";
export const OUTPUT_CONFIDENCE_HEADER = "MATCH_CONFIDENCE";
export const OUTPUT_PRICE_HEADER = "MATCHED_UPDATED_LIST_PRICE";

export const FIELD_WEIGHTS: Record<FieldKey, number> = {
  COUNTRY: 0, // gate
  MAKE: 20,
  VERSION_Spec: 5,
  VERSION_CC: 10,
  VERSION_Hp: 5,
  VERSION_Fuel_type: 10,
  VERSION_Bodytype: 5,
  VERSION_Transmission: 5,
  VERSION_Driven_wheels: 5,
  UID: 10,
  MODEL_MARKET_NAME: 25,
};
// Note: sum = 100. COUNTRY is enforced as 100% gate.

// ---------- normalization ----------
const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  s = stripAccents(s).toLowerCase();
  s = s.replace(/[_/\-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
};

export const normHeader = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

const headerLoose = (v: unknown): string =>
  stripAccents(String(v ?? "").toLowerCase()).replace(/[^a-z0-9]/g, "");

const extractNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

// Similarity for strings (Dice coefficient on bigrams) - 0..1
const bigrams = (s: string): Map<string, number> => {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.substring(i, i + 2);
    m.set(bg, (m.get(bg) || 0) + 1);
  }
  return m;
};
const diceSim = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let inter = 0;
  let total = 0;
  ba.forEach((v) => (total += v));
  bb.forEach((v) => (total += v));
  ba.forEach((v, k) => {
    const x = bb.get(k);
    if (x) inter += Math.min(v, x);
  });
  return (2 * inter) / total;
};

const fieldScore = (key: FieldKey, matrixVal: unknown, pricerVal: unknown): number => {
  const weight = FIELD_WEIGHTS[key];
  if (weight === 0) return 0;
  const mEmpty = matrixVal === null || matrixVal === undefined || String(matrixVal).trim() === "";
  const pEmpty = pricerVal === null || pricerVal === undefined || String(pricerVal).trim() === "";
  if (pEmpty) return 0;
  if (mEmpty) return 0; // empty matrix field => 0 for that field (reduces overall confidence)

  // numeric-like
  if (key === "VERSION_CC" || key === "VERSION_Hp") {
    const mn = extractNumber(matrixVal);
    const pn = extractNumber(pricerVal);
    if (mn !== null && pn !== null) {
      if (mn === pn) return weight;
      const diff = Math.abs(mn - pn);
      const base = Math.max(Math.abs(mn), Math.abs(pn), 1);
      const ratio = diff / base;
      if (ratio <= 0.02) return weight * 0.9;
      if (ratio <= 0.05) return weight * 0.7;
      if (ratio <= 0.1) return weight * 0.4;
      return 0;
    }
  }

  const a = normStr(matrixVal);
  const b = normStr(pricerVal);
  if (!a || !b) return 0;
  if (a === b) return weight;
  // substring / prefix
  if (a.includes(b) || b.includes(a)) return weight * 0.85;
  const sim = diceSim(a, b);
  if (sim >= 0.9) return weight * 0.9;
  if (sim >= 0.75) return weight * 0.7;
  if (sim >= 0.6) return weight * 0.45;
  return 0;
};

// ---------- types ----------
export interface ParsedWorkbook {
  role: "pricer" | "matrix";
  fileName: string;
  fileSizeBytes: number;
  workbook: XLSX.WorkBook;
  firstSheetName: string;
  /** rows[r] is an array of cell values keyed by 0-based column index; rows[0] is header row */
  rows: unknown[][];
  /** map FieldKey -> 0-based column index actually used (after header validation) */
  fieldCols: Partial<Record<FieldKey, number>>;
  /** pricer only: index of List_Price column */
  priceCol?: number;
}

export interface ValidationError {
  file: "PRICER" | "Matrix";
  column: string;
  expected: string;
  found: string;
  message: string;
}

export interface MatchResult {
  matrixRowNumber: number; // 1-based excel row
  matchedPricerRowNumber: number | null;
  confidence: number;
  matchedListPrice: number | string | null;
  matchTier: "high" | "medium" | "low" | "none";
  reason: string;
}

// ---------- parsing ----------
export async function readWorkbookFromFile(
  file: File,
  role: "pricer" | "matrix"
): Promise<ParsedWorkbook> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: false });
  } catch (e) {
    throw new Error(`Could not parse ${role === "pricer" ? "PRICER" : "Matrix"} file. It may be corrupt or not a valid Excel file.`);
  }
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error(`${role === "pricer" ? "PRICER" : "Matrix"} file has no worksheets.`);
  const sheet = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  if (!rows.length) throw new Error(`${role === "pricer" ? "PRICER" : "Matrix"} first sheet is empty.`);
  return {
    role,
    fileName: file.name,
    fileSizeBytes: file.size,
    workbook: wb,
    firstSheetName,
    rows,
    fieldCols: {},
  };
}

// ---------- validation ----------
function headerMatches(found: string, expected: string, aliases: string[] = []): boolean {
  const f = headerLoose(found);
  if (!f) return false;
  const targets = [expected, ...aliases].map(headerLoose);
  if (targets.includes(f)) return true;
  // close fuzzy (e.g. "Version CC" -> "VERSION_CC")
  for (const t of targets) {
    if (!t) continue;
    if (f === t) return true;
    if (t.length >= 4 && (f.includes(t) || t.includes(f))) {
      const ratio = Math.min(f.length, t.length) / Math.max(f.length, t.length);
      if (ratio >= 0.7) return true;
    }
    const sim = diceSim(f, t);
    if (sim >= 0.85) return true;
  }
  return false;
}

export function validateWorkbook(pw: ParsedWorkbook): ValidationError[] {
  const errors: ValidationError[] = [];
  const header = pw.rows[0] || [];
  const fileLabel: "PRICER" | "Matrix" = pw.role === "pricer" ? "PRICER" : "Matrix";

  for (const spec of SHARED_COLUMNS) {
    const idx = colLetterToIndex(spec.col);
    const cell = header[idx];
    const found = normHeader(cell);
    if (headerMatches(found, spec.header, spec.aliases)) {
      pw.fieldCols[spec.key] = idx;
    } else {
      errors.push({
        file: fileLabel,
        column: spec.col,
        expected: spec.header,
        found: found || "(blank)",
        message: `${fileLabel} validation failed: column ${spec.col} must be '${spec.header}', but found '${found || "(blank)"}'.`,
      });
    }
  }

  if (pw.role === "pricer") {
    const idx = colLetterToIndex(PRICER_PRICE_COL);
    const cell = header[idx];
    const found = normHeader(cell);
    if (headerMatches(found, PRICER_PRICE_HEADER, ["ListPrice", "List Price"])) {
      pw.priceCol = idx;
    } else {
      errors.push({
        file: "PRICER",
        column: PRICER_PRICE_COL,
        expected: PRICER_PRICE_HEADER,
        found: found || "(blank)",
        message: `PRICER validation failed: column ${PRICER_PRICE_COL} must be '${PRICER_PRICE_HEADER}', but found '${found || "(blank)"}'.`,
      });
    }
  }

  // at least one data row
  const dataRows = pw.rows.length - 1;
  if (dataRows < 1) {
    errors.push({
      file: fileLabel,
      column: "-",
      expected: ">=1 data row",
      found: "0",
      message: `${fileLabel} file has no data rows.`,
    });
  }

  return errors;
}

// ---------- matching ----------
export interface MatchSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  none: number;
  results: MatchResult[];
}

export function runMatching(pricer: ParsedWorkbook, matrix: ParsedWorkbook): MatchSummary {
  const pricerRows = pricer.rows;
  const matrixRows = matrix.rows;
  const pf = pricer.fieldCols;
  const mf = matrix.fieldCols;
  const priceCol = pricer.priceCol!;

  // Pre-index pricer rows by normalized COUNTRY
  const idxCountry = pf.COUNTRY!;
  const byCountry = new Map<string, number[]>();
  for (let r = 1; r < pricerRows.length; r++) {
    const country = normStr(pricerRows[r]?.[idxCountry]);
    if (!country) continue;
    let arr = byCountry.get(country);
    if (!arr) {
      arr = [];
      byCountry.set(country, arr);
    }
    arr.push(r);
  }

  // Secondary index: by COUNTRY + MAKE
  const idxMake = pf.MAKE!;
  const idxModel = pf.MODEL_MARKET_NAME!;
  const byCountryMake = new Map<string, number[]>();
  const byCountryModel = new Map<string, number[]>();
  byCountry.forEach((arr, country) => {
    for (const r of arr) {
      const make = normStr(pricerRows[r]?.[idxMake]);
      const model = normStr(pricerRows[r]?.[idxModel]);
      if (make) {
        const k = country + "||" + make;
        let a = byCountryMake.get(k);
        if (!a) byCountryMake.set(k, (a = []));
        a.push(r);
      }
      if (model) {
        const k = country + "||" + model;
        let a = byCountryModel.get(k);
        if (!a) byCountryModel.set(k, (a = []));
        a.push(r);
      }
    }
  });

  const results: MatchResult[] = [];
  let high = 0, medium = 0, low = 0, none = 0;

  const fieldKeys: FieldKey[] = (Object.keys(FIELD_WEIGHTS) as FieldKey[]).filter(
    (k) => k !== "COUNTRY"
  );

  for (let r = 1; r < matrixRows.length; r++) {
    const mRow = matrixRows[r] || [];
    const mCountry = normStr(mRow[mf.COUNTRY!]);
    const mMake = normStr(mRow[mf.MAKE!]);
    const mModel = normStr(mRow[mf.MODEL_MARKET_NAME!]);

    // Build candidate pool
    let candidates: number[] = [];
    if (mCountry) {
      if (mMake) candidates = byCountryMake.get(mCountry + "||" + mMake) || [];
      if (candidates.length === 0 && mModel) {
        candidates = byCountryModel.get(mCountry + "||" + mModel) || [];
      }
      if (candidates.length === 0) {
        candidates = byCountry.get(mCountry) || [];
      }
    }

    let bestRow: number | null = null;
    let bestScore = -1;
    let bestTiebreak: number[] = [];

    if (mCountry && candidates.length) {
      for (const pr of candidates) {
        const pRow = pricerRows[pr];
        let score = 0;
        for (const key of fieldKeys) {
          const mi = mf[key];
          const pi = pf[key];
          if (mi === undefined || pi === undefined) continue;
          score += fieldScore(key, mRow[mi], pRow?.[pi]);
        }
        // Tie-breaks
        const tb = [
          normStr(pRow?.[pf.COUNTRY!]) === mCountry ? 1 : 0,
          normStr(pRow?.[idxMake]) === mMake && mMake ? 1 : 0,
          normStr(pRow?.[idxModel]) === mModel && mModel ? 1 : 0,
          normStr(pRow?.[pf.VERSION_CC!]) === normStr(mRow[mf.VERSION_CC!]) ? 1 : 0,
          normStr(pRow?.[pf.VERSION_Hp!]) === normStr(mRow[mf.VERSION_Hp!]) ? 1 : 0,
          normStr(pRow?.[pf.VERSION_Spec!]) === normStr(mRow[mf.VERSION_Spec!]) ? 1 : 0,
          -pr, // earlier row wins (higher negative)
        ];
        if (
          score > bestScore ||
          (score === bestScore && compareTiebreak(tb, bestTiebreak) > 0)
        ) {
          bestScore = score;
          bestRow = pr;
          bestTiebreak = tb;
        }
      }
    }

    const confidence = Math.max(0, Math.min(100, Math.round(bestScore < 0 ? 0 : bestScore)));
    let tier: MatchResult["matchTier"];
    if (confidence >= 90) { tier = "high"; high++; }
    else if (confidence >= 75) { tier = "medium"; medium++; }
    else if (confidence >= 50) { tier = "low"; low++; }
    else { tier = "none"; none++; }

    let matchedPrice: number | string | null = null;
    if (confidence >= 50 && bestRow !== null) {
      const raw = pricerRows[bestRow]?.[priceCol];
      if (raw !== null && raw !== undefined && raw !== "") {
        matchedPrice = raw as number | string;
      }
    }

    results.push({
      matrixRowNumber: r + 1,
      matchedPricerRowNumber: bestRow !== null ? bestRow + 1 : null,
      confidence,
      matchedListPrice: matchedPrice,
      matchTier: tier,
      reason: !mCountry
        ? "Matrix row missing COUNTRY"
        : candidates.length === 0
        ? "No PRICER candidates for this COUNTRY"
        : bestRow === null
        ? "No suitable match"
        : `Matched PRICER row ${bestRow + 1}`,
    });
  }

  return { total: results.length, high, medium, low, none, results };
}

function compareTiebreak(a: number[], b: number[]): number {
  if (!b.length) return 1;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

// ---------- output ----------
export function buildEnrichedWorkbook(
  matrix: ParsedWorkbook,
  summary: MatchSummary
): Uint8Array {
  // Clone workbook by re-reading the original buffer is not available; instead deep clone via XLSX API.
  const wb = matrix.workbook;
  const sheetName = matrix.firstSheetName;
  const sheet = wb.Sheets[sheetName];

  const dfCol = colLetterToIndex(OUTPUT_CONFIDENCE_COL);
  const dgCol = colLetterToIndex(OUTPUT_PRICE_COL);

  // Headers in row 1
  XLSX.utils.sheet_add_aoa(sheet, [[OUTPUT_CONFIDENCE_HEADER]], {
    origin: { r: 0, c: dfCol },
  });
  XLSX.utils.sheet_add_aoa(sheet, [[OUTPUT_PRICE_HEADER]], {
    origin: { r: 0, c: dgCol },
  });

  for (const res of summary.results) {
    const r = res.matrixRowNumber - 1; // 0-based row
    XLSX.utils.sheet_add_aoa(sheet, [[res.confidence]], { origin: { r, c: dfCol } });
    const priceVal = res.matchedListPrice;
    XLSX.utils.sheet_add_aoa(
      sheet,
      [[priceVal === null || priceVal === undefined ? "" : priceVal]],
      { origin: { r, c: dgCol } }
    );
  }

  // expand !ref
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  if (dgCol > range.e.c) range.e.c = dgCol;
  if (matrix.rows.length - 1 > range.e.r) range.e.r = matrix.rows.length - 1;
  sheet["!ref"] = XLSX.utils.encode_range(range);

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

export function downloadEnriched(matrix: ParsedWorkbook, summary: MatchSummary) {
  const bytes = buildEnrichedWorkbook(matrix, summary);
  const baseName = matrix.fileName.replace(/\.(xlsx|xls)$/i, "");
  const fileName = `enriched_${baseName}.xlsx`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
