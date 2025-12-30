import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { Files } from "@repo/ai-core";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const record = await Files.getFileById(params.fileId);
  if (!record) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const storagePath = (record as any).storage_path ?? (record as any).storagePath;
    if (!storagePath) {
      return new NextResponse("File path missing", { status: 404 });
    }
    const exists = await fs
      .stat(storagePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return new NextResponse("File not found on disk", { status: 404 });
    }

    const data = await fs.readFile(storagePath);
    const body = new Uint8Array(data);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": (record as any).mime_type ?? (record as any).mimeType ?? "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `inline; filename="${path.basename((record as any).original_name ?? "file")}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return new NextResponse("File unavailable", { status: 500 });
  }
}
