# Agentra Cookie Consent (WordPress plugin)

Custom cookie banner + preference centre for agentraa.com.

## Install

1. Zip the `agentra-cookie-consent` folder (so the zip contains `agentra-cookie-consent/agentra-cookie-consent.php` at the top level).
2. In WordPress: **Plugins → Add New → Upload Plugin → Install → Activate**.
3. Go to **Settings → Cookie Consent** and confirm policy URLs.
4. Add a footer reopen control with shortcode:

```
[agentra_cookie_settings]
```

Or add class `agentra-cc-open-settings` to any button/link.

## What visitors see

- Bottom banner with **Accept all**, **Reject optional**, **Cookie settings**
- Preference modal for Functional / Analytics / Marketing
- Strictly necessary always on
- Floating **Cookie Settings** button after a choice is saved

## Branding

Uses Agentra coral `#D85A30`, soft coral wash, dark ink, and rounded controls to match the product/site look.

## Loading optional scripts only after consent

Listen for consent updates before injecting analytics/marketing tags:

```js
window.addEventListener('agentra:consent-updated', function (event) {
  var consent = event.detail;
  if (consent.analytics) {
    // load analytics
  }
  if (consent.marketing) {
    // load marketing pixels
  }
});
```

Current state:

```js
window.AgentraConsent.get();
```

Also sets:

- `data-agentra-analytics="1|0"`
- `data-agentra-marketing="1|0"`
- `data-agentra-functional="1|0"`

on `<html>`, and pushes `agentra_consent_update` to `dataLayer` if GTM is present.

## Consent cookie

- Name: `agentra_cookie_consent`
- Path: `/`
- SameSite: `Lax`
- Default lifetime: 180 days (editable in settings)
