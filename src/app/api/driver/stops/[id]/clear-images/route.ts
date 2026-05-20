import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import fs from "fs/promises";
import path from "path";

// DELETE /api/driver/stops/[id]/clear-images
//
// HARDENED: This endpoint used to blanket-delete every file on disk matching
// `invoice_<stopId>_*_img*.jpg`, which destroyed the previous session's
// images whenever the driver merely opened the picker. That race was the
// root cause of "404 Not Found" on driver-uploaded invoice photos.
//
// New behavior: only delete ORPHANED files for this stop — i.e. files on
// disk that match the stop pattern but are NOT referenced by the Stop's
// current `invoiceImageUrls`. Live images are now physically impossible to
// remove via this endpoint, regardless of who calls it.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const unwrappedParams = await Promise.resolve(params);

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
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    // Load the Stop's currently-live image set. Files referenced here are
    // off-limits — we never touch them, even if the disk has stragglers.
    let liveImageUrls: string[] = [];
    try {
      const stop = await prisma.stop.findUnique({
        where: { id: stopId },
        select: { invoiceImageUrls: true },
      });
      liveImageUrls = Array.isArray(stop?.invoiceImageUrls)
        ? (stop!.invoiceImageUrls as string[])
        : [];
    } catch (lookupError) {
      // If the lookup fails for any reason, refuse to delete anything. This
      // is intentional: silently wiping files on a transient DB error is
      // what got us into this mess.
      console.warn("clear-images: stop lookup failed, refusing to delete:", lookupError);
      return NextResponse.json({
        message: "Could not verify live images; no files deleted",
        deletedCount: 0,
      });
    }

    const liveFileNames = new Set(
      liveImageUrls
        .filter((u) => typeof u === "string" && u.startsWith("/uploads/"))
        .map((u) => path.basename(u))
    );

    try {
      const files = await fs.readdir(uploadsDir);

      const imagePattern = new RegExp(`^invoice_${stopId}_.*_img\\d+\\.jpg$`);
      const candidates = files.filter((fileName) => imagePattern.test(fileName));
      const orphans = candidates.filter((fileName) => !liveFileNames.has(fileName));

      let deletedCount = 0;
      for (const fileName of orphans) {
        const filePath = path.join(uploadsDir, fileName);
        try {
          await fs.unlink(filePath);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete orphan image ${fileName}:`, error);
        }
      }

      return NextResponse.json({
        message: `Cleared ${deletedCount} orphaned image(s); ${liveFileNames.size} live image(s) preserved`,
        deletedCount,
        preservedCount: liveFileNames.size,
      });
    } catch (error) {
      console.warn("Error reading uploads directory:", error);
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
