import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";

export const uploadsRouter = Router();

const MAX_SIZE = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE, files: 1 } });

/**
 * Detect the real file type from its magic bytes — the client-supplied mimetype
 * and extension are never trusted.
 */
function sniff(buf: Buffer): { ext: string; kind: "image" | "document" } | null {
  const hex = buf.subarray(0, 12).toString("hex");
  if (hex.startsWith("ffd8ff")) return { ext: "jpg", kind: "image" };
  if (hex.startsWith("89504e470d0a1a0a")) return { ext: "png", kind: "image" };
  if (hex.startsWith("474946383")) return { ext: "gif", kind: "image" };
  if (hex.startsWith("52494646") && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", kind: "image" };
  if (hex.startsWith("255044462d")) return { ext: "pdf", kind: "document" };
  return null;
}

uploadsRouter.post("/", requireAuth, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError(400, "INVALID_FILE");

  const type = sniff(file.buffer);
  const wanted = req.query.kind === "document" ? ["image", "document"] : ["image"];
  if (!type || !wanted.includes(type.kind)) throw new AppError(400, "INVALID_FILE");

  // Only staff can attach documents; any signed-in user may upload an image (e.g. avatar).
  if (type.kind === "document" && req.user!.role === "STUDENT") throw new AppError(403, "FORBIDDEN");

  const name = `${crypto.randomUUID()}.${type.ext}`;
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, name), file.buffer);
  res.status(201).json({ url: `/uploads/${name}`, kind: type.kind, size: file.size });
});
