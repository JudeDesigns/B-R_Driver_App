import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        // 1. Verify authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string;
        const routeId = formData.get("routeId") as string;

        if (!file || !type || !routeId) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        // 3. Create upload directory
        const uploadDir = path.join(process.cwd(), "public", "uploads", "safety");
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (err) {
            // Ignore if directory already exists
        }

        // 4. Generate unique filename
        const timestamp = Date.now();
        const extension = path.extname(file.name) || ".jpg";
        const fileName = `${routeId}_${type}_${timestamp}${extension}`;
        const filePath = path.join(uploadDir, fileName);

        // 5. Write file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // 6. Return the public URL
        const publicUrl = `/uploads/safety/${fileName}`;
        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error("Safety upload error:", error);
        return NextResponse.json(
            { message: "Failed to upload image" },
            { status: 500 }
        );
    }
}
