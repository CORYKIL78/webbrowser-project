# Glyde roadmap

Glyde is a desktop and Android browser built on Mozilla's open source Firefox code (the Gecko engine), with its own name, logo, privacy defaults and features. It is not built from scratch and it does not use Chromium.

## Ground rules

- **Fork by patches, not a rewrite.** We keep a small set of our own files (branding, settings, patches) and apply them to an official Firefox source release. This is how other Firefox based browsers stay maintainable, because Firefox changes every four weeks.
- **Own branding.** Mozilla's rules do not allow the Firefox name or logo in a fork. Glyde carries its own. The website says in words that Glyde is built on Mozilla open source technology and is not officially associated with Mozilla.
- **Licence.** Changes to Mozilla files stay under MPL 2.0. We will publish the source when the browser goes public.
- **Honest claims.** The website and policies only describe what is actually built. Planned features are marked as planned.

## What a web install can and cannot do (why this changed)

The first version was a web install (PWA). That could never run Gecko, so it stays only as a companion for iPhone and iPad, where Apple allows no other engine. Everything below is the real browser.

## Phases

### Phase 0: done
- Name (Glyde), flat symbol logo
- Web app companion in `pwa/` (kept for iOS)

### Phase 1: prove the pipeline (Linux)
Goal: one downloadable Linux build that opens, says Glyde everywhere, uses Google only, and sends no telemetry.
- Fetch an official Firefox release and verify its checksum
- Generate branding from the logo
- Privacy defaults and policies (see `browser/`)
- GitHub Actions build, package and upload
- Network audit: record every connection a fresh install makes (see `NETWORK.md`) and remove or switch off the ones we do not want

### Phase 2: Windows and macOS builds
- Windows installer, macOS app, Linux packages
- Our own update server so users get security fixes (updates are off until this exists, so Phase 2 must come before any public release)
- Code signing (needed to avoid Windows and macOS warnings; this costs money)

### Phase 3: tabs and layout
Firefox already ships vertical tabs and side by side split view (Firefox 149 added split view), so we build on those rather than reinvent them.
- Tab bar position: top, bottom, left, right
- Floating tab panel
- Split view controls and layouts
- `glyde://` internal pages (settings, new tab, history, downloads, about), with settings shown as tabs inside one settings page
- Customisation: themes, accent colour, density, animations level

### Phase 4: privacy features
- Private windows (already in Firefox) restyled and clearly labelled
- Stricter defaults, with simple switches for fingerprint resistance
- Password vault tied to Cirkle ID
- Review of every Mozilla and Google service the browser contacts

### Phase 5: Cirkle ID and encrypted sync
- Sign in with Cirkle ID
- Settings, bookmarks and passwords encrypted on the device before upload, with a key the server never holds (true end to end encryption). Firefox's own sync is not used.

### Phase 6: Szimon assistant
- Side panel that talks to the Szimon Engine
- Only sends what the person types, unless they choose "use this page"

### Phase 7: Android
- GeckoView based app, distributed as a direct download and on F-Droid (no Play Store fee needed)
- iPhone and iPad: web app only

### Phase 8: going public
- Open source release, contribution guide, security policy
- Brand and trademark policy for the Glyde name
- Public download page and release notes

## Things that need your decisions

1. **Repository visibility.** Building Firefox needs about 16 GB of memory and 40 GB of disk. GitHub's free larger runners are only for public repositories. A private repo means paying for bigger runners or using your own machine.
2. **Google only.** The brief asks for Google as the only search engine. Google sees every search. That conflicts with "complete privacy", so the privacy policy says so plainly. A single switch for other engines can be added later.
3. **Code signing and update hosting** have running costs.
4. **Who the legal operator is** (name, address, contact email) for the policies.
