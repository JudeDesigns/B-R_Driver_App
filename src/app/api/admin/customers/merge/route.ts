import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// POST /api/admin/customers/merge - Merge duplicate customers
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { customerName, dryRun = false } = await request.json();

    if (!customerName) {
      return NextResponse.json(
        { message: "Customer name is required" },
        { status: 400 }
      );
    }

    // Find all customers with the same name
    const duplicateCustomers = await prisma.customer.findMany({
      where: {
        name: customerName,
        isDeleted: false,
      },
      include: {
        stops: {
          select: {
            id: true,
            routeId: true,
            sequence: true,
          },
        },
        documents: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Most recent first (likely the manually created one)
      },
    });

    if (duplicateCustomers.length <= 1) {
      return NextResponse.json({
        message: "No duplicates found for this customer",
        customerName,
        found: duplicateCustomers.length,
      });
    }

    // Identify the primary customer (most complete data)
    const primaryCustomer = duplicateCustomers.find(c => 
      c.address && c.address.trim() !== ""
    ) || duplicateCustomers[0]; // Fallback to most recent

    const duplicatesToMerge = duplicateCustomers.filter(c => c.id !== primaryCustomer.id);

    if (dryRun) {
      // Return preview of what would be merged
      return NextResponse.json({
        message: "Merge preview (dry run)",
        customerName,
        primaryCustomer: {
          id: primaryCustomer.id,
          name: primaryCustomer.name,
          address: primaryCustomer.address,
          email: primaryCustomer.email,
          stops: primaryCustomer.stops.length,
          documents: primaryCustomer.documents.length,
        },
        duplicatesToMerge: duplicatesToMerge.map(d => ({
          id: d.id,
          name: d.name,
          address: d.address,
          email: d.email,
          stops: d.stops.length,
          documents: d.documents.length,
        })),
        totalStopsToMove: duplicatesToMerge.reduce((sum, d) => sum + d.stops.length, 0),
        totalDocumentsToMove: duplicatesToMerge.reduce((sum, d) => sum + d.documents.length, 0),
      });
    }

    // Perform the actual merge
    const result = await prisma.$transaction(async (tx) => {
      let totalStopsMoved = 0;
      let totalDocumentsMoved = 0;

      for (const duplicate of duplicatesToMerge) {
        console.log(`🔄 Merging customer ${duplicate.id} into ${primaryCustomer.id}`);
        
        // Move stops
        const stopsUpdated = await tx.stop.updateMany({
          where: {
            customerId: duplicate.id,
          },
          data: {
            customerId: primaryCustomer.id,
          },
        });
        totalStopsMoved += stopsUpdated.count;
        
        // Move documents
        const documentsUpdated = await tx.document.updateMany({
          where: {
            customerId: duplicate.id,
          },
          data: {
            customerId: primaryCustomer.id,
          },
        });
        totalDocumentsMoved += documentsUpdated.count;
        
        // Soft delete the duplicate
        await tx.customer.update({
          where: {
            id: duplicate.id,
          },
          data: {
            isDeleted: true,
          },
        });
        
        console.log(`✅ Merged customer: ${duplicate.name} (${duplicate.id})`);
      }

      return {
        totalStopsMoved,
        totalDocumentsMoved,
        duplicatesRemoved: duplicatesToMerge.length,
      };
    });

    console.log(`✅ Successfully merged ${duplicatesToMerge.length} duplicate customers for: ${customerName}`);

    return NextResponse.json({
      message: "Customers merged successfully",
      customerName,
      primaryCustomerId: primaryCustomer.id,
      ...result,
    });

  } catch (error) {
    console.error("Error merging customers:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// GET /api/admin/customers/merge - Find all duplicate customers
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Find all customers grouped by name
    const allCustomers = await prisma.customer.findMany({
      where: {
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        address: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            stops: true,
            documents: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Group by name and find duplicates
    const customerGroups = new Map<string, any[]>();
    
    for (const customer of allCustomers) {
      if (!customerGroups.has(customer.name)) {
        customerGroups.set(customer.name, []);
      }
      customerGroups.get(customer.name)!.push(customer);
    }

    // Filter to only groups with duplicates
    const duplicateGroups = Array.from(customerGroups.entries())
      .filter(([name, customers]) => customers.length > 1)
      .map(([name, customers]) => ({
        name,
        count: customers.length,
        customers: customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        totalStops: customers.reduce((sum, c) => sum + c._count.stops, 0),
        totalDocuments: customers.reduce((sum, c) => sum + c._count.documents, 0),
      }));

    return NextResponse.json({
      message: `Found ${duplicateGroups.length} customer groups with duplicates`,
      duplicateGroups,
      totalDuplicateCustomers: duplicateGroups.reduce((sum, g) => sum + g.count, 0),
    });

  } catch (error) {
    console.error("Error finding duplicate customers:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
