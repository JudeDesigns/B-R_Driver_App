import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  processIntakeFile,
  searchStopsForIntake,
  searchCustomersForIntake,
} from "@/lib/documentIntakeService";
import { fileManager } from "@/lib/fileManager";
import { DocumentType } from "@prisma/client";

function authCheck(request: NextRequest): { adminId: string } | NextResponse {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const decoded = verifyToken(authHeader.split(" ")[1]) as any;
  if (!decoded?.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return { adminId: decoded.id };
}

// GET /api/admin/documents/intake
//   ?type=stop     (default) — live stop search for manual assignment
//   ?type=customer           — live customer search for customer-only attachments
//   ?type=history            — recent batches + per-file logs (for audit trail)
export async function GET(request: NextRequest) {
  const auth = authCheck(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const searchType = searchParams.get("type") || "stop";
  const dateScope = parseInt(searchParams.get("dateScope") || "7", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

  try {
    if (searchType === "history") {
      const batches = await prisma.documentIntakeBatch.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: { select: { fullName: true, username: true } },
          logs: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              status: true,
              flow: true,
              docType: true,
              resolvedToId: true,
              errorMessage: true,
              createdAt: true,
            },
          },
        },
      });
      return NextResponse.json({ batches });
    }

    if (searchType === "customer") {
      const customers = await searchCustomersForIntake(query);
      return NextResponse.json({ customers });
    }

    const stops = await searchStopsForIntake(query, dateScope);
    return NextResponse.json({ stops });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/admin/documents/intake
// dryRun=true  → scan files, return auto-match results (no DB writes)
// dryRun=false → commit using explicit assignments confirmed by user
export async function POST(request: NextRequest) {
  const auth = authCheck(request);
  if (auth instanceof NextResponse) return auth;
  const { adminId } = auth;

  try {
    const formData = await request.formData();
    const isDryRun = formData.get("dryRun") === "true";
    const dateScope = parseInt(formData.get("dateScope") as string || "7", 10);

    const files = Array.from(formData.entries())
      .filter(([key, val]) => key === "files" && val instanceof File)
      .map(([_, val]) => val as File);

    if (files.length === 0) {
      return NextResponse.json({ message: "No files provided." }, { status: 400 });
    }

    // --- DRY RUN: just scan, no DB writes ---
    if (isDryRun) {
      const results = await Promise.all(
        files.map((f) => processIntakeFile(f.name, f.size, dateScope))
      );
      const matched = results.filter((r) => r.status === "MATCHED").length;
      return NextResponse.json({
        dryRun: true,
        totalFiles: files.length,
        matched,
        needsAssignment: files.length - matched,
        results,
      });
    }

    // --- COMMIT: use explicit user-confirmed assignments ---
    const assignmentsRaw = formData.get("assignments") as string;
    if (!assignmentsRaw) {
      return NextResponse.json({ message: "No assignments provided for commit." }, { status: 400 });
    }

    interface Assignment {
      fileName: string;
      stopId: string | null;      // null = customer-only attachment
      customerId: string;
      docType: string;
      referenceNumber?: string;   // invoice / credit memo / PO number
      amount?: string;            // invoice total or credit memo amount
    }
    const assignments: Assignment[] = JSON.parse(assignmentsRaw);

    const fileMap = new Map(files.map((f) => [f.name, f]));

    const batch = await prisma.documentIntakeBatch.create({
      data: { status: "PENDING", totalFiles: assignments.length, createdBy: adminId },
    });

    let committed = 0;
    let skipped = 0;
    const errors: Array<{ fileName: string; error: string }> = [];
    const skippedList: Array<{ fileName: string; reason: string }> = [];

    // Category mapping for organized file storage
    const categoryFor = (docType: string): "documents" => "documents";
    const subCategoryFor = (docType: string): string | undefined => {
      switch (docType) {
        case "INVOICE":
        case "CUSTOMER_INVOICE":
          return "invoices";
        case "CREDIT_MEMO":
          return "credit-memos";
        case "STATEMENT":
          return "statements";
        default:
          return undefined;
      }
    };

    for (const assignment of assignments) {
      const file = fileMap.get(assignment.fileName);
      if (!file) {
        errors.push({ fileName: assignment.fileName, error: "File not included in upload." });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // uploadFile deduplicates by sha256 checksum — same bytes return the
        // existing File record instead of creating a new one on disk.
        const upload = await fileManager.uploadFile(
          buffer,
          file.name,
          file.type || "application/octet-stream",
          adminId,
          {
            category: categoryFor(assignment.docType),
            subCategory: subCategoryFor(assignment.docType),
          }
        );

        // Scope customerId: only customer-only attachments surface under the
        // customer's documents list (which is also injected into every stop
        // for that customer by /api/driver/stops/[id]/documents). Stop-level
        // attachments must NOT set customerId, otherwise a single-stop invoice
        // would leak into every other stop of that customer.
        const resolvedCustomerId = assignment.stopId ? null : assignment.customerId;

        let document = await prisma.document.findFirst({
          where: {
            filePath: upload.filePath,
            customerId: resolvedCustomerId,
            type: (assignment.docType as DocumentType) || "OTHER",
            isDeleted: false,
          },
        });

        if (!document) {
          document = await prisma.document.create({
            data: {
              title: file.name,
              description: `Batch intake — assigned by admin`,
              type: (assignment.docType as DocumentType) || "OTHER",
              filePath: upload.filePath,
              fileName: upload.originalName,
              fileSize: upload.fileSize,
              mimeType: upload.mimeType,
              uploadedBy: adminId,
              customerId: resolvedCustomerId,
            },
          });
        }

        // Stop-level attachment: guard against duplicate link.
        if (assignment.stopId) {
          const existingLink = await prisma.stopDocument.findFirst({
            where: {
              stopId: assignment.stopId,
              documentId: document.id,
              isDeleted: false,
            },
          });
          if (existingLink) {
            skippedList.push({
              fileName: assignment.fileName,
              reason: "Already attached to this stop.",
            });
            skipped++;
            await prisma.documentIntakeLog.create({
              data: {
                batchId: batch.id,
                fileName: assignment.fileName,
                fileSize: file.size,
                status: "UNMATCHED",
                flow: "stop",
                docType: assignment.docType as DocumentType,
                resolvedToId: assignment.stopId,
                errorMessage: "Duplicate: already attached to this stop.",
              },
            });
            continue;
          }
          await prisma.stopDocument.create({
            data: { stopId: assignment.stopId, documentId: document.id },
          });

          // Sync reference number and amount back to the Stop record, matching
          // the behaviour of the legacy single-file upload route.
          const refNumber = (assignment.referenceNumber || "").trim();
          const amountStr = (assignment.amount || "").trim();
          const parsedAmount = amountStr !== "" ? parseFloat(amountStr) : null;
          const hasValidAmount = parsedAmount !== null && !isNaN(parsedAmount);

          if (refNumber || hasValidAmount) {
            const stopUpdate: {
              quickbooksInvoiceNum?: string;
              amount?: number;
              creditMemoNumber?: string;
              creditMemoAmount?: number;
            } = {};

            if (assignment.docType === "INVOICE") {
              if (refNumber) stopUpdate.quickbooksInvoiceNum = refNumber;
              if (hasValidAmount) stopUpdate.amount = parsedAmount!;
            } else if (assignment.docType === "CREDIT_MEMO") {
              if (refNumber) stopUpdate.creditMemoNumber = refNumber;
              if (hasValidAmount) stopUpdate.creditMemoAmount = parsedAmount!;
            }

            if (Object.keys(stopUpdate).length > 0) {
              await prisma.stop.update({
                where: { id: assignment.stopId! },
                data: stopUpdate,
              });
            }

            // For credit memos, also create/update the CreditMemo record
            // (mirrors the single-file upload route behaviour).
            if (assignment.docType === "CREDIT_MEMO" && hasValidAmount) {
              const cmNum = refNumber || "N/A";
              const existingCM = await prisma.creditMemo.findFirst({
                where: { stopId: assignment.stopId!, creditMemoNumber: cmNum, isDeleted: false },
              });
              if (existingCM) {
                await prisma.creditMemo.update({
                  where: { id: existingCM.id },
                  data: { creditMemoAmount: parsedAmount!, documentId: document.id, updatedAt: new Date() },
                });
              } else {
                await prisma.creditMemo.create({
                  data: {
                    stopId: assignment.stopId!,
                    creditMemoNumber: cmNum,
                    creditMemoAmount: parsedAmount!,
                    documentId: document.id,
                  },
                });
              }
            }
          }
        }

        await prisma.documentIntakeLog.create({
          data: {
            batchId: batch.id,
            fileName: file.name,
            fileSize: file.size,
            status: "MATCHED",
            flow: assignment.stopId ? "stop" : "customer",
            docType: assignment.docType as DocumentType,
            resolvedToId: assignment.stopId || assignment.customerId,
          },
        });

        committed++;
      } catch (err: any) {
        console.error("Commit error for", assignment.fileName, err);
        errors.push({ fileName: assignment.fileName, error: err.message || "Unknown error" });
        await prisma.documentIntakeLog.create({
          data: {
            batchId: batch.id,
            fileName: assignment.fileName,
            fileSize: file.size,
            status: "UNMATCHED",
            errorMessage: err.message,
          },
        });
      }
    }

    const failed = errors.length;
    await prisma.documentIntakeBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMMITTED",
        matchedCount: committed,
        unmatchedCount: failed + skipped,
      },
    });

    return NextResponse.json({
      committed,
      failed,
      skipped,
      total: assignments.length,
      errors,
      skippedList,
    });

  } catch (error: any) {
    console.error("Intake error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}
