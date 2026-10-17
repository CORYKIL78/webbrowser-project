#!/usr/bin/env python3
"""Edit the unpacked Firefox source so that Glyde's settings live inside about:preferences.

Usage: patch-firefox.py <firefox source dir>

Every edit looks for an exact piece of Firefox text. If that text is not found exactly once, the script
stops with a clear message instead of guessing, so a Firefox update that moves things shows up here
and not as a broken browser. Running it twice is safe (each edit is skipped if already made).

The files changed belong to Mozilla and stay under the Mozilla Public License 2.0.
"""
import pathlib
import sys

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
ROOT = pathlib.Path(__file__).resolve().parents[2]
PREF_DIR = SRC / "browser/components/preferences"
failures = []


def edit(path, marker, old, new, label):
    """Replace `old` by `new` exactly once. `marker` is text that shows the edit was already made."""
    p = SRC / path
    if not p.exists():
        failures.append(f"{label}: {path} does not exist")
        return
    s = p.read_text(encoding="utf-8")
    if marker in s:
        print(f"already done: {label}")
        return
    n = s.count(old)
    if n != 1:
        failures.append(f"{label}: expected the anchor text once in {path}, found it {n} times")
        return
    p.write_text(s.replace(old, new), encoding="utf-8")
    print(f"patched: {label}")


# 1. The Glyde entry in the side list of about:preferences, the pane itself, and its script.
edit(
    "browser/components/preferences/preferences.xhtml",
    'id="category-glyde"',
    '      <html:moz-page-nav-button id="category-general"',
    '''      <html:moz-page-nav-button id="category-glyde"
        view="paneGlyde"
        iconsrc="chrome://browser/content/glyde/logo.svg">Glyde</html:moz-page-nav-button>
      <html:moz-page-nav-button id="category-general"''',
    "side list entry",
)
edit(
    "browser/components/preferences/preferences.xhtml",
    'id="glydePane"',
    '        <vbox id="mainPrefPane">\n',
    '''        <vbox id="mainPrefPane">
          <vbox id="glydePane" data-category="paneGlyde" hidden="true" flex="1">
            <html:iframe id="glydeFrame" title="Glyde settings"
                         style="width: 100%; height: calc(100vh - 120px); min-height: 520px; border: 0;"/>
          </vbox>
''',
    "settings pane",
)
edit(
    "browser/components/preferences/preferences.xhtml",
    "glyde-pane.js",
    '  <script src="chrome://browser/content/preferences/findInPage.js"/>\n',
    '  <script src="chrome://browser/content/preferences/findInPage.js"/>\n  <script src="chrome://browser/content/preferences/glyde-pane.js"/>\n',
    "pane script",
)

# 2. Make Glyde the first pane, and hide the Firefox account pane (Glyde uses Cirkle ID instead).
edit(
    "browser/components/preferences/preferences.js",
    'const kDefaultCategoryInternalName = "paneGlyde";',
    '''  const kDefaultCategoryInternalName = redesignEnabled
    ? "paneSync"
    : "paneGeneral";
  const kDefaultCategory = redesignEnabled ? "sync" : "general";''',
    '''  const kDefaultCategoryInternalName = "paneGlyde";
  const kDefaultCategory = "glyde";''',
    "default pane",
)
edit(
    "browser/components/preferences/preferences.js",
    'register_module("paneGlyde"',
    '  register_module("paneSearchResults", gSearchResultsPane);\n',
    '''  register_module("paneSearchResults", gSearchResultsPane);
  // Glyde: our own settings pane replaces the Firefox account and sync pane.
  register_module("paneGlyde", gGlydePane);
  document.getElementById("category-glyde").hidden = false;
  document.getElementById("category-sync").hidden = true;
''',
    "register pane",
)

# 3. Ship the pane script inside the preferences folder.
edit(
    "browser/components/preferences/jar.mn",
    "preferences/glyde-pane.js",
    "   content/browser/preferences/extensionControlled.js\n",
    "   content/browser/preferences/extensionControlled.js\n   content/browser/preferences/glyde-pane.js\n",
    "pane script in jar.mn",
)
src_js = ROOT / "browser/ui/preferences/glyde-pane.js"
if PREF_DIR.exists():
    (PREF_DIR / "glyde-pane.js").write_text(src_js.read_text(encoding="utf-8"), encoding="utf-8")
    print("copied glyde-pane.js")

# 4. Start the appearance engine and settings sync when the browser starts.
edit(
    "browser/components/BrowserGlue.sys.mjs",
    "GlydeUI.sys.mjs",
    '''  _beforeUIStartup: function BG__beforeUIStartup() {
    lazy.SessionStartup.init();
''',
    '''  _beforeUIStartup: function BG__beforeUIStartup() {
    lazy.SessionStartup.init();

    // Glyde: appearance settings and settings sync.
    try {
      ChromeUtils.importESModule("chrome://browser/content/glyde/GlydeUI.sys.mjs").GlydeUI.init();
      ChromeUtils.importESModule("chrome://browser/content/glyde/GlydeSync.sys.mjs").GlydeSync.init();
    } catch (ex) {
      console.error("Glyde could not start its settings engine", ex);
    }
''',
    "start-up hook",
)

# 5. The Glyde theme: a built-in theme next to Alpenglow, listed in the theme config and in jar.mn.
edit(
    "browser/themes/addons/jar.mn",
    "builtin-themes/glyde/manifest.json",
    "  content/builtin-themes/alpenglow/manifest.json   (alpenglow/manifest.json)\n",
    """  content/builtin-themes/alpenglow/manifest.json   (alpenglow/manifest.json)

  content/builtin-themes/glyde/manifest.json       (glyde/manifest.json)
  content/builtin-themes/glyde/icon.svg            (glyde/icon.svg)
  content/builtin-themes/glyde/preview.svg         (glyde/preview.svg)
  content/builtin-themes/glyde/background-wave.svg       (glyde/background-wave.svg)
  content/builtin-themes/glyde/background-wave-dark.svg  (glyde/background-wave-dark.svg)
""",
    "theme files in jar.mn",
)
edit(
    "browser/themes/BuiltInThemeConfig.sys.mjs",
    "glyde-theme@teamcirkle.co.uk",
    """      path: "resource://builtin-themes/alpenglow/",
    },
  ],
""",
    """      path: "resource://builtin-themes/alpenglow/",
    },
  ],
  [
    "glyde-theme@teamcirkle.co.uk",
    {
      version: "1.0.0",
      path: "resource://builtin-themes/glyde/",
    },
  ],
""",
    "theme config",
)

if failures:
    print("\nFirefox has changed since this script was written. Fix these edits:", file=sys.stderr)
    for f in failures:
        print("  - " + f, file=sys.stderr)
    sys.exit(1)
print("Firefox settings patched")
