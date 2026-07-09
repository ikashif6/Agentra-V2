import { LEGAL } from "@/lib/legal";
import { LegalList, LegalSection, LegalSubsection } from "./legal-document-layout";

export function TermsOfServiceContent() {
  return (
    <>
      <LegalSection id="agreement" title="1. Agreement to these Terms">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the{" "}
          {LEGAL.productName} platform and related services (the &quot;Service&quot;) operated by{" "}
          {LEGAL.companyName} (&quot;{LEGAL.companyName}&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;).
        </p>
        <p>
          The Service is available at <a href={LEGAL.portal}>{LEGAL.portal}</a> (workspace login and
          portal), per-workspace URLs such as{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-sm text-zinc-200">
            yourcompany.agentraa.com
          </code>
          , public help centers (including{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-sm text-zinc-200">
            help.yourcompany.agentraa.com
          </code>{" "}
          or verified custom domains), ticket tracking pages, and our API at{" "}
          <a href={LEGAL.api}>{LEGAL.api}</a>.
        </p>
        <p>
          By creating an account, clicking &quot;I agree&quot;, connecting an integration, or using
          the Service, you agree to these Terms and our{" "}
          <a href={`${LEGAL.portal}/privacy`} className="text-[#D85A30] hover:underline">
            Privacy Policy
          </a>
          . If you are accepting on behalf of an organization, you represent that you have authority
          to bind that organization. If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection id="description" title="2. Description of the Service">
        <p>
          {LEGAL.productName} is a cloud-based customer support and operations platform for
          businesses. Depending on your plan and configuration, the Service may include:
        </p>
        <LegalList
          items={[
            "Unified inbox for tickets and conversations across multiple channels",
            "Team collaboration with roles (owner, admin, agent, customer), departments, and teams",
            "Email channel support via connected mailboxes (IMAP/SMTP and related outbound delivery)",
            "Facebook Messenger, Instagram Direct Messages, and WhatsApp Business messaging integrations",
            "Live chat and AI Agent workflows for real-time customer conversations",
            "TikTok and additional channel integrations as they become available in the Service",
            "E-commerce store connections (Shopify, WooCommerce, and custom storefront APIs) with order, customer, and fulfillment visibility",
            "Order actions from the inbox (such as refunds, fulfillment requests, invoice sending, and order updates) where supported by the connected store",
            "Public help centers with contact forms, knowledge content, and branding",
            "Customer ticket tracking with email verification",
            "Workspace customization (logo, colors, theme, business hours)",
            "Activity and audit logs for administrative visibility",
            "Analytics, notifications, and billing management",
          ]}
        />
        <p>
          We may add, modify, or discontinue features at any time. Beta or preview features may be
          offered &quot;as is&quot; and may be changed or withdrawn without notice.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Accounts, workspaces, and eligibility">
        <LegalSubsection title="3.1 Registration">
          <p>
            To use most features, you must create a workspace and provide accurate registration
            information (such as company name, subdomain, and administrator email). You must keep
            your account information current.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.2 Subdomains and URLs">
          <p>
            Each workspace receives a unique subdomain (for example{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-sm text-zinc-200">
              acme.agentraa.com
            </code>
            ). Subdomains must comply with our naming rules and may not impersonate others or
            infringe trademarks. We reserve reserved names (such as api, portal, help, admin) and may
            reclaim subdomains that violate these Terms.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.3 Authentication">
          <p>
            You may sign in using a password, magic link, one-time passcode (OTP), or other methods
            we support. You are responsible for safeguarding credentials and for all activity under
            your account. Notify us immediately at{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
              {LEGAL.supportEmail}
            </a>{" "}
            if you suspect unauthorized access.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.4 Eligibility">
          <p>
            You must be at least 18 years old (or the age of majority in your jurisdiction) and able
            to form a binding contract. The Service is intended for business use. Use by minors is
            not permitted except where a parent or guardian provides verifiable consent as required
            by law.
          </p>
        </LegalSubsection>
        <LegalSubsection title="3.5 Invitations and team members">
          <p>
            Workspace owners and administrators may invite users and assign roles. You are
            responsible for invitations you send and for configuring appropriate permissions within
            your organization.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="customer-data" title="4. Customer data and privacy">
        <LegalSubsection title="4.1 Your responsibilities">
          <p>
            If you use {LEGAL.productName} to process personal information about your customers,
            employees, or other individuals (&quot;Customer Data&quot;), you are responsible for:
          </p>
          <LegalList
            items={[
              "Providing any required privacy notices to those individuals",
              "Obtaining all necessary consents and permissions",
              "Ensuring your collection and use of Customer Data complies with applicable laws",
              "Responding to data subject requests from your customers where you are the controller",
              "Configuring retention, access, and security appropriate to your business",
            ]}
          />
        </LegalSubsection>
        <LegalSubsection title="4.2 Our role as processor">
          <p>
            When we process Customer Data on your behalf, we do so according to your instructions as
            reflected in your use of the Service and these Terms. We will not access Customer Data
            except to provide the Service, troubleshoot issues, comply with law, or as otherwise
            permitted by these Terms and our Privacy Policy.
          </p>
        </LegalSubsection>
        <LegalSubsection title="4.3 Prohibited data">
          <p>
            You may not use the Service to store or transmit protected health information subject to
            HIPAA, payment card data outside of PCI-compliant flows provided by integrated payment
            processors, or other categories of sensitive data unless we have agreed in writing to
            support such use.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="acceptable-use" title="5. Acceptable use">
        <p>You agree not to, and not to permit others to:</p>
        <LegalList
          items={[
            "Violate any applicable law, regulation, or third-party rights",
            "Send spam, unsolicited bulk messages, or deceptive communications",
            "Harass, threaten, defame, or abuse others",
            "Upload malware, viruses, or harmful code",
            "Attempt to gain unauthorized access to the Service, other accounts, or connected systems",
            "Reverse engineer, decompile, or attempt to extract source code except where permitted by law",
            "Scrape, crawl, or overload the Service in a manner that interferes with others",
            "Resell or sublicense the Service without our written permission",
            "Use the Service for illegal surveillance, discrimination, or fraud",
            "Misrepresent your identity or affiliation",
            "Circumvent rate limits, security controls, or integration restrictions imposed by us or third-party platforms",
            "Use connected messaging channels in violation of platform policies (including Meta, WhatsApp, TikTok, Shopify, and email provider rules)",
          ]}
        />
        <p>
          We may investigate violations and suspend or terminate access without refund where
          appropriate.
        </p>
      </LegalSection>

      <LegalSection id="integrations" title="6. Third-party integrations and platforms">
        <p>
          The Service connects to third-party platforms including Meta (Facebook, Instagram,
          WhatsApp), Shopify, WooCommerce, email providers, TikTok, and others. Your use of those
          integrations is also subject to the third party&apos;s terms and policies.
        </p>
        <LegalSubsection title="6.1 Authorization">
          <p>
            By connecting an integration, you authorize {LEGAL.companyName} to access and process
            data from that platform as needed to provide the Service, including sending and
            receiving messages, syncing orders, and performing actions you initiate (such as
            refunds or fulfillment updates).
          </p>
        </LegalSubsection>
        <LegalSubsection title="6.2 Platform changes">
          <p>
            Third-party APIs change frequently. We are not responsible for outages, policy changes,
            account suspensions, or feature removals imposed by external platforms. Messaging
            windows, reply limits, and regional availability (for example TikTok Business Messaging
            restrictions in certain countries) are governed by the platform, not {LEGAL.companyName}.
          </p>
        </LegalSubsection>
        <LegalSubsection title="6.3 Store and order actions">
          <p>
            Actions performed on connected stores (refunds, order edits, customer updates,
            fulfillment holds, and similar operations) are executed at your direction. You are
            solely responsible for the commercial, legal, and customer-service consequences of
            those actions.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="billing" title="7. Subscriptions, trials, and billing">
        <LegalSubsection title="7.1 Plans">
          <p>
            {LEGAL.productName} is offered on subscription plans (such as Pro) with features and
            limits described at signup or in your workspace billing settings. Plan details, pricing,
            and included features may change; we will provide notice where required before changes
            apply to your subscription.
          </p>
        </LegalSubsection>
        <LegalSubsection title="7.2 Trials">
          <p>
            We may offer free trials. At the end of a trial, continued use may require payment. We
            may modify or end trials at any time.
          </p>
        </LegalSubsection>
        <LegalSubsection title="7.3 Payment">
          <p>
            Paid subscriptions are billed in advance on a recurring basis (monthly or yearly, as
            selected). You authorize us and our payment processor to charge your payment method for
            applicable fees, taxes, and overages. Fees are non-refundable except where required by
            law or expressly stated by us.
          </p>
        </LegalSubsection>
        <LegalSubsection title="7.4 Cancellation">
          <p>
            You may cancel your subscription according to in-product billing controls or by
            contacting{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
              {LEGAL.supportEmail}
            </a>
            . Cancellation stops future charges but generally does not entitle you to a refund for
            the current billing period unless stated otherwise. Access may continue until the end
            of the paid period.
          </p>
        </LegalSubsection>
        <LegalSubsection title="7.5 Failed payments">
          <p>
            If payment fails, we may suspend or limit access until the account is brought current.
            We are not liable for loss of data or service interruption resulting from non-payment.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="intellectual-property" title="8. Intellectual property">
        <LegalSubsection title="8.1 Our rights">
          <p>
            The Service, including software, design, logos, documentation, and all related
            intellectual property, is owned by {LEGAL.companyName} or its licensors and is
            protected by copyright, trademark, and other laws. These Terms do not grant you any
            rights to our trademarks or brand features except as needed to use the Service in
            accordance with these Terms.
          </p>
        </LegalSubsection>
        <LegalSubsection title="8.2 Your content">
          <p>
            You retain ownership of content you submit to the Service (&quot;Your Content&quot;),
            including messages, tickets, help center articles, and branding assets. You grant us a
            worldwide, non-exclusive license to host, store, reproduce, process, display, and
            transmit Your Content solely to provide, maintain, and improve the Service and as
            otherwise permitted by these Terms.
          </p>
        </LegalSubsection>
        <LegalSubsection title="8.3 Feedback">
          <p>
            If you provide suggestions or feedback, you grant us a perpetual, irrevocable,
            royalty-free license to use it without obligation to you.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="confidentiality" title="9. Confidentiality">
        <p>
          Each party may receive non-public information from the other. The receiving party will use
          reasonable care to protect confidential information and use it only for purposes related
          to the Service. This does not apply to information that is publicly available, already
          known, independently developed, or rightfully received from a third party without
          restriction.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="10. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
          ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
        </p>
        <p>Without limiting the foregoing, we do not warrant that:</p>
        <LegalList
          items={[
            "The Service will be uninterrupted, secure, or error-free",
            "Messages will be delivered by third-party platforms without delay or failure",
            "AI-generated suggestions or automations will be accurate or appropriate for every situation",
            "Integrated store data will always be complete or up to date",
            "The Service will meet all regulatory requirements for your specific industry without additional configuration",
          ]}
        />
        <p>
          You use AI features, automations, and order actions at your own discretion and remain
          responsible for reviewing outbound communications and commerce actions before they are
          sent or executed.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="11. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL.companyName.toUpperCase()} AND ITS
          AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS
          OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING FROM OR RELATED TO
          THESE TERMS OR THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF
          OR RELATING TO THE SERVICE OR THESE TERMS IN ANY TWELVE (12) MONTH PERIOD WILL NOT EXCEED
          THE GREATER OF (A) THE AMOUNTS YOU PAID TO US FOR THE SERVICE IN THAT PERIOD OR (B) ONE
          HUNDRED U.S. DOLLARS (USD $100).
        </p>
        <p>
          Some jurisdictions do not allow certain limitations, so some of the above may not apply to
          you.
        </p>
      </LegalSection>

      <LegalSection id="indemnification" title="12. Indemnification">
        <p>
          You will defend, indemnify, and hold harmless {LEGAL.companyName} and its affiliates,
          officers, directors, employees, and agents from and against any claims, damages, losses,
          liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from
          or related to:
        </p>
        <LegalList
          items={[
            "Your use of the Service",
            "Your Content or Customer Data",
            "Your violation of these Terms or applicable law",
            "Your connected integrations or actions taken through them (including store refunds and messaging)",
            "Disputes between you and your customers or end users",
          ]}
        />
      </LegalSection>

      <LegalSection id="suspension" title="13. Suspension and termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate your access
          immediately if you breach these Terms, create risk or legal exposure for us, fail to pay
          fees, or if we discontinue the Service.
        </p>
        <p>
          Upon termination, your right to access the Service ends. We may delete workspace data
          after a reasonable retention period unless law requires otherwise. Sections that by their
          nature should survive (including payment obligations, intellectual property, disclaimers,
          limitation of liability, and indemnification) will survive termination.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="14. Changes to these Terms">
        <p>
          We may modify these Terms from time to time. We will post the updated Terms on this page
          and update the effective date. Material changes will be communicated through the Service
          or by email where appropriate. Continued use after changes take effect constitutes
          acceptance. If you do not agree to modified Terms, you must stop using the Service.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="15. Governing law and disputes">
        <p>
          These Terms are governed by the laws applicable to {LEGAL.companyName}&apos;s place of
          business, without regard to conflict of law principles, except where mandatory consumer
          protection laws in your country of residence provide otherwise.
        </p>
        <p>
          Before filing a formal legal claim, you agree to contact us at{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.supportEmail}
          </a>{" "}
          and attempt to resolve the dispute informally. If we cannot resolve a dispute within sixty
          (60) days, either party may pursue remedies in the courts or forums with competent
          jurisdiction, subject to applicable law.
        </p>
      </LegalSection>

      <LegalSection id="miscellaneous" title="16. Miscellaneous">
        <LegalList
          items={[
            "Entire agreement: These Terms and the Privacy Policy constitute the entire agreement regarding the Service and supersede prior agreements on the same subject.",
            "Severability: If any provision is unenforceable, the remaining provisions remain in effect.",
            "No waiver: Failure to enforce a provision is not a waiver of our right to do so later.",
            "Assignment: You may not assign these Terms without our consent. We may assign them in connection with a merger, acquisition, or sale of assets.",
            "Force majeure: We are not liable for delays or failures caused by events beyond our reasonable control.",
            "Export compliance: You agree to comply with applicable export control and sanctions laws.",
          ]}
        />
      </LegalSection>

      <LegalSection id="contact" title="17. Contact">
        <p>
          For questions about these Terms, contact:
        </p>
        <p>
          <strong className="text-white">{LEGAL.companyName}</strong>
          <br />
          Email:{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.supportEmail}
          </a>
          <br />
          Web:{" "}
          <a href={LEGAL.portal} className="text-[#D85A30] hover:underline">
            {LEGAL.portal}
          </a>
        </p>
      </LegalSection>
    </>
  );
}
