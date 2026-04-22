/**
 * documentIntakeParser.ts
 *
 * Smart filename parsing — no naming convention required.
 * Extracts candidate invoice numbers, customer-name tokens, and a
 * document-type hint so the service can auto-match against the DB.
 *
 * Examples:
 *   "Invoice 10045.pdf"              → numbers:["10045"] tokens:[] type:INVOICE
 *   "Beverly Dairy (C) 98558.pdf"    → numbers:["98558"] tokens:["beverly","dairy"] type:CREDIT_MEMO
 *   "Pho Show 98555.pdf"             → numbers:["98555"] tokens:["pho","show"]
 *   "Silvio's House Stmt.pdf"        → numbers:[]        tokens:["silvio","house"] type:STATEMENT
 *   "scan001.pdf"                    → numbers:[]        tokens:[] → needs manual assignment
 */

export type DocTypeHint =
  | "INVOICE"
  | "CREDIT_MEMO"
  | "STATEMENT"
  | "PURCHASE_ORDER"
  | null;

export interface ParsedFilename {
  candidateNumbers: string[];
  nameTokens: string[];
  docTypeHint: DocTypeHint;
}

// Order matters — most specific patterns first.
const DOC_TYPE_PATTERNS: Array<{ pattern: RegExp; type: Exclude<DocTypeHint, null> }> = [
  { pattern: /\bcredit[\s_-]*memo\b|\(c\)|\bcm\b/i, type: "CREDIT_MEMO" },
  { pattern: /\bstatement\b|\bstmt\b/i, type: "STATEMENT" },
  { pattern: /\bpurchase[\s_-]*order\b|\bp\.?o\b/i, type: "PURCHASE_ORDER" },
  { pattern: /\binvoice\b|\binv\b/i, type: "INVOICE" },
];

// Words that should never count as a customer-name token.
const NOISE_TOKENS = new Set([
  "invoice", "inv", "credit", "memo", "statement", "stmt",
  "purchase", "order", "copy", "scan", "scanned", "doc", "document",
  "pdf", "png", "jpg", "jpeg", "receipt", "the", "and", "for",
  "final", "signed", "draft",
]);

export function parseFilename(filename: string): ParsedFilename {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  let docTypeHint: DocTypeHint = null;
  for (const { pattern, type } of DOC_TYPE_PATTERNS) {
    if (pattern.test(nameWithoutExt)) {
      docTypeHint = type;
      break;
    }
  }

  const numberMatches = nameWithoutExt.match(/\d{3,}/g) || [];
  const candidateNumbers = [...new Set(numberMatches)].sort((a, b) => b.length - a.length);

  const rawTokens = nameWithoutExt
    .split(/[^a-zA-Z]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !NOISE_TOKENS.has(w));
  const nameTokens = [...new Set(rawTokens)];

  return { candidateNumbers, nameTokens, docTypeHint };
}

// Back-compat: some callers only need the numbers.
export function extractCandidateNumbers(filename: string): { candidateNumbers: string[] } {
  const { candidateNumbers } = parseFilename(filename);
  return { candidateNumbers };
}
