import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";
import { RefundPolicyContent } from "@/components/legal/refund-policy-content";
import { LEGAL, PORTAL_ORIGIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `Refund and cancellation terms for ${LEGAL.productName} subscriptions operated by ${LEGAL.companyName}.`,
  alternates: {
    canonical: `${PORTAL_ORIGIN}/refund`,
  },
};

export default function RefundPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Refund Policy"
      description={`How cancellations and refunds work for ${LEGAL.productName} paid subscriptions. Payments are processed by Paddle as Merchant of Record.`}
      alternateHref={`${PORTAL_ORIGIN}/terms`}
      alternateLabel="Terms of Service"
    >
      <RefundPolicyContent />
    </LegalDocumentLayout>
  );
}
