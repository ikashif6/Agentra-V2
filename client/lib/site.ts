import { PORTAL_ORIGIN } from "@/lib/legal";

export const SITE_LEGAL = {
  helpCenter: "https://agentraa.com/help",
  privacyPolicy: `${PORTAL_ORIGIN}/privacy`,
  termsAndConditions: `${PORTAL_ORIGIN}/terms`,
} as const;
