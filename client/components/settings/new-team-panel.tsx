"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UserPicker from "@/components/shared/UserPicker";
import { departmentApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { Department, User } from "@/lib/types";

const schema = z.object({
  name: z.string().min(1, "Team name is required").max(100),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

type NewTeamPanelProps = {
  onBack: () => void;
  onCreated: (teamId: string) => void;
  hideBack?: boolean;
};

async function ensureDefaultDepartment(): Promise<string> {
  const { data } = await departmentApi.list({ limit: 50 });
  const departments: Department[] = data.data.departments ?? [];
  if (departments.length > 0) return departments[0]._id;

  const created = await departmentApi.create({
    name: "General",
    description: "Default workspace group for teams",
  });
  return created.data.data.department._id;
}

export default function NewTeamPanel({ onBack, onCreated, hideBack }: NewTeamPanelProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [teamLead, setTeamLead] = useState<User | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    departmentApi
      .list({ limit: 50 })
      .then(({ data }) => {
        const list: Department[] = data.data.departments ?? [];
        setDepartments(list);
        if (list.length > 0) setDepartmentId(list[0]._id);
      })
      .catch(() => toast.error("Failed to load groups"))
      .finally(() => setLoadingDepts(false));
  }, []);

  const onSubmit = async (values: FormData) => {
    if (!teamLead) {
      toast.error("Choose a team lead");
      return;
    }

    setSubmitting(true);
    try {
      const deptId = departmentId || (await ensureDefaultDepartment());
      const { data } = await departmentApi.createTeam(deptId, {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        teamLead: teamLead._id,
      });
      toast.success("Team created");
      onCreated(data.data.team._id);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not create team");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        {!hideBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Back to teams"
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : null}
        <h2 className="text-xl font-bold text-foreground">Create team</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="team-name">
            Team name <span className="text-destructive">*</span>
          </Label>
          <Input id="team-name" placeholder="North America support" {...register("name")} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="team-description">Description</Label>
          <Textarea
            id="team-description"
            rows={3}
            placeholder="Optional note about what this team handles"
            {...register("description")}
          />
        </div>

        {departments.length > 1 ? (
          <div className="space-y-1.5">
            <Label>Group</Label>
            <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept._id} value={dept._id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Teams are organized under workspace groups for routing and reporting.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>
            Team lead <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {teamLead ? (
              <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm">
                {teamLead.firstName} {teamLead.lastName}
                <span className="ml-2 text-muted-foreground">{teamLead.email}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No lead selected</p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              {teamLead ? "Change lead" : "Choose lead"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {!hideBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting || loadingDepts}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create team
          </Button>
        </div>
      </form>

      <UserPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose team lead"
        scope="staff"
        onSelect={(user) => {
          setTeamLead(user);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
