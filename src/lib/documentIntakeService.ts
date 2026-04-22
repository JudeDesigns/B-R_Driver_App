import prisma from "./db";
import { parseFilename, DocTypeHint } from "./documentIntakeParser";
import { getTodayStartUTC } from "./timezone";

/**
 * Build the date filter for route matching. Because routes are uploaded
 * and dated in America/Los_Angeles, the window is anchored at the start
 * of today PT and walks backward day-by-day.
 *   scopeDays = 1  → today only
 *   scopeDays = 3  → today + 2 previous days
 *   scopeDays = 7  → today + 6 previous days
 * Also returns an upper bound one day past today to avoid matching
 * future-dated routes (if any exist due to bad data).
 */
function buildDateWindow(scopeDays: number): { gte: Date; lt: Date } {
  const startOfToday = getTodayStartUTC();
  const gte = new Date(startOfToday);
  gte.setDate(gte.getDate() - Math.max(0, scopeDays - 1));
  const lt = new Date(startOfToday);
  lt.setDate(lt.getDate() + 1);
  return { gte, lt };
}

export interface StopOption {
  stopId: string;
  customerId: string;
  invoiceNum: string;
  customerName: string;
  routeNumber: string;
  sequence: number;
  routeDate: string;
}

export interface CustomerOption {
  customerId: string;
  customerName: string;
  groupCode: string | null;
}

export interface IntakeMatchResult {
  fileName: string;
  fileSize: number;
  // MATCHED          = safe single match, can auto-assign
  // AMBIGUOUS        = valid candidates exist but > 1 — user must choose
  // NEEDS_ASSIGNMENT = no match at all, full manual assignment required
  status: "MATCHED" | "AMBIGUOUS" | "NEEDS_ASSIGNMENT";
  matchedBy?: "invoice" | "customer_name";
  extractedNumber?: string;
  triedNumbers: string[];
  nameTokens: string[];
  docTypeHint: DocTypeHint;
  reason?: string;
  resolvedTo?: StopOption;
  stopCandidates?: StopOption[];
  customerCandidates?: CustomerOption[];
}

function stopToOption(stop: any): StopOption {
  return {
    stopId: stop.id,
    customerId: stop.customerId,
    invoiceNum: stop.quickbooksInvoiceNum || "",
    customerName: stop.customer.name,
    routeNumber: stop.route.routeNumber || "Unknown",
    sequence: stop.sequence,
    routeDate: stop.route.date.toISOString(),
  };
}

/**
 * Scans a filename and attempts to match it to a stop or customer.
 *
 * Pipeline:
 *   1. For each 3+ digit sequence, look up Stop.quickbooksInvoiceNum.
 *      - exactly one hit → MATCHED
 *      - multiple hits   → AMBIGUOUS (user picks)
 *   2. If no invoice hits, fall back to customer-name tokens.
 *      - exactly one customer with exactly one active stop → MATCHED
 *      - multiple customers or multiple stops → AMBIGUOUS
 *      - customer found but no active stops → AMBIGUOUS (customer-only path)
 *   3. Otherwise → NEEDS_ASSIGNMENT.
 *
 * Safety: never auto-assigns when there is any ambiguity.
 */
export async function processIntakeFile(
  fileName: string,
  fileSize: number,
  dateScopeDays: number = 1
): Promise<IntakeMatchResult> {
  const { candidateNumbers, nameTokens, docTypeHint } = parseFilename(fileName);

  const dateWindow = buildDateWindow(dateScopeDays);

  const base = {
    fileName,
    fileSize,
    triedNumbers: candidateNumbers,
    nameTokens,
    docTypeHint,
  };

  // ── 1. Invoice number match ─────────────────────────────────────────
  for (const num of candidateNumbers) {
    const stops = await prisma.stop.findMany({
      where: {
        quickbooksInvoiceNum: num,
        isDeleted: false,
        route: { date: dateWindow, isDeleted: false },
      },
      orderBy: { route: { date: "desc" } },
      include: { route: true, customer: true },
    });

    if (stops.length === 1) {
      return {
        ...base,
        status: "MATCHED",
        matchedBy: "invoice",
        extractedNumber: num,
        resolvedTo: stopToOption(stops[0]),
      };
    }
    if (stops.length > 1) {
      return {
        ...base,
        status: "AMBIGUOUS",
        matchedBy: "invoice",
        extractedNumber: num,
        stopCandidates: stops.map(stopToOption),
        reason: `Invoice ${num} matches ${stops.length} stops — please choose one.`,
      };
    }
  }

  // ── 2. Customer-name fallback ───────────────────────────────────────
  if (nameTokens.length > 0) {
    const customers = await prisma.customer.findMany({
      where: {
        isDeleted: false,
        AND: nameTokens.map((t) => ({
          name: { contains: t, mode: "insensitive" as const },
        })),
      },
      take: 10,
    });

    if (customers.length === 0) {
      return {
        ...base,
        status: "NEEDS_ASSIGNMENT",
        reason: `No match found. Tried invoice(s): ${candidateNumbers.join(", ") || "none"}; name: "${nameTokens.join(" ")}".`,
      };
    }

    if (customers.length > 1) {
      return {
        ...base,
        status: "AMBIGUOUS",
        matchedBy: "customer_name",
        customerCandidates: customers.map((c) => ({
          customerId: c.id,
          customerName: c.name,
          groupCode: c.groupCode,
        })),
        reason: `Name "${nameTokens.join(" ")}" matches ${customers.length} customers — please choose one.`,
      };
    }

    const customer = customers[0];
    const stops = await prisma.stop.findMany({
      where: {
        customerId: customer.id,
        isDeleted: false,
        route: { date: dateWindow, isDeleted: false },
      },
      orderBy: { route: { date: "desc" } },
      include: { route: true, customer: true },
    });

    const customerOption: CustomerOption = {
      customerId: customer.id,
      customerName: customer.name,
      groupCode: customer.groupCode,
    };

    if (stops.length === 1) {
      return {
        ...base,
        status: "MATCHED",
        matchedBy: "customer_name",
        resolvedTo: stopToOption(stops[0]),
      };
    }
    if (stops.length > 1) {
      return {
        ...base,
        status: "AMBIGUOUS",
        matchedBy: "customer_name",
        stopCandidates: stops.map(stopToOption),
        customerCandidates: [customerOption],
        reason: `${customer.name} has ${stops.length} active stops — pick one, or attach at customer level.`,
      };
    }
    return {
      ...base,
      status: "AMBIGUOUS",
      matchedBy: "customer_name",
      customerCandidates: [customerOption],
      reason: `${customer.name} found but has no active stops in range — confirm as customer-only attachment.`,
    };
  }

  return {
    ...base,
    status: "NEEDS_ASSIGNMENT",
    reason: candidateNumbers.length
      ? `No stop found for number(s): ${candidateNumbers.join(", ")} — please assign manually.`
      : `No number or customer name found in filename — please assign manually.`,
  };
}

/**
 * Powers the live stop search dropdown in the UI.
 * Searches by invoice number, customer name, or route number.
 */
export async function searchStopsForIntake(
  query: string,
  dateScopeDays: number
): Promise<StopOption[]> {
  if (!query || query.trim().length < 2) return [];

  const dateWindow = buildDateWindow(dateScopeDays);

  const stops = await prisma.stop.findMany({
    where: {
      isDeleted: false,
      route: { date: dateWindow, isDeleted: false },
      OR: [
        { quickbooksInvoiceNum: { contains: query, mode: "insensitive" } },
        { orderNumberWeb: { contains: query, mode: "insensitive" } },
        { customer: { name: { contains: query, mode: "insensitive" } } },
        { route: { routeNumber: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: { route: true, customer: true },
    orderBy: { route: { date: "desc" } },
    take: 10,
  });

  return stops.map((stop) => ({
    stopId: stop.id,
    customerId: stop.customerId,
    invoiceNum: stop.quickbooksInvoiceNum || "",
    customerName: stop.customer.name,
    routeNumber: stop.route.routeNumber || "Unknown",
    sequence: stop.sequence,
    routeDate: stop.route.date.toISOString(),
  }));
}

/**
 * Powers the customer search dropdown (customer-only attachments).
 */
export async function searchCustomersForIntake(query: string): Promise<CustomerOption[]> {
  if (!query || query.trim().length < 2) return [];

  const customers = await prisma.customer.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { groupCode: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return customers.map((c) => ({
    customerId: c.id,
    customerName: c.name,
    groupCode: c.groupCode,
  }));
}

