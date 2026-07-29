import { LEGAL } from "@/lib/legal";
import { LegalList, LegalSection, LegalSubsection } from "./legal-document-layout";

export function IncidentResponseContent() {
  return (
    <>
      <p>
        This Security Incident Response Policy describes how {LEGAL.companyName} detects, assesses,
        contains, and remediates security incidents that may affect personal information processed
        through the {LEGAL.productName} Service. It applies to our team and to systems we operate
        for the Service.
      </p>

      <LegalSection id="definition" title="1. What counts as a security incident">
        <p>
          A security incident includes unauthorized access, disclosure, alteration, destruction, or
          loss of personal information; ransomware or other malicious compromise of Service systems;
          or a confirmed breach of credentials that can access customer or merchant data.
        </p>
      </LegalSection>

      <LegalSection id="detection" title="2. Detection and reporting">
        <p>Incidents may be identified through:</p>
        <LegalList
          items={[
            "Infrastructure, application, and authentication monitoring",
            "Abuse or anomaly alerts (including unusual API or login activity)",
            "Reports from merchants, end customers, partners, or third-party providers",
            "Internal reviews, audits, or employee reports",
          ]}
        />
        <p>
          Anyone who suspects an incident should notify{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.privacyEmail}
          </a>{" "}
          immediately.
        </p>
      </LegalSection>

      <LegalSection id="response" title="3. Response process">
        <LegalSubsection title="3.1 Triage and containment">
          <p>
            We assess severity, affected systems, and likely data impact, then take reasonable steps
            to contain the incident (for example revoking credentials, isolating systems, or
            rotating secrets).
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.2 Investigation">
          <p>
            We investigate root cause, determine what personal information may have been affected,
            and preserve relevant logs for remediation and legal obligations.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.3 Remediation">
          <p>
            We remediate the vulnerability or control failure, restore affected services where
            needed, and verify that unauthorized access has been stopped.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.4 Notification">
          <p>
            Where personal information is reasonably believed to have been compromised, we notify
            affected merchants without undue delay and, where required by law, no later than{" "}
            <strong className="text-gray-900">72 hours</strong> after becoming aware of a personal
            data breach. Notifications will describe, to the extent known:
          </p>
          <LegalList
            items={[
              "The nature of the incident",
              "Categories of data that may be involved",
              "Likely consequences",
              "Measures taken or proposed to address the incident",
              "How to contact us for further information",
            ]}
          />
          <p>
            Merchants remain responsible for notifying their own end customers where they are the
            controller, unless applicable law requires us to notify individuals directly.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="access-control" title="4. Access during incidents">
        <p>
          Access to systems and personal data during an incident is limited to personnel who need it
          to investigate and remediate. We require strong authentication for staff access and review
          privileged access as part of remediation.
        </p>
      </LegalSection>

      <LegalSection id="records" title="5. Records and improvement">
        <p>
          We document material incidents, response actions, and lessons learned, and use those
          findings to improve monitoring, access controls, and retention practices.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="6. Contact">
        <p>
          Security or privacy incident reports:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.privacyEmail}
          </a>
          <br />
          General support:{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.supportEmail}
          </a>
        </p>
        <p>
          Related documents:{" "}
          <a href={`${LEGAL.portal}/privacy`} className="text-[#D85A30] hover:underline">
            Privacy Policy
          </a>{" "}
          (including data retention) and{" "}
          <a href={`${LEGAL.portal}/terms`} className="text-[#D85A30] hover:underline">
            Terms of Service
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}
