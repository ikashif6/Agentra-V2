"use client";

import { useEffect, type ReactNode } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usersApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  INVITE_ROLE_OPTIONS,
  ROLE_DISPLAY,
  getUserManagePermissions,
  type InvitableRole,
} from "@/lib/user-roles";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().max(50).optional(),
  email: z.string().email("Valid email required"),
  jobTitle: z.string().max(100).optional(),
  role: z.enum(["agent", "admin"]).optional(),
});

type FormData = z.infer<typeof schema>;

type EditUserDialogProps = {
  user: User | null;
  actor: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onRemove?: (user: User) => void;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

export default function EditUserDialog({
  user,
  actor,
  open,
  onOpenChange,
  onSaved,
  onRemove,
}: EditUserDialogProps) {
  const perms = user && actor ? getUserManagePermissions(actor, user) : null;
  const isSelf = user && actor ? user._id === actor._id : false;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedRole = watch("role");

  useEffect(() => {
    if (!user || !open) return;
    reset({
      firstName: user.firstName ?? "",
      lastName: user.lastName === "-" ? "" : (user.lastName ?? ""),
      email: user.email,
      jobTitle: user.jobTitle ?? "",
      role: user.role === "admin" || user.role === "agent" ? user.role : undefined,
    });
  }, [user, open, reset]);

  const onSubmit = async (values: FormData) => {
    if (!user) return;

    const payload: {
      firstName: string;
      lastName: string;
      email: string;
      jobTitle?: string;
      role?: InvitableRole;
    } = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim() || "-",
      email: values.email.trim(),
      jobTitle: values.jobTitle?.trim() ?? "",
    };

    if (perms?.canChangeRole && values.role) {
      payload.role = values.role;
    }

    try {
      await usersApi.update(user._id, payload);
      toast.success("User updated");
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not update user");
      toast.error(message);
    }
  };

  const roleMeta = user ? (ROLE_DISPLAY[user.role] ?? ROLE_DISPLAY.agent) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage user</DialogTitle>
          <DialogDescription>
            Update profile, email, and workspace access for this member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-3">
            <SectionTitle>Profile</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-user-first-name">First name</Label>
                <Input id="edit-user-first-name" {...register("firstName")} autoComplete="given-name" />
                {errors.firstName ? (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-last-name">Last name</Label>
                <Input id="edit-user-last-name" {...register("lastName")} autoComplete="family-name" />
                {errors.lastName ? (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-job-title">Job title</Label>
              <Input
                id="edit-user-job-title"
                {...register("jobTitle")}
                placeholder="e.g. Support lead"
                autoComplete="organization-title"
              />
              {errors.jobTitle ? (
                <p className="text-xs text-destructive">{errors.jobTitle.message}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Email</SectionTitle>
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email address</Label>
              <Input id="edit-user-email" type="email" {...register("email")} autoComplete="email" />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Changing email will require the user to verify the new address.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Workspace access</SectionTitle>
            {perms?.canChangeRole ? (
              <div className="grid gap-2">
                {INVITE_ROLE_OPTIONS.map((option) => {
                  const selected = selectedRole === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setValue("role", option.id, { shouldValidate: true })}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/80 hover:border-primary/30 hover:bg-muted/30",
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{option.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            ) : roleMeta ? (
              <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{roleMeta.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user?.role === "owner"
                        ? "Workspace ownership cannot be changed here."
                        : isSelf
                          ? "You cannot change your own role."
                          : "You do not have permission to change this role."}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px] uppercase", roleMeta.badgeClass)}>
                    {roleMeta.label}
                  </Badge>
                </div>
              </div>
            ) : null}
          </section>

          {perms?.canDelete && onRemove && user ? (
            <section className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <SectionTitle>Remove from workspace</SectionTitle>
              <p className="text-sm text-muted-foreground">
                This user will lose access immediately. Their account will be deactivated.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onRemove(user);
                }}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Remove user
              </Button>
            </section>
          ) : isSelf ? (
            <section className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                You cannot remove your own account from here. Transfer ownership or contact support if
                you need to close this workspace.
              </p>
            </section>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
