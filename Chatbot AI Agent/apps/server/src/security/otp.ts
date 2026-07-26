import { createHash, randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

type OtpRecord = {
  purpose: string;
  email: string;
  hash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  meta?: Record<string, unknown>;
};

function otpDir() {
  return path.join(env.dataDir, "otp");
}

function otpPath(key: string) {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return path.join(otpDir(), `${safe}.json`);
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export async function createOtpChallenge(input: {
  key: string;
  purpose: string;
  email: string;
  ttlMinutes?: number;
  meta?: Record<string, unknown>;
}): Promise<{ code: string; expiresAt: string }> {
  await fs.mkdir(otpDir(), { recursive: true });
  const code = generateOtpCode();
  const ttl = input.ttlMinutes ?? 10;
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  const record: OtpRecord = {
    purpose: input.purpose,
    email: input.email.toLowerCase(),
    hash: hashCode(code),
    attempts: 0,
    maxAttempts: 5,
    expiresAt,
    meta: input.meta,
  };
  await fs.writeFile(otpPath(input.key), JSON.stringify(record, null, 2));
  return { code, expiresAt };
}

export async function verifyOtpChallenge(input: {
  key: string;
  purpose: string;
  code: string;
}): Promise<{ ok: boolean; error?: string; meta?: Record<string, unknown> }> {
  try {
    const raw = await fs.readFile(otpPath(input.key), "utf8");
    const record = JSON.parse(raw) as OtpRecord;
    if (record.purpose !== input.purpose) {
      return { ok: false, error: "That verification code isn’t valid for this step." };
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await fs.unlink(otpPath(input.key)).catch(() => undefined);
      return { ok: false, error: "That code expired. Ask me to send a new one." };
    }
    if (record.attempts >= record.maxAttempts) {
      await fs.unlink(otpPath(input.key)).catch(() => undefined);
      return { ok: false, error: "Too many attempts. Ask me to send a new code." };
    }
    record.attempts += 1;
    const match = record.hash === hashCode(String(input.code).trim());
    if (!match) {
      await fs.writeFile(otpPath(input.key), JSON.stringify(record, null, 2));
      return { ok: false, error: "That code doesn’t match. Please try again." };
    }
    await fs.unlink(otpPath(input.key)).catch(() => undefined);
    return { ok: true, meta: record.meta };
  } catch {
    return { ok: false, error: "No active verification code. Ask me to send one first." };
  }
}
