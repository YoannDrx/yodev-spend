# GitHub setup

Spend uses a GitHub OAuth App for human login and a separate GitHub App for repository scanning.

## OAuth App

- Homepage: `https://spend.yodev.fr`
- Callback: `https://spend.yodev.fr/api/auth/callback/github`
- Local callback: `http://localhost:3000/api/auth/callback/github`
- Set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
- Put the numeric GitHub user IDs allowed to sign in in `AUTH_ALLOWED_GITHUB_IDS`.

## GitHub App

- Homepage: `https://spend.yodev.fr`
- Setup URL: `https://spend.yodev.fr/api/github/install/callback`
- Webhook URL: `https://spend.yodev.fr/api/github/webhooks`
- Webhook secret: a new random value stored as `GITHUB_APP_WEBHOOK_SECRET`.
- Repository permissions: **Metadata read** and **Contents read** only.
- Subscribe to installation and installation repository changes; no push event is required.
- Allow users to choose only selected repositories.

Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and the PEM private key in `GITHUB_APP_PRIVATE_KEY`. Multiline PEM values may use escaped `\n`. Never expose these as `NEXT_PUBLIC_*` variables.

Install the App through Settings, select repositories, return to Spend, assign each repository to an existing project, and import. Tokens are generated at scan time and expire without database persistence.

Use separate OAuth Apps, GitHub Apps, secrets and callbacks for local/staging and production.
