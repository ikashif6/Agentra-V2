export type WorkspaceTheme = "light" | "dark" | "system";

export type WorkspaceBranding = {
  logo: string | null;
  logoDark: string | null;
  favicon: string | null;
  browserTitle: string | null;
  tagline: string | null;
  logoWidth: number;
  logoHeight: number;
  primaryColor: string;
  theme: WorkspaceTheme;
};

export const DEFAULT_PRIMARY_COLOR = "#D85A30";
export const DEFAULT_LOGO_WIDTH = 148;
export const DEFAULT_LOGO_HEIGHT = 28;

const BRANDING_CACHE_KEY = "agentra_workspace_branding_v2";
const FAVICON_LINK_ID = "agentra-workspace-favicon";

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

function clampLogoSize(n: number | undefined, min: number, max: number, fallback: number) {
  const value = Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeWorkspaceBranding(
  branding: Partial<WorkspaceBranding> | null | undefined,
): WorkspaceBranding {
  return {
    logo: branding?.logo ?? null,
    logoDark: branding?.logoDark ?? null,
    favicon: branding?.favicon ?? null,
    browserTitle: branding?.browserTitle?.trim() || null,
    tagline: branding?.tagline?.trim() || null,
    logoWidth: clampLogoSize(branding?.logoWidth, 24, 280, DEFAULT_LOGO_WIDTH),
    logoHeight: clampLogoSize(branding?.logoHeight, 16, 120, DEFAULT_LOGO_HEIGHT),
    primaryColor: normalizeHex(branding?.primaryColor ?? DEFAULT_PRIMARY_COLOR),
    theme: branding?.theme === "dark" || branding?.theme === "system" ? branding.theme : "light",
  };
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

export function generateBrandCssVars(hex: string, appearance: "light" | "dark" = "light") {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const base = rgbToHsl(rgb);
  const isDark = appearance === "dark";

  const hover: Hsl = isDark
    ? {
        h: base.h,
        s: Math.min(base.s + 6, 100),
        l: Math.min(base.l + 10, 68),
      }
    : {
        h: base.h,
        s: Math.min(base.s + 8, 100),
        l: Math.min(base.l + 16, 78),
      };

  const muted: Hsl = isDark
    ? {
        h: base.h,
        s: Math.max(base.s - 30, 16),
        l: 14,
      }
    : {
        h: base.h,
        s: Math.max(base.s - 18, 20),
        l: Math.min(base.l + 40, 96),
      };

  const mutedForeground: Hsl = isDark
    ? {
        h: base.h,
        s: Math.max(base.s - 12, 28),
        l: Math.min(Math.max(base.l + 18, 68), 78),
      }
    : {
        h: base.h,
        s: Math.max(base.s - 8, 25),
        l: Math.max(base.l - 12, 22),
      };

  const brand = hslString({
    h: base.h,
    s: base.s,
    l: isDark ? Math.min(Math.max(base.l + 4, 48), 60) : base.l,
  });

  const vars: Record<string, string> = {
    "--brand": brand,
    "--primary": brand,
    "--ring": brand,
    "--brand-hover": hslString(hover),
    "--primary-hover": hslString(hover),
    "--brand-muted": hslString(muted),
    "--brand-muted-foreground": hslString(mutedForeground),
  };

  // Light: soft brand washes for accent surfaces.
  // Dark: leave accent/sidebar-accent to .dark CSS so charcoal neutrals stay Lovable-like.
  if (!isDark) {
    vars["--accent"] = hslString(muted);
    vars["--accent-foreground"] = hslString(mutedForeground);
    vars["--sidebar-accent"] = hslString(muted);
    vars["--sidebar-accent-foreground"] = hslString(mutedForeground);
  }

  return vars;
}

export function resolveWorkspaceTheme(theme: WorkspaceTheme): "light" | "dark" {
  // Default appearance is always light. "system" no longer follows the OS dark setting.
  // Users can still choose dark explicitly in settings.
  if (theme === "dark") return "dark";
  return "light";
}

/** Logo to show for the currently resolved light/dark appearance. */
export function resolveWorkspaceLogoSrc(
  branding: Pick<WorkspaceBranding, "logo" | "logoDark" | "theme"> | null | undefined,
  appearance?: "light" | "dark",
): string | null {
  if (!branding) return null;
  const mode = appearance ?? resolveWorkspaceTheme(branding.theme);
  if (mode === "dark" && branding.logoDark) return branding.logoDark;
  return branding.logo ?? branding.logoDark ?? null;
}

export function cacheWorkspaceBranding(branding: WorkspaceBranding) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(normalizeWorkspaceBranding(branding)));
}

export function readCachedWorkspaceBranding(): WorkspaceBranding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? normalizeWorkspaceBranding(JSON.parse(raw) as WorkspaceBranding) : null;
  } catch {
    return null;
  }
}

function inferFaviconType(url: string) {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}

function applyWorkspaceFavicon(favicon: string | null | undefined) {
  if (typeof document === "undefined") return;

  let link = document.getElementById(FAVICON_LINK_ID) as HTMLLinkElement | null;

  if (!favicon) {
    link?.remove();
    return;
  }

  const type = inferFaviconType(favicon);
  const bust = favicon.includes("?") ? "&" : "?";
  const href = `${favicon}${bust}v=${encodeURIComponent(favicon.slice(-24))}`;

  if (!link) {
    link = document.createElement("link");
    link.id = FAVICON_LINK_ID;
    link.rel = "icon";
    document.head.appendChild(link);
  }

  if (type) link.type = type;
  else link.removeAttribute("type");
  link.sizes = "any";
  link.href = href;

  // Point every icon link at the workspace favicon (do not remove nodes —
  // removing framework-owned links breaks client navigation).
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((el) => {
    const node = el as HTMLLinkElement;
    if (node.href !== link!.href) node.href = link!.href;
    if (type) node.type = type;
  });
}

function applyWorkspaceDocumentMeta(branding: WorkspaceBranding) {
  if (typeof document === "undefined") return;

  // Tab title is owned by the app shell (route-aware). Only keep description here.
  const description = branding.tagline?.trim();
  if (description) {
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }
}

/** Build a white-label browser tab title from the current route + branding. */
export function resolveWorkspaceDocumentTitle(options: {
  pathname: string;
  settingsItem?: string | null;
  browserTitle?: string | null;
  tagline?: string | null;
  companyName?: string | null;
  pageLabel?: string | null;
}): string {
  const brand =
    options.browserTitle?.trim() ||
    options.companyName?.trim() ||
    "Workspace";
  const tagline = options.tagline?.trim() || "";
  const path = options.pathname || "/";

  const isHome = path === "/" || path === "/dashboard";
  if (isHome) {
    return tagline ? `${brand} | ${tagline}` : brand;
  }

  if (path.startsWith("/settings")) {
    // Lazy import avoided — caller passes section label via pageLabel when known.
    const section = options.pageLabel?.trim() || "Settings";
    return `${section} | ${brand}`;
  }

  const page = options.pageLabel?.trim();
  if (page) return `${page} | ${brand}`;
  return tagline ? `${brand} | ${tagline}` : brand;
}

export function applyWorkspaceBranding(branding: Partial<WorkspaceBranding>) {
  if (typeof document === "undefined") return;

  const normalized = normalizeWorkspaceBranding(branding);
  const root = document.documentElement;
  const resolved = resolveWorkspaceTheme(normalized.theme);

  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;

  const vars = generateBrandCssVars(normalized.primaryColor, resolved);
  if (vars) {
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  // Drop light-mode accent washes so .dark charcoal tokens can apply cleanly.
  // When returning to light, brand washes are written above via generateBrandCssVars.
  if (resolved === "dark") {
    [
      "--accent",
      "--accent-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
    ].forEach((key) => root.style.removeProperty(key));
  }

  applyWorkspaceFavicon(normalized.favicon);
  applyWorkspaceDocumentMeta(normalized);
}

export async function resizeLogoFile(file: File, maxWidth = 320, maxHeight = 96): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
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
    return file;
  }
}

export const THEME_OPTIONS: { id: WorkspaceTheme; label: string; description: string }[] = [
  { id: "light", label: "Light", description: "Bright workspace with white surfaces." },
  { id: "dark", label: "Dark", description: "Dim workspace for low-light environments." },
  {
    id: "system",
    label: "System",
    description: "Uses light by default (OS dark mode is ignored).",
  },
];

type ThemeUser = { preferences?: { theme?: WorkspaceTheme } } | null;
type ThemeCompany = {
  logo?: string | null;
  name?: string;
  branding?: {
    primaryColor?: string;
    theme?: WorkspaceTheme;
    favicon?: string | null;
    logoDark?: string | null;
    browserTitle?: string | null;
    tagline?: string | null;
    logoWidth?: number;
    logoHeight?: number;
  };
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

  return normalizeWorkspaceBranding({
    logo,
    logoDark: company?.branding?.logoDark ?? null,
    favicon: company?.branding?.favicon ?? null,
    browserTitle: company?.branding?.browserTitle || company?.name || null,
    tagline: company?.branding?.tagline ?? null,
    logoWidth: company?.branding?.logoWidth,
    logoHeight: company?.branding?.logoHeight,
    primaryColor,
    theme,
  });
}
