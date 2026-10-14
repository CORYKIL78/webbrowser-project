# Glyde

A fast, fully customisable browser hub that installs from the web on Windows 10 and 11, iOS and Android. No app store, no app fee.

## What is in this first version

- Installable PWA (manifest, service worker, offline start page, icons for every platform)
- Tabs, a start page and an address and search bar
- Search through Google, Bing and DuckDuckGo, switchable at any time
- Settings for theme, accent colour, roundness, text size, background style, animation level and speed, start page layout and more
- Sign in with Cirkle ID (OAuth 2.0 authorisation code with PKCE) and settings sync through your account
- Extensions that belong to your Cirkle ID account, starting with the password vault
- Built for weak devices: no framework, no build step, about 30 KB of code, animations use only transform and opacity, and the app switches itself to a lighter motion mode on low memory, low core count or data saver devices

## Important: what a web install can and cannot do

A web install (PWA) always runs inside the engine of the browser it was installed from. That has two consequences you should plan around:

1. **The Gecko engine cannot be used.** Gecko can only ship inside a native app. On iOS, Apple forces every browser to use WebKit, and on Windows and Android a PWA uses Edge or Chrome. Glyde therefore uses the device engine, which keeps it light and fast.
2. **Big sites refuse to load inside another page.** Search engines and most major sites send headers that block embedding. By default Glyde opens pages in a normal browser tab. The setting "Try opening pages inside Glyde" shows pages in a built in pane for the sites that allow it.

If you later want a true engine of your own (Gecko, or Chromium through Electron on Windows), that is a native app, which is a separate project with a cost on mobile.

## Project layout

```
public/
  index.html            page shell
  styles.css            theme variables, layout, animations
  app.js                tabs, search, settings, Cirkle ID, sync
  config.js             search engines, Cirkle ID endpoints, extensions
  sw.js                 service worker (cache first, refresh in background)
  manifest.webmanifest  install details
  logo.svg              logo
  icons/                PNG icons (standard, Apple and maskable)
vercel.json             hosting headers
```

## Connecting Cirkle ID

Open `public/config.js` and check the `cirkleId` block against your Cirkle ID project:

| Setting | Meaning |
| --- | --- |
| `base` | Address of your Cirkle ID site |
| `clientId` | Register Glyde as a client in Cirkle ID with this id |
| `authorizePath`, `tokenPath`, `userinfoPath` | Standard OAuth routes, change them if yours differ |
| `settingsPath` | Route that stores a user's settings (GET returns JSON, PUT saves JSON) |

Cirkle ID needs three things for Glyde to work end to end:

1. A registered client for Glyde with the redirect address set to your Glyde site address (for example `https://your-glyde-domain/`).
2. PKCE support on the token route, and CORS allowed for your Glyde origin on the token, userinfo and settings routes.
3. A settings route per user, keyed by the signed in account.

Until those exist, Glyde works fully as a local browser hub and the sign in button reports a clear error.

The password vault tile opens the `url` given in `config.js` and needs a signed in account. Passwords are never stored by Glyde itself.

## Running it locally

```
npx serve public
```

Open the address it prints. Install prompts only appear on HTTPS or localhost.

## Deploying

Deploy the repository on Vercel with the output directory set to `public`. The included `vercel.json` stops the service worker from being cached for too long and adds basic security headers.

Then install it:

- **Windows 10 and 11:** open the site in Edge or Chrome, choose Install in the address bar.
- **Android:** open in Chrome, menu, Install app.
- **iOS:** open in Safari, Share, Add to Home Screen.

## Next steps

- Build the Cirkle ID routes listed above
- Add a bookmarks and history panel that syncs with the account
- Add more extensions to `config.js`
- Add a custom theme export and import
