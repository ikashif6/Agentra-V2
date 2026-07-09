import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";
import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";
import { LEGAL, PORTAL_ORIGIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of the ${LEGAL.productName} customer support, messaging, and commerce platform operated by ${LEGAL.companyName}.`,
  alternates: {
    canonical: `${PORTAL_ORIGIN}/terms`,
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      description={`These Terms govern access to and use of ${LEGAL.productName}, including multi-channel inbox, integrations, help centers, AI Agent features, and connected storefronts.`}
      alternateHref={`${PORTAL_ORIGIN}/privacy`}
      alternateLabel="Privacy Policy"
    >
      <TermsOfServiceContent />
    </LegalDocumentLayout>
  );
}
