import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const isActive = searchParams.get("isActive");

    // Build where clause
    const where: any = {
      isDeleted: false,
    };

    if (type) {
      where.type = type;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    // Get documents
    const documents = await prisma.document.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            groupCode: true,
          },
        },
        _count: {
          select: {
            stopDocuments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const type = formData.get("type") as string;
    const customerId = formData.get("customerId") as string;
    const stopId = formData.get("stopId") as string;

    // Invoice-specific fields for stop documents
    const invoiceNumber = formData.get("invoiceNumber") as string;
    const invoiceAmount = formData.get("invoiceAmount") as string;

    if (!file || !title || !type) {
      return NextResponse.json(
        { message: "File, title, and type are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Only PDF, images, Word, and Excel files are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: "File size too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "documents");
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Save document to database
    const document = await prisma.document.create({
      data: {
        title,
        description: description || null,
        type: type as any,
        fileName: file.name,
        filePath: `/uploads/documents/${fileName}`,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: decoded.id,
        customerId: customerId || null, // Set customer ID if provided
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            groupCode: true,
          },
        },
      },
    });

    // If this is a stop-specific document, automatically assign it to the stop
    if (stopId) {
      await prisma.stopDocument.create({
        data: {
          stopId,
          documentId: document.id,
        },
      });

      // If this is an invoice document with invoice data, update the stop's invoice information
      if (type === 'INVOICE' && (invoiceNumber || invoiceAmount)) {
        const updateData: any = {};

        if (invoiceNumber && invoiceNumber.trim()) {
          updateData.quickbooksInvoiceNum = invoiceNumber.trim();
        }

        if (invoiceAmount && invoiceAmount.trim()) {
          const amount = parseFloat(invoiceAmount);
          if (!isNaN(amount)) {
            updateData.amount = amount;
          }
        }

        // Only update if we have data to update
        if (Object.keys(updateData).length > 0) {
          await prisma.stop.update({
            where: { id: stopId },
            data: updateData,
          });

          console.log(`Updated stop ${stopId} with invoice data:`, updateData);
        }
      }
    }

    return NextResponse.json({
      message: "Document uploaded successfully",
      document,
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
