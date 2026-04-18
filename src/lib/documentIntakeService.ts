import prisma from "./db";
import { parseDocumentFilename, ParsedDocumentIntake } from "./documentIntakeParser";

export interface IntakeMatchResult {
  fileName: string;
  fileSize: number;
  status: "MATCHED" | "UNMATCHED";
  reason?: string;
  
  // Sourced from parsed results
  flow?: "customer" | "stop";
  anchorType?: string;
  anchorValue?: string;
  docType?: string;
  
  // Resolved database relations
  resolvedTo?: {
    stopId?: string;
    customerId?: string;
    routeNumber?: string;
    sequence?: number;
    customerName?: string;
    routeDate?: string;
  }
}

/**
 * Takes a filename, parses it, and safely queries the database to find the
 * corresponding Stop or Customer. Operates in "Dry Run" mode naturally
 * (reads only, does not modify DB).
 */
export async function processIntakeFile(
  fileName: string,
  fileSize: number,
  dateScopeDays: number = 7
): Promise<IntakeMatchResult> {
  const parsed = parseDocumentFilename(fileName);

  if (parsed.status === "UNMATCHED") {
    return {
      fileName,
      fileSize,
      status: "UNMATCHED",
      reason: parsed.errorMessage,
    };
  }

  try {
    if (parsed.flow === "customer") {
      // Find customer by group code
      const customer = await prisma.customer.findFirst({
        where: {
          groupCode: parsed.anchorValue,
          isDeleted: false,
        },
      });

      if (!customer) {
        return {
          fileName,
          fileSize,
          status: "UNMATCHED",
          reason: `No active customer found with Group Code: ${parsed.anchorValue}`,
          flow: parsed.flow,
          anchorType: parsed.anchorType,
          anchorValue: parsed.anchorValue,
          docType: parsed.docType,
        };
      }

      return {
        fileName,
        fileSize,
        status: "MATCHED",
        flow: parsed.flow,
        anchorType: parsed.anchorType,
        anchorValue: parsed.anchorValue,
        docType: parsed.docType,
        resolvedTo: {
          customerId: customer.id,
          customerName: customer.name,
        },
      };

    } else if (parsed.flow === "stop") {
      // Scope routes to last N days to prevent false positives from old invoices
      const dateScope = new Date();
      dateScope.setDate(dateScope.getDate() - dateScopeDays);

      if (parsed.anchorType === "invoice") {
        // Find by QB Invoice Number
        const stop = await prisma.stop.findFirst({
          where: {
            quickbooksInvoiceNum: parsed.anchorValue,
            isDeleted: false,
            route: {
              date: { gte: dateScope },
              isDeleted: false,
            },
          },
          orderBy: { route: { date: 'desc' } }, // Most recent routing wins
          include: { route: true, customer: true },
        });

        if (!stop) {
          return {
            fileName,
            fileSize,
            status: "UNMATCHED",
            reason: `No stop found with QB Invoice #${parsed.anchorValue} in the last ${dateScopeDays} days.`,
            flow: parsed.flow,
            anchorType: parsed.anchorType,
            anchorValue: parsed.anchorValue,
            docType: parsed.docType,
          };
        }

        return {
          fileName,
          fileSize,
          status: "MATCHED",
          flow: parsed.flow,
          anchorType: parsed.anchorType,
          anchorValue: parsed.anchorValue,
          docType: parsed.docType,
          resolvedTo: {
            stopId: stop.id,
            customerId: stop.customerId,
            routeNumber: stop.route.routeNumber || "Unknown",
            sequence: stop.sequence,
            customerName: stop.customer.name,
            routeDate: stop.route.date.toISOString(),
          },
        };

      } else if (parsed.anchorType === "route_seq") {
        // Fallback: Find by Route Number + Sequence combination
        const stop = await prisma.stop.findFirst({
          where: {
            sequence: parseInt(parsed.stopSequence!),
            isDeleted: false,
            route: {
              routeNumber: parsed.routeNumber,
              date: { gte: dateScope },
              isDeleted: false,
            },
          },
          orderBy: { route: { date: 'desc' } },
          include: { route: true, customer: true },
        });

        if (!stop) {
          return {
            fileName,
            fileSize,
            status: "UNMATCHED",
            reason: `No active stop found on Route R${parsed.routeNumber} Sequence S${parsed.stopSequence} in the last ${dateScopeDays} days.`,
            flow: parsed.flow,
            anchorType: parsed.anchorType,
            anchorValue: parsed.anchorValue,
            docType: parsed.docType,
          };
        }

        return {
          fileName,
          fileSize,
          status: "MATCHED",
          flow: parsed.flow,
          anchorType: parsed.anchorType,
          anchorValue: parsed.anchorValue,
          docType: parsed.docType,
          resolvedTo: {
            stopId: stop.id,
            customerId: stop.customerId,
            routeNumber: stop.route.routeNumber || "Unknown",
            sequence: stop.sequence,
            customerName: stop.customer.name,
            routeDate: stop.route.date.toISOString(),
          },
        };
      }
    }
    
    return {
      fileName,
      fileSize,
      status: "UNMATCHED",
      reason: "Invalid flow type.",
    };
  } catch (err: any) {
    console.error("Error processing intake file:", err);
    return {
      fileName,
      fileSize,
      status: "UNMATCHED",
      reason: `System error during matching: ${err.message}`,
    };
  }
}
