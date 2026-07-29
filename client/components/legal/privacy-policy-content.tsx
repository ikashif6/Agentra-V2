import { LEGAL } from "@/lib/legal";
import { LegalList, LegalSection, LegalSubsection } from "./legal-document-layout";

export function PrivacyPolicyContent() {
  return (
    <>
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          This Privacy Policy explains how {LEGAL.companyName} (&quot;{LEGAL.companyName}&quot;,
          &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, discloses, and protects
          information when you use the {LEGAL.productName} platform — including our web application
          at <a href={LEGAL.portal}>{LEGAL.portal}</a>, workspace subdomains such as{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">
            yourcompany.agentraa.com
          </code>
          , public help centers, ticket tracking pages, APIs, and related services (collectively, the
          &quot;Service&quot;).
        </p>
        <p>
          {LEGAL.productName} is a multi-channel customer support and commerce operations platform.
          Businesses use it to manage conversations, tickets, orders, teams, and customer
          interactions across email, messaging apps, live chat, and connected storefronts.
        </p>
        <p>
          By creating an account, accepting an invitation, connecting a channel or store, submitting
          a support request, or otherwise using the Service, you acknowledge that you have read this
          Privacy Policy. If you do not agree, please do not use the Service.
        </p>
      </LegalSection>

      <LegalSection id="roles" title="2. Our role and your role">
        <p>
          Depending on how you interact with {LEGAL.productName}, we may process personal
          information as a <strong className="text-gray-900">data controller</strong> (for example,
          when you sign up for a workspace, pay for a subscription, or contact us for support) or as
          a <strong className="text-gray-900">data processor</strong> on behalf of our business
          customers (for example, when end-customers message a company through Facebook Messenger,
          Instagram, WhatsApp, email, or a help center hosted on {LEGAL.productName}).
        </p>
        <LegalSubsection title="Business customers (workspaces)">
          <p>
            If you are an employee, contractor, or administrator of a company that uses{" "}
            {LEGAL.productName}, your organization is generally responsible for the personal
            information of its customers and visitors that flows through the Service. Your
            organization&apos;s privacy practices may also apply. Contact your workspace
            administrator or the business you are interacting with for questions about how they
            handle your data.
          </p>
        </LegalSubsection>
        <LegalSubsection title="End customers and visitors">
          <p>
            If you contact a business through their {LEGAL.productName} help center, ticket portal,
            live chat, email channel, or connected messaging account, we process your information to
            deliver messages and support requests to that business. The business decides how to use
            and retain that information.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="information-we-collect" title="3. Information we collect">
        <LegalSubsection title="3.1 Account and profile information">
          <p>When you register, accept an invite, or manage your profile, we may collect:</p>
          <LegalList
            items={[
              "First and last name",
              "Email address",
              "Phone number (optional)",
              "Job title and short bio (optional)",
              "Profile avatar",
              "Workspace role (owner, admin, agent, or customer)",
              "Department and team assignments",
              "Password or authentication credentials (passwords are stored using one-way hashing; we do not store plaintext passwords)",
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="3.2 Workspace and company information">
          <p>Workspace administrators may provide or generate:</p>
          <LegalList
            items={[
              "Company or brand name and subdomain",
              "Logo, brand colors, and theme preferences",
              "Industry, company size, website, phone, timezone, locale, and currency",
              "Business address (street, city, state, postal code, country)",
              "Business hours and custom schedules",
              "Notification and support email addresses",
              "Onboarding questionnaire answers (team goals, channels, ticket volume, e-commerce platform, AI interest)",
              "Usage metrics such as user counts, ticket counts, and storage used",
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="3.3 Support tickets, messages, and attachments">
          <p>
            The core of the Service is conversation and ticket management. We process content you
            or your customers submit, including:
          </p>
          <LegalList
            items={[
              "Ticket titles, descriptions, statuses, priorities, tags, and internal notes",
              "Message bodies (plain text and HTML email content)",
              "File attachments (for example images, documents, and other files uploaded to tickets or messages, subject to upload size limits configured in the Service)",
              "Participant lists (customers, agents, and copied recipients on a ticket)",
              "Assignment to departments and teams",
              "Snooze, folder, and read/unread state",
              "Channel-specific metadata required to route replies (for example Facebook Page-scoped IDs, Instagram-scoped IDs, WhatsApp IDs, email Message-IDs and threading headers)",
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="3.4 Connected channels and integrations">
          <p>
            When a workspace connects third-party channels or stores, we receive and store
            information necessary to operate those integrations. This may include:
          </p>
          <LegalList
            items={[
              "Email: connected mailbox address, display name, IMAP/SMTP settings, and encrypted mailbox credentials or OAuth tokens; inbound and outbound email content and headers",
              "Facebook Messenger: connected Page ID and name, Page profile image, and encrypted access tokens; Messenger user identifiers and message content",
              "Instagram Direct: Instagram business account ID and username, linked Facebook Page details, encrypted access tokens, and DM content",
              "WhatsApp Business (Meta Cloud API): WhatsApp Business Account ID, phone number ID, display phone number, verified business name, encrypted access tokens, and message content",
              "Live chat and AI Agent conversations: chat session content routed through the Service",
              "TikTok and other channels: where enabled, account identifiers, tokens, and message content required for the integration",
              "Shopify: shop domain, shop name, encrypted access tokens, order and customer data synced or displayed in the inbox (including order totals, line items, shipping, taxes, fulfillment status, and payment status)",
              "WooCommerce and custom storefronts: store URL, encrypted API credentials, webhook secrets, and commerce data configured for sync",
            ]}
          />
          <p>
            Sensitive credentials (such as IMAP passwords, API keys, and OAuth tokens) are encrypted
            at rest where supported by the Service. Access tokens are not exposed in routine API
            responses.
          </p>
        </LegalSubsection>

        <LegalSubsection title="3.5 Help center and public ticket tracking">
          <p>Public-facing features may collect:</p>
          <LegalList
            items={[
              "Name, email, subject, message, and priority from help center contact or ticket forms",
              "Ticket reference codes for tracking",
              "Workspace subdomain or custom help center domain used to reach the correct organization",
              "One-time passcodes (OTP) sent by email to verify access to ticket tracking sessions",
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="3.6 Billing and payment information">
          <p>
            Paid workspaces may provide billing details. Payment card data is processed by our
            payment provider (such as Stripe). We may store subscription identifiers, plan status,
            billing cycle, trial dates, invoice history, and limited payment method metadata (for
            example card brand and last four digits) — not full card numbers.
          </p>
        </LegalSubsection>

        <LegalSubsection title="3.7 Technical, security, and activity data">
          <p>We automatically collect certain technical information, including:</p>
          <LegalList
            items={[
              "IP address",
              "Browser type and user agent string",
              "Device and operating system information inferred from user agent",
              "Authentication events, session tokens, magic-link tokens, and OTP verification attempts",
              "Activity and audit log entries (event type, actor name and email, affected object, timestamps, and related metadata)",
              "API request logs, error reports, and rate-limiting data",
              "Dates of account creation, last activity, and workspace registration",
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="3.8 Cookies and similar technologies">
          <p>
            We use cookies and similar technologies to keep you signed in, remember preferences,
            protect against abuse, and operate the Service. These may include session cookies,
            refresh-token mechanisms, and security-related tokens. You can control cookies through
            your browser settings, but disabling them may limit functionality such as staying logged
            in.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="how-we-use" title="4. How we use information">
        <p>We use the information described above to:</p>
        <LegalList
          items={[
            "Provide, operate, maintain, and improve the Service",
            "Authenticate users and enforce workspace access controls (owner, admin, agent, customer roles)",
            "Route inbound messages from connected channels into unified tickets and enable agent replies",
            "Sync and display e-commerce order, customer, and fulfillment data alongside support conversations",
            "Host public help centers and ticket tracking on default or custom domains",
            "Send transactional emails (verification, magic links, OTP codes, invitations, password reset, ticket updates, and relayed replies where configured)",
            "Process subscriptions, trials, invoices, and billing support requests",
            "Monitor usage against plan limits and display workspace analytics",
            "Record audit and activity logs for security, compliance, and workspace administration",
            "Detect, prevent, and respond to fraud, abuse, security incidents, and violations of our Terms",
            "Provide customer support to workspace administrators",
            "Develop AI-assisted routing, live chat, and automation features where enabled",
            "Comply with legal obligations and enforce our agreements",
          ]}
        />
      </LegalSection>

      <LegalSection id="legal-bases" title="5. Legal bases for processing (EEA/UK users)">
        <p>
          Where applicable data protection laws require a legal basis, we rely on one or more of the
          following:
        </p>
        <LegalList
          items={[
            "Performance of a contract — to provide the Service you or your organization requested",
            "Legitimate interests — to secure the Service, prevent abuse, improve features, and support business operations, balanced against your rights",
            "Consent — where required for optional features or marketing communications",
            "Legal obligation — where we must retain or disclose information under applicable law",
          ]}
        />
      </LegalSection>

      <LegalSection id="sharing" title="6. How we share information">
        <p>We do not sell your personal information. We may share information in these situations:</p>
        <LegalSubsection title="6.1 Within a workspace">
          <p>
            Ticket content, customer messages, and internal notes are visible to authorized users in
            the workspace according to role permissions (owners and admins generally have broad
            access; agents see assigned or permitted tickets; customers see their own conversations).
          </p>
        </LegalSubsection>
        <LegalSubsection title="6.2 Service providers and subprocessors">
          <p>
            We use trusted third parties to host infrastructure and deliver the Service. Categories
            include:
          </p>
          <LegalList
            items={[
              "Cloud hosting and application infrastructure (for example Railway)",
              "Database hosting (for example MongoDB Atlas)",
              "Transactional email delivery (Resend)",
              "Payment processing (Stripe)",
              "Meta platforms for Facebook Messenger, Instagram, and WhatsApp Business integrations",
              "Shopify, WooCommerce, and other commerce platforms you connect",
              "Email mailbox providers accessed via IMAP/SMTP or OAuth when you connect email",
              "TikTok and other messaging platforms when integrations are enabled",
            ]}
          />
          <p>
            These providers process data only as needed to perform services on our behalf and are
            subject to contractual confidentiality and security obligations.
          </p>
        </LegalSubsection>
        <LegalSubsection title="6.3 At your direction">
          <p>
            When you connect a channel or store, send a reply, create a refund, update an order, or
            trigger an action in a third-party system, we share the minimum information required
            with that platform to complete the action.
          </p>
        </LegalSubsection>
        <LegalSubsection title="6.4 Legal and safety">
          <p>
            We may disclose information if we believe in good faith that disclosure is necessary to
            comply with law, regulation, legal process, or governmental request; protect the rights,
            property, or safety of {LEGAL.companyName}, our users, or the public; or investigate
            fraud or security issues.
          </p>
        </LegalSubsection>
        <LegalSubsection title="6.5 Business transfers">
          <p>
            If we are involved in a merger, acquisition, financing, reorganization, or sale of
            assets, information may be transferred as part of that transaction, subject to
            continuing protections consistent with this policy.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="international" title="7. International data transfers">
        <p>
          {LEGAL.companyName} may process and store information in countries other than where you
          live, including countries that may have different data protection laws. Where required, we
          implement appropriate safeguards for cross-border transfers, such as standard contractual
          clauses or equivalent mechanisms.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="8. Data retention">
        <p>
          We retain information only as long as needed to provide the Service, fulfill the purposes
          in this policy, meet legal and accounting requirements, resolve disputes, and enforce
          agreements. Unless a longer period is required by law, we apply the following periods:
        </p>
        <LegalList
          items={[
            "Account and workspace data: retained while the workspace is active, then deleted or anonymized within 90 days after workspace closure or a verified deletion request",
            "Tickets, live chat sessions, messages, and attachments: retained while the workspace is active; deleted with the workspace within 90 days of closure, or sooner if an authorized workspace user deletes them",
            "Synced store order snapshots used for support: retained while the store remains connected and for up to 90 days after disconnect or workspace closure",
            "Integration tokens and channel credentials: retained only while the integration remains connected, then removed promptly on disconnect",
            "Billing and tax records: retained for up to 7 years (or longer if required by applicable tax or accounting law)",
            "Security, authentication, and activity logs: retained for up to 12 months for security monitoring, abuse prevention, and investigations",
          ]}
        />
        <p>
          Backup copies may persist for up to 30 days after deletion before being overwritten.
          Workspace owners may request earlier deletion of a workspace or specific data subject to
          technical and legal limitations by contacting{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.privacyEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="security" title="9. Security">
        <p>
          We implement administrative, technical, and organizational measures designed to protect
          information, including:
        </p>
        <LegalList
          items={[
            "Encrypted transport (HTTPS/TLS) for data in transit",
            "Encryption at rest for databases and sensitive integration credentials where supported",
            "Password hashing for user passwords",
            "Role-based access controls within workspaces",
            "JWT-based authentication with refresh token rotation",
            "Rate limiting and monitoring for abusive traffic",
            "Selective exclusion of secrets from routine database queries",
          ]}
        />
        <p>
          No method of transmission or storage is completely secure. You are responsible for
          maintaining the confidentiality of your login credentials and for configuring appropriate
          access within your workspace. Our security incident response procedures are described in
          our{" "}
          <a href={`${LEGAL.portal}/incident-response`} className="text-[#D85A30] hover:underline">
            Security Incident Response Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="10. Your privacy rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, restrict,
          object to, or port certain personal information, and to withdraw consent where processing
          is consent-based. You may also have the right to lodge a complaint with a supervisory
          authority.
        </p>
        <p>
          To exercise rights relating to your {LEGAL.companyName} account or billing relationship,
          contact us at{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.privacyEmail}
          </a>
          . For data processed on behalf of a business customer, please contact that business
          directly; we will assist them as required by applicable law.
        </p>
        <p>
          We may need to verify your identity before responding. We will respond within the timeframe
          required by applicable law.
        </p>
      </LegalSection>

      <LegalSection id="children" title="11. Children's privacy">
        <p>
          The Service is not directed to children under 16 (or the minimum age required in your
          jurisdiction). We do not knowingly collect personal information from children. If you
          believe a child has provided us information, contact us and we will take appropriate
          steps to delete it.
        </p>
      </LegalSection>

      <LegalSection id="third-party-links" title="12. Third-party websites and platforms">
        <p>
          The Service links to or integrates with third-party websites and platforms (such as
          Shopify admin, Meta login flows, and customer storefronts). Their privacy practices are
          governed by their own policies. We encourage you to review those policies before
          connecting an integration or sharing information.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we
          will post the updated policy on this page and update the &quot;Last updated&quot; date.
          Continued use of the Service after changes become effective constitutes acceptance of the
          revised policy. If changes materially affect how we process personal information subject
          to certain laws, we will provide additional notice where required.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact us">
        <p>
          For privacy questions, requests, or complaints, contact:
        </p>
        <p>
          <strong className="text-gray-900">{LEGAL.companyName}</strong>
          <br />
          Email:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-[#D85A30] hover:underline">
            {LEGAL.privacyEmail}
          </a>
          <br />
          Support:{" "}
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
