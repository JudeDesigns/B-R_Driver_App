import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Unwrap params
    const unwrappedParams = await Promise.resolve(params);
    
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const stopId = unwrappedParams.id;

    // Define uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    try {
      // Get all files in uploads directory
      const files = await fs.readdir(uploadsDir);
      
      // Filter files that match this stop's image pattern
      const imagePattern = new RegExp(`invoice_${stopId}_.*_img\\d+\\.jpg$`);
      const imagesToDelete = files.filter(fileName => imagePattern.test(fileName));

      // Delete matching images
      for (const fileName of imagesToDelete) {
        const filePath = path.join(uploadsDir, fileName);
        try {
          await fs.unlink(filePath);
          console.log(`Deleted existing image: ${fileName}`);
        } catch (error) {
          console.warn(`Failed to delete image ${fileName}:`, error);
        }
      }

      return NextResponse.json({
        message: `Cleared ${imagesToDelete.length} existing images`,
        deletedCount: imagesToDelete.length,
      });
    } catch (error) {
      console.warn("Error reading uploads directory:", error);
      // Return success even if directory doesn't exist or can't be read
      return NextResponse.json({
        message: "No existing images to clear",
        deletedCount: 0,
      });
    }
  } catch (error) {
    console.error("Error clearing images:", error);
    return NextResponse.json(
      { message: "Failed to clear images" },
      { status: 500 }
    );
  }
}
