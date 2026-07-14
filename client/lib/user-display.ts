import type { User } from "@/lib/types";

/** Dash-like / empty placeholders used when last name was required but unknown. */
const PLACEHOLDER_RE = /^[-–—−_./\\]+$/;

/** Treat "-" / empty placeholders as missing name parts (common in invite flows). */
export function namePart(value?: string | null) {
  const v = String(value || "")
    .trim()
    .replace(/\u00a0/g, " ")
    .trim();
  if (!v || PLACEHOLDER_RE.test(v)) return "";
  // "Micheal -" stored as a single field
  return v.replace(/\s*[-–—−]+\s*$/g, "").trim();
}

export function formatUserDisplayName(
  user?: Pick<User, "firstName" | "lastName" | "fullName" | "email"> | null,
  fallback = "User",
) {
  if (!user) return fallback;

  const fromParts = [namePart(user.firstName), namePart(user.lastName)].filter(Boolean).join(" ");
  if (fromParts) return fromParts;

  const cleanedFull = namePart(
    String(user.fullName || "")
      .trim()
      .replace(/\s*[-–—−]+\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (cleanedFull) return cleanedFull;

  return user.email || fallback;
}

export function userInitials(
  userOrName?: Pick<User, "firstName" | "lastName" | "fullName" | "email"> | string | null,
) {
  if (!userOrName) return "?";

  if (typeof userOrName === "string") {
    const cleaned = userOrName
      .replace(/\s*[-–—−]+\s*$/g, "")
      .split(/\s+/)
      .map((p) => namePart(p))
      .filter(Boolean);
    const chars = cleaned
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return chars || "?";
  }

  const first = namePart(userOrName.firstName);
  const last = namePart(userOrName.lastName);
  const fromParts = `${first[0] || ""}${last[0] || ""}`.toUpperCase();
  if (fromParts) return fromParts;

  return userInitials(formatUserDisplayName(userOrName, "?"));
}
