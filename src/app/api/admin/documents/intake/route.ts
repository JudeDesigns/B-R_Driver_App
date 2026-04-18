import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { processIntakeFile } from "@/lib/documentIntakeService";
import { fileManager } from "@/lib/fileManager";
import { DocumentType } from "@prisma/client";

export const config = {
  api: {
    bodyParser: false, // Disallow Next.js body parsing as we handle multipart form data
  },
};

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const adminId = decoded.id;

    // 2. Parse FormData
    const formData = await request.formData();
    const dryRunStr = formData.get("dryRun");
    const isDryRun = dryRunStr === "true";
    const dateScopeStr = formData.get("dateScope");
    const dateScope = dateScopeStr ? parseInt(dateScopeStr as string, 10) : 7;
    
    // Extract array of files
    const entries = Array.from(formData.entries());
    const files = entries
      .filter(([key, value]) => key === "files" && value instanceof File)
      .map(([_, value]) => value as File);

    if (files.length === 0) {
      return NextResponse.json(
        { message: "No files provided for intake." },
        { status: 400 }
      );
    }

    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Create a Batch record if NOT dry run
    let batchId: string | null = null;
    if (!isDryRun) {
      const batch = await prisma.documentIntakeBatch.create({
        data: {
          status: "PENDING",
          totalFiles: files.length,
          createdBy: adminId,
        },
      });
      batchId = batch.id;
    }

    // Process each file
    for (const file of files) {
      const fileName = file.name;
      const fileSize = file.size;
      const mimeType = file.type || "application/octet-stream";

      // Parse and Query DB using robust DocumentIntakeService
      const matchResult = await processIntakeFile(fileName, fileSize, dateScope);
      const isMatched = matchResult.status === "MATCHED";

      if (isMatched) {
        matchedCount++;
      } else {
        unmatchedCount++;
      }

      let logId: string | null = null;
      let finalDocId: string | null = null;

      // If not dry run, save to standard folders & write to DB
      if (!isDryRun && isMatched && matchResult.resolvedTo && batchId) {
        try {
          // Wrap file upload in standard document upload flow
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Standard document storage using fileManager (same as manual upload)
          const uploadResult = await fileManager.saveFile(buffer, fileName);

          // Create base Document record
          const document = await prisma.document.create({
            data: {
              url: uploadResult.url,
              filePath: uploadResult.filePath,
              fileName: uploadResult.originalName,
              fileSize: uploadResult.size,
              mimeType: mimeType,
              documentType: (matchResult.docType as DocumentType) || "OTHER",
              uploadedBy: adminId,
              customerId: matchResult.resolvedTo.customerId,
            },
          });
          
          finalDocId = document.id;

          // If Flow is Stop, link it using StopDocument
          if (matchResult.flow === "stop" && matchResult.resolvedTo.stopId) {
            await prisma.stopDocument.create({
              data: {
                stopId: matchResult.resolvedTo.stopId,
                documentId: document.id,
              },
            });

            // Specific side-effects based on Plan
            if (matchResult.docType === "INVOICE" && matchResult.anchorType === "invoice") {
              await prisma.stop.update({
                where: { id: matchResult.resolvedTo.stopId },
                data: { quickbooksInvoiceNum: matchResult.anchorValue },
              });
            } else if (matchResult.docType === "CREDIT_MEMO") {
              await prisma.creditMemo.create({
                data: {
                  stopId: matchResult.resolvedTo.stopId,
                  amount: 0, // Placeholder, can be edited later
                  number: matchResult.anchorType === "invoice" ? `CM-${matchResult.anchorValue}` : `CM-STOP-${matchResult.resolvedTo.sequence}`,
                  reason: "Uploaded via automated document intake",
                },
              });
            }
          }

          // Generate a log for this successful commitment
          await prisma.documentIntakeLog.create({
            data: {
              batchId,
              fileName,
              fileSize,
              status: "MATCHED",
              flow: matchResult.flow,
              anchorType: matchResult.anchorType,
              anchorValue: matchResult.anchorValue,
              docType: matchResult.docType as DocumentType | undefined,
              resolvedToId: matchResult.flow === "stop" ? matchResult.resolvedTo.stopId : matchResult.resolvedTo.customerId,
            },
          });

        } catch (uploadOrDbError: any) {
          console.error("Error committing file:", uploadOrDbError);
          // If commit fails, log it as an error
          await prisma.documentIntakeLog.create({
            data: {
              batchId,
              fileName,
              fileSize,
              status: "UNMATCHED",
              errorMessage: `Commit failed: ${uploadOrDbError.message}`,
            },
          });
          matchResult.status = "UNMATCHED";
          matchResult.reason = `Commit failed: ${uploadOrDbError.message}`;
        }
      } else if (!isDryRun && !isMatched && batchId) {
         // Create UNMATCHED log
         await prisma.documentIntakeLog.create({
          data: {
            batchId,
            fileName,
            fileSize,
            status: "UNMATCHED",
            errorMessage: matchResult.reason,
          },
        });
      }

      results.push(matchResult);
    }

    // Finalize Batch if it was a commit
    if (!isDryRun && batchId) {
      await prisma.documentIntakeBatch.update({
        where: { id: batchId },
        data: {
          status: "COMMITTED",
          matchedCount,
          unmatchedCount,
        },
      });
    }

    return NextResponse.json({
      dryRun: isDryRun,
      totalFiles: files.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      results,
    });

  } catch (error: any) {
    console.error("Error processing document intake:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
