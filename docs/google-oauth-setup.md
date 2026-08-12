# Google OAuth Setup for Production

This document describes the one-time Google Cloud Console steps required so that
Google Sign-In works on the **deployed** (production) app.

---

## Production URL

```
https://tkelectric.replit.app
```

---

## Required: Add the production callback URI to Google Cloud Console

Every time the app is deployed to a new domain you must add the corresponding
callback URI to the OAuth client's **Authorized redirect URIs** list.

### Steps

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Click the **OAuth 2.0 Client ID** used by this app.
3. Under **Authorized redirect URIs**, click **Add URI** and paste:
   ```
   https://tkelectric.replit.app/api/auth/google/callback
   ```
4. Also confirm the development URI is present (for local/dev testing):
   ```
   https://<your-repl>.replit.dev/api/auth/google/callback
   ```
5. Click **Save**.

Changes propagate within a few minutes.

---

## Required: Set `GOOGLE_CALLBACK_URL` for each environment

| Environment | Value |
|-------------|-------|
| Production  | `https://tkelectric.replit.app/api/auth/google/callback` |
| Development | *(not needed — code auto-detects `REPLIT_DEV_DOMAIN`)* |

The production value has already been set as a Replit environment variable
(`GOOGLE_CALLBACK_URL`, production environment). If the production domain ever
changes (custom domain, repl rename), update both:

1. The `GOOGLE_CALLBACK_URL` production secret/env var in Replit.
2. The **Authorized redirect URIs** in Google Cloud Console.

---

## How the callback URL is resolved (`server/replit_integrations/auth/googleAuth.ts`)

```
GOOGLE_CALLBACK_URL  (explicit override — required in production)
  ↓ fallback
https://${REPLIT_DEV_DOMAIN}/api/auth/google/callback  (auto in dev)
  ↓ fallback
/api/auth/google/callback  (relative — OAuth will fail, only a last resort)
```

The production environment variable ensures the first branch is always taken
when the deployed app handles the OAuth redirect.
