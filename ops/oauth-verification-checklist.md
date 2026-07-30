# Google & Microsoft OAuth verification checklist

**No Agentra code required today.** Complete these console steps, then store Client IDs/secrets in a password manager (and later Railway).

Verified live URLs (2026-07-31):
- Home: https://agentraa.com/ → 200
- Privacy: https://agentraa.com/privacy-policy/ → 200
- Terms: https://agentraa.com/terms-conditions/ → 200  
  (do **not** use `/terms-and-conditions/` — that 404s)

Logo file (upload to both consoles):  
`client/public/agentraa-logo.svg`  
or https://app.agentraa.com/agentraa-logo.svg

---

## Part A — Google Cloud

Open: https://console.cloud.google.com/

### A1. Project
1. Create or select project named **Agentra**.
2. Enable APIs (APIs & Services → Library):
   - **Gmail API**
   - **Google+ / People API** is not required; sign-in uses standard OAuth userinfo.

### A2. OAuth consent screen
Path: **APIs & Services → OAuth consent screen**

| Field | Value |
|--------|--------|
| User type | **External** |
| App name | `Agentra` |
| User support email | `hello@agentraa.com` |
| App logo | Agentra logo (SVG/PNG) |
| Application home page | `https://agentraa.com` |
| Application privacy policy | `https://agentraa.com/privacy-policy/` |
| Application terms of service | `https://agentraa.com/terms-conditions/` |
| Authorized domains | `agentraa.com` |
| Developer contact | `kashif@agentraa.com` |

### A3. Scopes
Add these scopes on the consent screen:

**Sign-in (non-sensitive):**
- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

**Mailbox / helpdesk (restricted — triggers verification):**
- `https://www.googleapis.com/auth/gmail.modify`  
  (read + send + labels; preferred single scope for helpdesk sync + replies)

If Google suggests splitting instead, use:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`

### A4. Test users (while status = Testing)
Add at least:
- `kashif@agentraa.com`
- `hello@agentraa.com`
- Any personal Gmail you will use for QA

### A5. OAuth client
Path: **APIs & Services → Credentials → Create credentials → OAuth client ID**

| Field | Value |
|--------|--------|
| Application type | **Web application** |
| Name | `Agentra Web` |

**Authorized JavaScript origins:**
```
https://app.agentraa.com
https://agentraa.com
http://localhost:3000
```

(Google may not accept `*.agentraa.com` wildcards — add specific subdomains later if needed, e.g. `https://shopify-review.agentraa.com`.)

**Authorized redirect URIs:**
```
https://api.agentraa.com/api/v1/auth/google/callback
https://api.agentraa.com/api/v1/channels/email/google/callback
http://localhost:5000/api/v1/auth/google/callback
http://localhost:5000/api/v1/channels/email/google/callback
```

Save **Client ID** and **Client Secret** into `ops/oauth-secrets.local.env` (gitignored).

### A6. Start verification (Gmail scopes)
1. On OAuth consent screen, click **Publish app** / prepare for verification.
2. Keep **Testing** until verification is approved if you only need internal QA; for public merchants, submit verification.
3. Justification text (paste when asked):

```
Agentra is an ecommerce helpdesk SaaS. Merchants connect their Gmail or Google Workspace support inbox so Agentra can sync inbound customer emails into tickets and send agent replies from the merchant’s own address. We only access the mailbox the merchant explicitly connects; we do not use Gmail data for advertising.
```

4. Demo notes / video script: show Settings → Email → Connect Google → inbox tickets → reply.
5. If asked for domain ownership: verify `agentraa.com` in [Google Search Console](https://search.google.com/search-console).

---

## Part B — Microsoft Entra ID

Open: https://portal.azure.com/ → **Microsoft Entra ID → App registrations → New registration**

### B1. Registration

| Field | Value |
|--------|--------|
| Name | `Agentra` |
| Supported account types | **Accounts in any organizational directory and personal Microsoft accounts** |
| Redirect URI (platform = Web) | Add all below (you can add more after create) |

**Redirect URIs:**
```
https://api.agentraa.com/api/v1/auth/microsoft/callback
https://api.agentraa.com/api/v1/channels/email/microsoft/callback
http://localhost:5000/api/v1/auth/microsoft/callback
http://localhost:5000/api/v1/channels/email/microsoft/callback
```

Copy **Application (client) ID** → `MS_CLIENT_ID`.

### B2. Client secret
**Certificates & secrets → New client secret**  
Description: `Agentra production`  
Copy the **Value** once → `MS_CLIENT_SECRET`.

### B3. API permissions (Microsoft Graph)
**API permissions → Add a permission → Microsoft Graph → Delegated**

Sign-in:
- `openid`
- `profile`
- `email`
- `User.Read`
- `offline_access`

Mailbox:
- `Mail.Read`
- `Mail.Send`

Then **Grant admin consent** for your own directory if you have M365 admin rights (optional for personal Outlook.com testing).

### B4. Branding
**Branding & properties:**
- Logo: Agentra logo
- Home page: `https://agentraa.com`
- Terms: `https://agentraa.com/terms-conditions/`
- Privacy: `https://agentraa.com/privacy-policy/`

### B5. Publisher verification (optional today, recommended)
Partner Center → publisher verification so consent UI shows a verified publisher. Not required to create the app or test with your own account.

---

## Part C — Store secrets (do not commit)

1. Copy `ops/oauth-secrets.local.env.example` → `ops/oauth-secrets.local.env`
2. Fill Client IDs/secrets from Google and Microsoft.
3. Keep that file only on your machine / password manager.
4. **Do not** put secrets in git. Paste into Railway only when we implement OAuth in code.

---

## Done when
- [ ] Google consent screen saved with correct privacy/terms URLs
- [ ] Google test users added
- [ ] Google Web client created with all redirect URIs
- [ ] Gmail scopes added; verification started (or consciously deferred while Testing)
- [ ] Microsoft app registered with redirects + Graph permissions + secret
- [ ] Values stored in `ops/oauth-secrets.local.env` or a password manager

Ping the Agentra chat with screenshots of consent scopes + redirect URIs when finished so we can confirm before coding.
