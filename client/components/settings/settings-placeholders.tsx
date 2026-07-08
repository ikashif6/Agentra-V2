import { Construction } from "lucide-react";
import SettingsPanelShell from "./settings-panel-shell";

export function ChannelPlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SettingsPanelShell title={title} description={description}>
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Construction className="size-5 text-muted-foreground" />
        </div>
        <div className="max-w-sm space-y-1">
          <p className="text-sm font-medium text-foreground">Setup in progress</p>
          <p className="text-xs text-muted-foreground">
            This channel integration is on our roadmap. You&apos;ll be able to connect it from here
            when it launches.
          </p>
        </div>
      </div>
    </SettingsPanelShell>
  );
}

export function AccountPlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SettingsPanelShell title={title} description={description}>
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Construction className="size-5 text-muted-foreground" />
        </div>
        <div className="max-w-sm space-y-1">
          <p className="text-sm font-medium text-foreground">Available in a future update</p>
          <p className="text-xs text-muted-foreground">
            We&apos;re building this section. Check back soon for more workspace controls.
          </p>
        </div>
      </div>
    </SettingsPanelShell>
  );
}
