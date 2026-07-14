export type WorkspaceTheme = "light" | "dark" | "system";

export type WorkspaceBranding = {
  logo: string | null;
  primaryColor: string;
  theme: WorkspaceTheme;
};

export const DEFAULT_PRIMARY_COLOR = "#D85A30";

const BRANDING_CACHE_KEY = "agentra_workspace_branding";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export function normalizeHex(hex: string) {
  const value = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_PRIMARY_COLOR;
}

function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex).replace("#", "");
  if (normalized.length !== 6) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslString({ h, s, l }: Hsl) {
  return `${h} ${s}% ${l}%`;
}

export function generateBrandCssVars(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const base = rgbToHsl(rgb);
  const hover: Hsl = {
    h: base.h,
    s: Math.min(base.s + 8, 100),
    l: Math.min(base.l + 16, 78),
  };
  const muted: Hsl = {
    h: base.h,
    s: Math.max(base.s - 18, 20),
    l: Math.min(base.l + 40, 96),
  };
  const mutedForeground: Hsl = {
    h: base.h,
    s: Math.max(base.s - 8, 25),
    l: Math.max(base.l - 12, 22),
  };

  const brand = hslString(base);
  return {
    "--brand": brand,
    "--primary": brand,
    "--ring": brand,
    "--brand-hover": hslString(hover),
    "--primary-hover": hslString(hover),
    "--brand-muted": hslString(muted),
    "--accent": hslString(muted),
    "--brand-muted-foreground": hslString(mutedForeground),
    "--accent-foreground": hslString(mutedForeground),
    "--sidebar-accent": hslString(muted),
    "--sidebar-accent-foreground": hslString(mutedForeground),
  } as Record<string, string>;
}

export function resolveWorkspaceTheme(theme: WorkspaceTheme): "light" | "dark" {
  if (theme === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme === "dark" ? "dark" : "light";
}

export function cacheWorkspaceBranding(branding: WorkspaceBranding) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
}

export function readCachedWorkspaceBranding(): WorkspaceBranding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceBranding) : null;
  } catch {
    return null;
  }
}

export function applyWorkspaceBranding(branding: Partial<WorkspaceBranding>) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const primaryColor = normalizeHex(branding.primaryColor ?? DEFAULT_PRIMARY_COLOR);
  const theme = branding.theme ?? "light";
  const resolved = resolveWorkspaceTheme(theme);

  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;

  const vars = generateBrandCssVars(primaryColor);
  if (vars) {
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }
}

export async function resizeLogoFile(file: File, maxWidth = 320, maxHeight = 96): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // SVG must stay vector — canvas resize fails / rasterizes badly in most browsers.
  if (
    file.type === "image/svg+xml" ||
    file.name.toLowerCase().endsWith(".svg")
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.92),
    );

    if (!blob) return file;
    const ext = file.type === "image/png" ? "png" : "jpg";
    return new File([blob], `workspace-logo.${ext}`, { type: blob.type });
  } catch {
    // Unsupported decode (some SVGs / exotic formats) — upload original.
    return file;
  }
}

export const THEME_OPTIONS: { id: WorkspaceTheme; label: string; description: string }[] = [
  { id: "light", label: "Light", description: "Bright workspace with white surfaces." },
  { id: "dark", label: "Dark", description: "Dim workspace for low-light environments." },
  { id: "system", label: "System", description: "Follow your device appearance setting." },
];

type ThemeUser = { preferences?: { theme?: WorkspaceTheme } } | null;
type ThemeCompany = {
  logo?: string | null;
  branding?: { primaryColor?: string; theme?: WorkspaceTheme };
} | null;

export function effectiveWorkspaceBranding(
  user: ThemeUser,
  company: ThemeCompany,
): WorkspaceBranding | null {
  if (!company && !user) return null;

  const primaryColor = company?.branding?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const logo = company?.logo ?? null;
  const userTheme = user?.preferences?.theme;
  let theme: WorkspaceTheme = company?.branding?.theme ?? "light";

  if (userTheme === "light" || userTheme === "dark") {
    theme = userTheme;
  } else if (userTheme === "system") {
    theme = "system";
  }

  return { logo, primaryColor, theme };
}
