"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadApi, workspaceApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
  DEFAULT_PRIMARY_COLOR,
  normalizeHex,
  resizeLogoFile,
  THEME_OPTIONS,
  type WorkspaceBranding,
  type WorkspaceTheme,
} from "@/lib/workspace-branding";
import { cn } from "@/lib/utils";
import { WorkspaceLogoImg } from "@/components/app/workspace-logo-img";

export default function CustomizeWorkspacePanel() {
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<WorkspaceBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await workspaceApi.getBranding();
      setBranding(data.data.branding);
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

  const persist = async (patch: Partial<WorkspaceBranding>) => {
    setSaving(true);
    try {
      const { data } = await workspaceApi.updateBranding(patch);
      const next = data.data.branding as WorkspaceBranding;
      setBranding(next);
      applyWorkspaceBranding(next);
      cacheWorkspaceBranding(next);
      await refreshUser();
    } catch (err: unknown) {
      const { message: errorMessage } = getApiError(err, "Could not save workspace appearance");
      toast.error(errorMessage);
      await load();
    } finally {
      setSaving(false);
    }
  };

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
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not upload logo");
      toast.error(message);
    } finally {
      setUploadingLogo(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Customize workspace</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Set your workspace logo, brand color, and appearance. Changes apply across the dashboard for
          everyone in this workspace.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Logo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a horizontal logo. It is automatically resized to fit the sidebar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 px-5 py-5">
          <div className="flex h-20 min-w-[180px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6">
            <WorkspaceLogoImg
              src={branding.logo}
              alt="Workspace logo preview"
              className="max-h-12 max-w-[180px] object-contain"
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
              {uploadingLogo ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ImagePlus className="mr-2 size-4" />}
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
                  setBranding((prev) => (prev ? { ...prev, primaryColor: next } : prev));
                  applyWorkspaceBranding({ ...branding, primaryColor: next });
                }}
                className="size-11 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                aria-label="Pick brand color"
              />
              <Input
                value={branding.primaryColor}
                onChange={(e) => {
                  const next = e.target.value;
                  setBranding((prev) => (prev ? { ...prev, primaryColor: next } : prev));
                }}
                onBlur={() => {
                  const next = normalizeHex(branding.primaryColor);
                  setBranding((prev) => (prev ? { ...prev, primaryColor: next } : prev));
                  void persist({ primaryColor: next });
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
            onClick={() => persist({ primaryColor: DEFAULT_PRIMARY_COLOR })}
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset to Agentra orange
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Appearance</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose light, dark, or match your system setting.
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
                  setBranding((prev) => (prev ? { ...prev, theme } : prev));
                  applyWorkspaceBranding({ ...branding, theme });
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
    </div>
  );
}
