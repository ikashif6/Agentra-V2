"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadApi, workspaceApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { clearTokens } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useMainLoginUrl } from "@/hooks/use-main-login-url";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
  DEFAULT_LOGO_HEIGHT,
  DEFAULT_LOGO_WIDTH,
  DEFAULT_PRIMARY_COLOR,
  normalizeHex,
  normalizeWorkspaceBranding,
  resizeLogoFile,
  THEME_OPTIONS,
  type WorkspaceBranding,
  type WorkspaceTheme,
} from "@/lib/workspace-branding";
import { cn } from "@/lib/utils";
import { WorkspaceLogoImg } from "@/components/app/workspace-logo-img";

type CustomizeWorkspacePanelProps = {
  onUpdated?: () => void;
  /** Hide delete workspace (e.g. during onboarding setup). Default true in settings. */
  showDangerZone?: boolean;
};

export default function CustomizeWorkspacePanel({
  onUpdated,
  showDangerZone = true,
}: CustomizeWorkspacePanelProps) {
  const { applyCompanyBranding, user, company } = useAuth();
  const mainLoginUrl = useMainLoginUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkLogoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const colorPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandingRef = useRef<WorkspaceBranding | null>(null);
  const [branding, setBranding] = useState<WorkspaceBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingDarkLogo, setUploadingDarkLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [confirmSubdomain, setConfirmSubdomain] = useState("");
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await workspaceApi.getBranding();
      setBranding(normalizeWorkspaceBranding(data.data.branding));
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load workspace appearance");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (patch: Partial<WorkspaceBranding>) => {
      setSaving(true);
      try {
        const { data } = await workspaceApi.updateBranding(patch);
        const next = normalizeWorkspaceBranding(data.data.branding);
        setBranding(next);
        applyWorkspaceBranding(next);
        cacheWorkspaceBranding(next);
        applyCompanyBranding(next);
        onUpdated?.();
      } catch (err: unknown) {
        const { message: errorMessage } = getApiError(err, "Could not save workspace appearance");
        toast.error(errorMessage);
        await load();
      } finally {
        setSaving(false);
      }
    },
    [applyCompanyBranding, load, onUpdated],
  );

  const previewPrimaryColor = useCallback(
    (next: string) => {
      const base = brandingRef.current;
      if (!base) return;
      const updated = { ...base, primaryColor: next };
      setBranding(updated);
      applyWorkspaceBranding(updated);
    },
    [],
  );

  const schedulePrimaryColorPersist = useCallback(
    (next: string) => {
      if (colorPersistTimer.current) clearTimeout(colorPersistTimer.current);
      colorPersistTimer.current = setTimeout(() => {
        colorPersistTimer.current = null;
        void persist({ primaryColor: next });
      }, 250);
    },
    [persist],
  );

  const commitPrimaryColor = useCallback(
    (raw?: string) => {
      const next = normalizeHex(raw ?? brandingRef.current?.primaryColor ?? DEFAULT_PRIMARY_COLOR);
      previewPrimaryColor(next);
      if (colorPersistTimer.current) {
        clearTimeout(colorPersistTimer.current);
        colorPersistTimer.current = null;
      }
      void persist({ primaryColor: next });
    },
    [persist, previewPrimaryColor],
  );

  // Flush any pending color save when leaving the panel (Continue / other setup steps).
  useEffect(() => {
    return () => {
      if (!colorPersistTimer.current) return;
      clearTimeout(colorPersistTimer.current);
      colorPersistTimer.current = null;
      const color = brandingRef.current?.primaryColor;
      if (!color) return;
      const primaryColor = normalizeHex(color);
      void workspaceApi
        .updateBranding({ primaryColor })
        .then(({ data }) => {
          const next = normalizeWorkspaceBranding(data.data.branding);
          applyWorkspaceBranding(next);
          cacheWorkspaceBranding(next);
          applyCompanyBranding(next);
        })
        .catch(() => {
          /* best-effort flush */
        });
    };
  }, [applyCompanyBranding]);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a PNG, JPG, or SVG image");
      return;
    }

    setUploadingLogo(true);
    try {
      const resized = await resizeLogoFile(file);
      const { data } = await uploadApi.upload([resized]);
      const url = data.data.attachments?.[0]?.url as string | undefined;
      if (!url) throw new Error("Upload failed");
      await persist({ logo: url });
      toast.success("Logo updated for everyone in this workspace");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not upload logo");
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDarkLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a PNG, JPG, or SVG image");
      return;
    }

    setUploadingDarkLogo(true);
    try {
      const resized = await resizeLogoFile(file);
      const { data } = await uploadApi.upload([resized]);
      const url = data.data.attachments?.[0]?.url as string | undefined;
      if (!url) throw new Error("Upload failed");
      await persist({ logoDark: url });
      toast.success("Dark mode logo updated for everyone in this workspace");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not upload dark mode logo");
      toast.error(message);
    } finally {
      setUploadingDarkLogo(false);
    }
  };

  const handleFaviconUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a PNG, JPG, SVG, or ICO image");
      return;
    }

    setUploadingFavicon(true);
    try {
      const resized = await resizeLogoFile(file, 128, 128);
      const { data } = await uploadApi.upload([resized]);
      const url = data.data.attachments?.[0]?.url as string | undefined;
      if (!url) throw new Error("Upload failed");
      await persist({ favicon: url });
      toast.success("Favicon updated for everyone in this workspace");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not upload favicon");
      toast.error(message);
    } finally {
      setUploadingFavicon(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!branding) return null;

  const canDeleteWorkspace =
    showDangerZone && (user?.role === "owner" || user?.role === "admin");
  const expectedSubdomain = company?.subdomain || "";
  const confirmMatches =
    confirmSubdomain.trim().toLowerCase() === expectedSubdomain.trim().toLowerCase();

  const handleDeleteWorkspace = async () => {
    if (!confirmMatches || !expectedSubdomain) return;
    setDeletingWorkspace(true);
    try {
      await workspaceApi.deleteWorkspace({ confirmSubdomain: expectedSubdomain });
      clearTokens();
      toast.success("Workspace deleted");
      window.location.href = mainLoginUrl;
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not delete workspace");
      toast.error(message);
      setDeletingWorkspace(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Customize workspace</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Make this workspace feel like your brand: name in the browser tab, logos, favicon, colors,
          and theme. Changes apply for everyone on your team.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Browser identity</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The tab title adapts to where you are. For example, Home shows{" "}
            <span className="font-medium text-foreground">Title | Tagline</span>, and Workspace
            settings show <span className="font-medium text-foreground">Workspace | Title</span>.
          </p>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="browser-title">Tab title</Label>
            <Input
              id="browser-title"
              value={branding.browserTitle || ""}
              maxLength={80}
              disabled={saving}
              placeholder="Your brand name"
              onChange={(e) =>
                setBranding((prev) =>
                  prev ? { ...prev, browserTitle: e.target.value } : prev,
                )
              }
              onBlur={() =>
                void persist({
                  browserTitle: branding.browserTitle?.trim() || null,
                })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="workspace-tagline">Tagline</Label>
            <Input
              id="workspace-tagline"
              value={branding.tagline || ""}
              maxLength={160}
              disabled={saving}
              placeholder="Customer care that feels like your store"
              onChange={(e) =>
                setBranding((prev) => (prev ? { ...prev, tagline: e.target.value } : prev))
              }
              onBlur={() =>
                void persist({
                  tagline: branding.tagline?.trim() || null,
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Light logo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Used in light mode. Set width and height for the sidebar across all users.
          </p>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-20 min-w-[180px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6">
              <WorkspaceLogoImg
                src={branding.logo}
                alt="Workspace logo preview"
                className="object-contain"
                style={{
                  maxWidth: branding.logoWidth,
                  maxHeight: branding.logoHeight,
                  width: "auto",
                  height: "auto",
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingLogo || saving}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 size-4" />
                )}
                Upload logo
              </Button>
              {branding.logo ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || uploadingLogo}
                  onClick={() => persist({ logo: null })}
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo-width">Width (px)</Label>
              <Input
                id="logo-width"
                type="number"
                min={24}
                max={280}
                value={branding.logoWidth}
                disabled={saving}
                onChange={(e) => {
                  const logoWidth = Math.min(
                    280,
                    Math.max(24, Number(e.target.value) || DEFAULT_LOGO_WIDTH),
                  );
                  setBranding((prev) => (prev ? { ...prev, logoWidth } : prev));
                }}
                onBlur={() => void persist({ logoWidth: branding.logoWidth })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-height">Height (px)</Label>
              <Input
                id="logo-height"
                type="number"
                min={16}
                max={120}
                value={branding.logoHeight}
                disabled={saving}
                onChange={(e) => {
                  const logoHeight = Math.min(
                    120,
                    Math.max(16, Number(e.target.value) || DEFAULT_LOGO_HEIGHT),
                  );
                  setBranding((prev) => (prev ? { ...prev, logoHeight } : prev));
                }}
                onBlur={() => void persist({ logoHeight: branding.logoHeight })}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Dark mode logo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional logo for dark appearance. If empty, the light logo is used.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 px-5 py-5">
          <div className="flex h-20 min-w-[180px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-zinc-900 px-6">
            <WorkspaceLogoImg
              src={branding.logoDark || branding.logo}
              alt="Dark mode logo preview"
              className="object-contain"
              style={{
                maxWidth: branding.logoWidth,
                maxHeight: branding.logoHeight,
                width: "auto",
                height: "auto",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={darkLogoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleDarkLogoUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingDarkLogo || saving}
              onClick={() => darkLogoInputRef.current?.click()}
            >
              {uploadingDarkLogo ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 size-4" />
              )}
              Upload dark logo
            </Button>
            {branding.logoDark ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving || uploadingDarkLogo}
                onClick={() => persist({ logoDark: null })}
              >
                <Trash2 className="mr-2 size-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Favicon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in the browser tab and in the collapsed sidebar for everyone in this workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 px-5 py-5">
          <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20">
            {branding.favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.favicon}
                alt="Workspace favicon"
                className="size-10 rounded object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFaviconUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingFavicon || saving}
              onClick={() => faviconInputRef.current?.click()}
            >
              {uploadingFavicon ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 size-4" />
              )}
              Upload favicon
            </Button>
            {branding.favicon ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving || uploadingFavicon}
                onClick={() => persist({ favicon: null })}
              >
                <Trash2 className="mr-2 size-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Primary color</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Used for buttons, links, highlights, and hover states across the app.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="brand-color">Brand color</Label>
            <div className="flex items-center gap-3">
              <input
                id="brand-color"
                type="color"
                value={normalizeHex(branding.primaryColor)}
                onChange={(e) => {
                  const next = normalizeHex(e.target.value);
                  previewPrimaryColor(next);
                  schedulePrimaryColorPersist(next);
                }}
                onBlur={() => commitPrimaryColor()}
                className="size-11 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                aria-label="Pick brand color"
              />
              <Input
                value={branding.primaryColor}
                onChange={(e) => {
                  const next = e.target.value;
                  setBranding((prev) => (prev ? { ...prev, primaryColor: next } : prev));
                }}
                onBlur={() => commitPrimaryColor()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                className="w-32 font-mono uppercase"
                maxLength={7}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => commitPrimaryColor(DEFAULT_PRIMARY_COLOR)}
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset to default color
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Appearance</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose light or dark. Light is the default; your device dark mode is not applied
            automatically.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const selected = branding.theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={saving}
                onClick={() => {
                  const theme = option.id as WorkspaceTheme;
                  const base = brandingRef.current ?? branding;
                  const next = { ...base, theme };
                  setBranding(next);
                  applyWorkspaceBranding(next);
                  void persist({ theme });
                }}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border/80 hover:border-primary/30 hover:bg-muted/30",
                )}
              >
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {canDeleteWorkspace ? (
        <section className="overflow-hidden rounded-xl border border-destructive/30 bg-card">
          <div className="border-b border-destructive/20 px-5 py-4">
            <p className="text-sm font-medium text-destructive">Danger zone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Deleting this workspace removes all of its data. This can’t be undone.
            </p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="confirm-subdomain">
                Type <span className="font-mono font-medium text-foreground">{expectedSubdomain}</span>{" "}
                to confirm
              </Label>
              <Input
                id="confirm-subdomain"
                value={confirmSubdomain}
                autoComplete="off"
                spellCheck={false}
                disabled={deletingWorkspace}
                placeholder={expectedSubdomain}
                onChange={(e) => setConfirmSubdomain(e.target.value)}
                className="max-w-sm font-mono"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmMatches || deletingWorkspace || !expectedSubdomain}
              onClick={() => void handleDeleteWorkspace()}
            >
              {deletingWorkspace ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete workspace
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
