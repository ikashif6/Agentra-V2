import { LEGAL } from "@/lib/legal";
import { LegalSection, LegalSubsection } from "@/components/legal/legal-document-layout";

export function RefundPolicyContent() {
  return (
    <>
      <LegalSection id="overview" title="1. Overview">
        <p>
          This Refund Policy explains how refunds work for paid {LEGAL.productName}{" "}
          subscriptions. Payments for {LEGAL.productName} are processed by{" "}
          <strong>Paddle</strong> as Merchant of Record. That means Paddle handles
          checkout, invoices, taxes, and payment methods on our behalf.
        </p>
      </LegalSection>

      <LegalSection id="subscriptions" title="2. Subscriptions">
        <LegalSubsection title="2.1 Recurring billing">
          <p>
            Paid plans are billed in advance on a monthly or yearly cycle, as selected at
            checkout. Renewals continue until you cancel.
          </p>
        </LegalSubsection>
        <LegalSubsection title="2.2 Cancellation">
          <p>
            You may cancel from in-product billing settings or by contacting{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
              {LEGAL.supportEmail}
            </a>
            . Cancellation stops future charges. You generally keep access until the end of
            the current paid period.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="refunds" title="3. Refunds">
        <LegalSubsection title="3.1 Standard policy">
          <p>
            Fees already paid are <strong>non-refundable</strong>, including unused time in
            the current billing period, except where required by applicable law or expressly
            agreed by us in writing.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.2 Trials">
          <p>
            If a free trial is offered, you will not be charged until the trial ends (unless
            you subscribe earlier). Cancel before the trial ends to avoid charges.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.3 Exceptions">
          <p>We may consider a refund or credit when:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>There was a clear billing error (for example, duplicate charge)</li>
            <li>You were charged after a documented cancellation that should have stopped billing</li>
            <li>Applicable consumer law in your region requires a refund</li>
          </ul>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="how-to-request" title="4. How to request a refund">
        <p>
          Email{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.supportEmail}
          </a>{" "}
          with your workspace name, account email, and invoice or transaction details. We
          (or Paddle, where appropriate) will review and respond. Approved refunds are
          returned to the original payment method when possible.
        </p>
      </LegalSection>

      <LegalSection id="chargebacks" title="5. Chargebacks">
        <p>
          Please contact us before initiating a chargeback with your bank or card issuer. We
          will work with you and Paddle to resolve billing issues. Unfounded chargebacks may
          result in suspension of the account.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="6. Contact">
        <p>
          Questions about this policy:{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.supportEmail}
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}
