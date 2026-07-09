import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy-content";
import { LEGAL, PORTAL_ORIGIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${LEGAL.companyName} collects, uses, and protects information when you use the ${LEGAL.productName} customer support platform.`,
  alternates: {
    canonical: `${PORTAL_ORIGIN}/privacy`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      description={`This policy describes how ${LEGAL.companyName} handles personal information across the ${LEGAL.productName} platform — including workspaces, connected channels, help centers, and commerce integrations.`}
      alternateHref={`${PORTAL_ORIGIN}/terms`}
      alternateLabel="Terms of Service"
    >
      <PrivacyPolicyContent />
    </LegalDocumentLayout>
  );
}
