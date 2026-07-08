"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  INVITE_ROLE_OPTIONS,
  splitFullName,
  type InvitableRole,
} from "@/lib/user-roles";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  role: z.enum(["agent", "admin"]),
});

type FormData = z.infer<typeof schema>;

type NewUserPanelProps = {
  onBack: () => void;
  onCreated: () => void;
};

export default function NewUserPanel({ onBack, onCreated }: NewUserPanelProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "agent" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (values: FormData) => {
    const { firstName, lastName } = splitFullName(values.name);
    try {
      await usersApi.invite({
        email: values.email,
        role: values.role,
        firstName,
        lastName,
      });
      toast.success(`Invitation sent to ${values.email}`);
      onCreated();
      router.replace("/settings?item=users", { scroll: false });
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not create user");
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back to users"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h2 className="text-xl font-bold text-foreground">New user</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Robin McHelpful"
            {...register("name")}
            className="focus-visible:ring-primary/30"
          />
          {errors.name ? <p className="text-xs text-red-500">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="robin@company.com"
            {...register("email")}
            className="focus-visible:ring-primary/30"
          />
          {errors.email ? <p className="text-xs text-red-500">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Role</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose what this person can access in your workspace.
            </p>
          </div>

          <div className="space-y-2">
            {INVITE_ROLE_OPTIONS.map((option) => {
              const selected = selectedRole === option.id;
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                    selected
                      ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_rgba(216,90,48,0.15)]"
                      : "border-border/80 hover:border-primary/25 hover:bg-muted/20",
                  )}
                >
                  <input
                    type="radio"
                    value={option.id}
                    checked={selected}
                    onChange={() => setValue("role", option.id as InvitableRole, { shouldValidate: true })}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          An invite email will be sent. They&apos;ll set their password when they accept the invitation.
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create user
          </Button>
        </div>
      </form>
    </div>
  );
}
