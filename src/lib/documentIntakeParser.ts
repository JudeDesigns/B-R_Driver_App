import { DocumentType } from "@prisma/client";

export interface ParsedDocumentIntake {
  status: "MATCHED" | "UNMATCHED";
  errorMessage?: string;
  flow?: "customer" | "stop";
  anchorType?: "invoice" | "route_seq" | "group_code";
  anchorValue?: string;
  routeNumber?: string;
  stopSequence?: string;
  docTypeString?: string;
  docType?: DocumentType;
}

// Maps short codes to DocumentType enum
const DOC_TYPE_MAP: Record<string, DocumentType> = {
  INV: "INVOICE",
  CM: "CREDIT_MEMO",
  PO: "PURCHASE_ORDER",
  STMT: "DELIVERY_RECEIPT",
  RF: "RETURN_FORM",
  OTHER: "OTHER",
};

export function parseDocumentFilename(filename: string): ParsedDocumentIntake {
  // Remove extension (e.g., .pdf, .jpg)
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const parts = nameWithoutExt.split("_");

  if (parts.length < 3) {
    return {
      status: "UNMATCHED",
      errorMessage: "Filename violates convention. Needs at least 3 parts separated by underscores. Example: STOP_10045_INV.pdf",
    };
  }

  const prefix = parts[0].toUpperCase();

  if (prefix === "CUST") {
    // Strategy: CUST_{groupCode}_{type}[_anything]
    const groupCode = parts[1].toUpperCase();
    const typeCode = parts[2].toUpperCase();
    const docType = DOC_TYPE_MAP[typeCode];

    if (!docType) {
      return {
        status: "UNMATCHED",
        errorMessage: `Unknown document type code: ${typeCode}. Allowed: INV, CM, PO, STMT, RF, OTHER.`,
      };
    }

    if (docType === "INVOICE") {
      return {
        status: "UNMATCHED",
        errorMessage: "Document type INV is not allowed for CUST flowing objects. Use STOP_ instead.",
      };
    }

    return {
      status: "MATCHED",
      flow: "customer",
      anchorType: "group_code",
      anchorValue: groupCode,
      docTypeString: typeCode,
      docType: docType,
    };
  } else if (prefix === "STOP") {
    // Check if it's route sequence fallback: STOP_R{Route}_S{Seq}_{type}
    if (parts[1].toUpperCase().startsWith("R") && parts[2].toUpperCase().startsWith("S")) {
      if (parts.length < 4) {
        return {
          status: "UNMATCHED",
          errorMessage: "Route sequence filename needs type code. Example: STOP_R12_S04_CM.pdf",
        };
      }
      
      const routeRaw = parts[1].toUpperCase();
      const seqRaw = parts[2].toUpperCase();
      
      const routeNumStr = routeRaw.substring(1); // remove "R"
      const seqStr = seqRaw.substring(1); // remove "S"

      if (isNaN(parseInt(routeNumStr)) || isNaN(parseInt(seqStr))) {
        return {
          status: "UNMATCHED",
          errorMessage: `Invalid route or sequence identifier: ${routeRaw}_${seqRaw}`,
        };
      }

      const typeCode = parts[3].toUpperCase();
      const docType = DOC_TYPE_MAP[typeCode];

      if (!docType) {
        return {
          status: "UNMATCHED",
          errorMessage: `Unknown document type code: ${typeCode}.`,
        };
      }

      return {
        status: "MATCHED",
        flow: "stop",
        anchorType: "route_seq",
        anchorValue: `${routeRaw}_${seqRaw}`,
        routeNumber: routeNumStr,
        stopSequence: seqStr,
        docTypeString: typeCode,
        docType: docType,
      };
    } else {
      // Primary invoice matching: STOP_{invoiceNum}_{type}
      const invoiceNum = parts[1].toUpperCase();
      const typeCode = parts[2].toUpperCase();
      const docType = DOC_TYPE_MAP[typeCode];

      if (!docType) {
        return {
          status: "UNMATCHED",
          errorMessage: `Unknown document type code: ${typeCode}.`,
        };
      }

      return {
        status: "MATCHED",
        flow: "stop",
        anchorType: "invoice",
        anchorValue: invoiceNum,
        docTypeString: typeCode,
        docType: docType,
      };
    }
  }

  return {
    status: "UNMATCHED",
    errorMessage: "Filename must start with CUST_ or STOP_.",
  };
}
