import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { Files } from "@repo/ai-core";
import type { FileKind } from "@repo/ai-core";

export const runtime = "nodejs";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

function inferKind(mime: string, requested?: FileKind): FileKind {
  if (requested && requested !== "other") return requested;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_ROOT, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";
    const requestedKind = (formData.get("kind") as FileKind | null) ?? "other";
    const kind = inferKind(mimeType, requestedKind);
    const scope = (formData.get("scope") as string | null) ?? "global";
    const companyId = (formData.get("companyId") as string | null) ?? null;

    const now = Date.now();
    const base = `${now}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.name) || "";

    const rawPath = path.join(UPLOAD_ROOT, "raw", `${base}${ext}`);
    await fs.mkdir(path.dirname(rawPath), { recursive: true });
    await fs.writeFile(rawPath, buffer);

    let finalPath = rawPath;
    let width: number | null = null;
    let height: number | null = null;
    let durationSeconds: number | null = null;

    // Image compression
    if (kind === "image" && mimeType.startsWith("image/")) {
      const processedPath = path.join(UPLOAD_ROOT, "processed", `${base}.webp`);
      await fs.mkdir(path.dirname(processedPath), { recursive: true });
      const img = sharp(rawPath).rotate().resize({ width: 1920, height: 1920, fit: "inside" });
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      await img.webp({ quality: 80 }).toFile(processedPath);
      finalPath = processedPath;
    }

    // Audio/video compression (basic fallback)
    if ((kind === "audio" || kind === "video") && (mimeType.startsWith("audio/") || mimeType.startsWith("video/"))) {
      const processedPath = path.join(
        UPLOAD_ROOT,
        "processed",
        `${base}.${kind === "audio" ? "mp3" : "mp4"}`
      );
      await fs.mkdir(path.dirname(processedPath), { recursive: true });
      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(rawPath)
            .outputOptions(
              kind === "audio"
                ? ["-b:a 128k"]
                : ["-b:v 1500k", "-vf", "scale='min(1280,iw)':-2"]
            )
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .save(processedPath);
        });
        finalPath = processedPath;
      } catch (err) {
        console.warn("ffmpeg processing failed; storing raw file", err);
        finalPath = rawPath;
      }
    }

    const stat = await fs.stat(finalPath);

    const record = await Files.insertFile({
      scope,
      companyId,
      uploadedBy: null,
      kind,
      mimeType,
      originalName: file.name,
      storagePath: finalPath,
      sizeBytes: stat.size,
      width,
      height,
      durationSeconds,
    });

    const url = `/api/files/${record.id}`;

    return NextResponse.json({ fileId: record.id, url });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? "Upload failed" }, { status: 500 });
  }
}
