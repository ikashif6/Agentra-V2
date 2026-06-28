import type { HelpCenter } from "@/lib/types";

export type Section = "contact" | "ticket" | "track" | null;

export interface PortalProps {
  hc: HelpCenter;
  subdomain: string;
}
