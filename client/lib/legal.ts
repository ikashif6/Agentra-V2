const BASE_DOMAIN = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? "agentraa.com";

export const PORTAL_HOST =
  process.env.NEXT_PUBLIC_APP_PORTAL_HOST ?? `portal.${BASE_DOMAIN}`;

export const PORTAL_ORIGIN = `https://${PORTAL_HOST}`;

export const LEGAL = {
  companyName: "Agentra",
  productName: "Agentra",
  website: `https://${BASE_DOMAIN}`,
  portal: PORTAL_ORIGIN,
  api: `https://api.${BASE_DOMAIN}`,
  supportEmail: "support@agentraa.com",
  privacyEmail: "privacy@agentraa.com",
  effectiveDate: "July 9, 2026",
  lastUpdated: "July 9, 2026",
} as const;
