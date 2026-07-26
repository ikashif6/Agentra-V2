import express, { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { getConversation } from "../../storage/store.js";
import type { ChatAttachment } from "@chatbot/shared";

export const uploadRouter = Router();

const UPLOAD_ROOT = path.join(env.dataDir, "uploads");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;

const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
]);

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, max = 20, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const cur = rateBuckets.get(key);
  if (!cur || cur.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

function safeExt(name: string): string {
  const ext = path.extname(name || "").toLowerCase();
  return ALLOWED_EXT.has(ext) ? ext : "";
}

function kindFor(mime: string, ext: string): "image" | "file" {
  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    return "image";
  }
  return "file";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(UPLOAD_ROOT, today);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = safeExt(file.originalname) || ".bin";
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 40);
    cb(null, `${Date.now()}-${randomBytes(6).toString("hex")}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ext = safeExt(file.originalname);
    if (!ext) {
      cb(new Error(`File type not allowed (${path.extname(file.originalname) || "unknown"})`));
      return;
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`MIME type not allowed (${file.mimetype})`));
      return;
    }
    cb(null, true);
  },
});

function canAttach(conversationId: string): Promise<boolean> {
  return getConversation(conversationId).then((c) => {
    if (!c) return false;
    return Boolean(
      c.humanTakeover ||
        c.state.humanTakeover ||
        c.handoffState === "agent_joined",
    );
  });
}

uploadRouter.post("/", (req, res) => {
  const ip = String(req.ip || "unknown");

  upload.array("files", MAX_FILES)(req, res, async (err) => {
    if (err) {
      const msg =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large. Maximum size is 5 MB."
            : err.code === "LIMIT_FILE_COUNT"
              ? "Too many files. Maximum 3 per upload."
              : err.message
          : err instanceof Error
            ? err.message
            : "Upload failed";
      res.status(400).json({ success: false, message: msg });
      return;
    }

    try {
      // Multipart fields are only available after multer runs
      const conversationId = String(
        req.body?.conversationId || req.query.conversationId || "",
      );
      const sessionToken = String(
        req.body?.sessionToken || req.query.sessionToken || "",
      );

      if (!conversationId || !sessionToken) {
        res.status(400).json({
          success: false,
          message: "conversationId and sessionToken are required",
        });
        return;
      }
      if (!rateLimit(`${conversationId}:${ip}`)) {
        res.status(429).json({
          success: false,
          message: "Too many uploads. Please wait a few minutes.",
        });
        return;
      }

      const conversation = await getConversation(conversationId);
      if (!conversation || conversation.sessionToken !== sessionToken) {
        res.status(403).json({ success: false, message: "Invalid session for upload." });
        return;
      }
      if (!(await canAttach(conversationId))) {
        res.status(403).json({
          success: false,
          message: "Attachments are only available after an agent has joined.",
        });
        return;
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        res.status(400).json({ success: false, message: "No files uploaded." });
        return;
      }

      const attachments: ChatAttachment[] = files.map((f) => {
        const ext = path.extname(f.filename).toLowerCase();
        const rel = path
          .relative(UPLOAD_ROOT, f.path)
          .split(path.sep)
          .join("/");
        return {
          id: randomUUID(),
          url: `/v1/uploads/files/${rel}`,
          filename: f.originalname.slice(0, 120),
          mimeType: f.mimetype || "application/octet-stream",
          size: f.size,
          kind: kindFor(f.mimetype || "", ext),
        };
      });

      res.json({ success: true, data: { attachments } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: "Upload failed" });
    }
  });
});

/** Serve uploaded files via static (path-safe root) */
uploadRouter.use(
  "/files",
  express.static(UPLOAD_ROOT, {
    dotfiles: "deny",
    index: false,
    fallthrough: false,
  }),
);
