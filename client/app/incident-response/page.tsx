import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";
import { IncidentResponseContent } from "@/components/legal/incident-response-content";
import { LEGAL, PORTAL_ORIGIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Security Incident Response Policy",
  description: `How ${LEGAL.companyName} detects, contains, remediates, and notifies merchants about security incidents affecting the ${LEGAL.productName} platform.`,
  alternates: {
    canonical: `${PORTAL_ORIGIN}/incident-response`,
  },
};

export default function IncidentResponsePage() {
  return (
    <LegalDocumentLayout
      title="Security Incident Response Policy"
      description={`Procedures ${LEGAL.companyName} follows when a security incident may affect personal information processed through ${LEGAL.productName}.`}
      alternateHref={`${PORTAL_ORIGIN}/privacy`}
      alternateLabel="Privacy Policy"
    >
      <IncidentResponseContent />
    </LegalDocumentLayout>
  );
}
