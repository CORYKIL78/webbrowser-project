# Cirkle ID changes for Glyde

Glyde signs in with Cirkle ID and syncs settings through it. The existing "Continue with CirkleID"
flow only proves who someone is. It has no PKCE, and the token it returns is never saved. The patch in
this folder adds what Glyde needs. It does not change how the older Cirkle web apps sign in.

## What the patch adds

| Change | Where |
| --- | --- |
| PKCE (S256) support, passed through the login and passkey steps | `authorize`, `login`, both `verify` routes |
| Saved bearer tokens (only a SHA-256 hash is stored, 30 days) | `lib/store.ts`, `oauth/token` |
| `GET /api/oauth/userinfo` | who does this token belong to |
| `POST /api/oauth/revoke` | sign out of Glyde on the server |
| `GET / PUT / DELETE /api/sync/settings` | stores one encrypted blob per person, with a revision number so two devices cannot overwrite each other |
| Sync data is deleted when an account is deleted | `deleteUser` |

The server only ever stores ciphertext. Glyde encrypts the settings on the device with a key made from a
sync passphrase that never leaves the device.

## Applying it

From the Cirkle ID repo:

    git apply /path/to/glyde-signin.patch
    npx tsc --noEmit

It was checked with `tsc` and run against a mock of the KV store (wrong verifier, missing verifier,
good exchange, old-style code, userinfo, stale sync write, bad token). It has not been run against
real Cloudflare KV.

## Register Glyde as a client

Add this entry to the `OAUTH_CLIENTS` setting on Vercel (keep any existing entries):

    {"client_id":"glyde","name":"Glyde","redirectUris":["https://glyde.teamcirkle.co.uk/signin/done"]}

Then redeploy. The page at that address ships with the Glyde website (`site/content/signin-done.html`).
