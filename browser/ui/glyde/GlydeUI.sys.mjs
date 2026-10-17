/* Glyde appearance engine.
 *
 * Every setting lives in a preference called glyde.ui.<name>. The settings page calls set(), which
 * stores the value and also writes the Firefox preferences that make it happen. A style sheet built
 * from the same values is loaded into every browser window (and rebuilt whenever a value changes),
 * so changes show up straight away without a restart.
 *
 * This file is part of Glyde. Parts of Glyde change files that belong to Mozilla, which stay under
 * the Mozilla Public License 2.0 (https://mozilla.org/MPL/2.0/).
 */

const PREF = "glyde.ui.";

// The Glyde new tab page ships inside the browser. The welcome wizard is a page on the Glyde website.
export const HOME_URL = "chrome://browser/content/glyde/home.html";
export const WELCOME_URL = "https://glyde.teamcirkle.co.uk/welcome";
export const WELCOME_DONE_URL = "https://glyde.teamcirkle.co.uk/welcome/done";
const GLYDE_THEME_ID = "glyde-theme@teamcirkle.co.uk";

export const DEFAULTS = Object.freeze({
  theme: "glyde", //         glyde | system | light | dark
  accent: "#0e7c70", //      any #rrggbb colour
  roundness: 8, //           0 (square) to 20 (very round), in pixels
  interfaceScale: 100, //    80 to 150, percent
  density: "normal", //      compact | normal | roomy
  font: "system", //         system | serif | mono | rounded | humanist | custom
  fontCustom: "", //         a font name, used when font is custom
  pageFont: "system", //     system | serif | mono
  pageTextSize: 100, //      80 to 200, percent
  tabs: "top", //            top | left | right
  wallpaper: "glide-lines", // none or one of WALLPAPERS
});

export const WALLPAPERS = Object.freeze([
  "glide-lines",
  "dusk-hills",
  "soft-glow",
  "contours",
  "night-arcs",
  "paper-waves",
]);

const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Consolas, "DejaVu Sans Mono", monospace',
  rounded: '"Segoe UI Variable Display", Nunito, "Trebuchet MS", sans-serif',
  humanist: '"Segoe UI", "Gill Sans", Candara, sans-serif',
};

const THEME_IDS = {
  glyde: GLYDE_THEME_ID,
  system: "default-theme@mozilla.org",
  light: "firefox-compact-light@mozilla.org",
  dark: "firefox-compact-dark@mozilla.org",
};

// Clamp helpers keep bad values (from sync, or a hand-edited prefs file) from breaking the window.
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const asNumber = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Returns a safe, complete value for a setting, or the default if the given one is not valid. */
export function sanitise(key, value) {
  const d = DEFAULTS[key];
  switch (key) {
    case "theme":
      return ["glyde", "system", "light", "dark"].includes(value) ? value : d;
    case "accent":
      return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value).toLowerCase() : d;
    case "roundness":
      return Math.round(clamp(asNumber(value, d), 0, 20));
    case "interfaceScale":
      return Math.round(clamp(asNumber(value, d), 80, 150));
    case "pageTextSize":
      return Math.round(clamp(asNumber(value, d), 80, 200));
    case "density":
      return ["compact", "normal", "roomy"].includes(value) ? value : d;
    case "font":
      return ["system", "serif", "mono", "rounded", "humanist", "custom"].includes(value) ? value : d;
    case "fontCustom":
      // Letters, digits, spaces and a few separators only, so the value can never close a CSS string.
      return String(value ?? "").replace(/[^A-Za-z0-9 _.,-]/g, "").slice(0, 60).trim();
    case "pageFont":
      return ["system", "serif", "mono"].includes(value) ? value : d;
    case "tabs":
      return ["top", "left", "right"].includes(value) ? value : d;
    case "wallpaper":
      return value === "none" || WALLPAPERS.includes(value) ? value : d;
    default:
      return undefined;
  }
}

function darken(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(clamp(c * (1 - amount), 0, 255));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** The style sheet text for a set of values. Pure, so it can be tested without a browser. */
export function buildCss(v) {
  const r = v.roundness;
  const css = [];
  css.push(":root {");
  css.push(`  --border-radius-xsmall: ${Math.round(r * 0.25)}px !important;`);
  css.push(`  --border-radius-small: ${Math.round(r * 0.5)}px !important;`);
  css.push(`  --border-radius-medium: ${r}px !important;`);
  css.push(`  --border-radius-large: ${Math.round(r * 2)}px !important;`);
  css.push(`  --tab-border-radius: ${r}px !important;`);
  css.push(`  --toolbarbutton-border-radius: ${r}px !important;`);
  css.push(`  --urlbar-border-radius: ${r}px !important;`);
  // The accent colour always applies (the Glyde teal by default), so buttons, switches and focus rings
  // in the browser window match the Glyde theme instead of Firefox's blue and purple.
  css.push(`  --color-accent-primary: ${v.accent} !important;`);
  css.push(`  --color-accent-primary-hover: ${darken(v.accent, 0.12)} !important;`);
  css.push(`  --color-accent-primary-active: ${darken(v.accent, 0.24)} !important;`);
  css.push(`  --color-accent-primary-selected: ${v.accent} !important;`);
  css.push(`  --in-content-primary-button-background: ${v.accent} !important;`);
  css.push(`  --in-content-primary-button-background-hover: ${darken(v.accent, 0.12)} !important;`);
  css.push(`  --in-content-primary-button-background-active: ${darken(v.accent, 0.24)} !important;`);
  css.push(`  --focus-outline-color: ${v.accent} !important;`);
  css.push("}");
  let family = "";
  if (v.font === "custom" && v.fontCustom) {
    family = `"${v.fontCustom}", sans-serif`;
  } else if (FONT_STACKS[v.font]) {
    family = FONT_STACKS[v.font];
  }
  if (family) {
    css.push(`* { font-family: ${family} !important; }`);
  }
  return css.join("\n");
}

export const GlydeUI = {
  _started: false,
  _sheets: new WeakMap(), // window -> the style sheet address loaded into it
  _listeners: new Set(),

  /** Read all settings as a plain object, with defaults filled in. */
  values() {
    const out = {};
    for (const key of Object.keys(DEFAULTS)) {
      const type = typeof DEFAULTS[key];
      let raw;
      try {
        raw =
          type === "number"
            ? Services.prefs.getIntPref(PREF + key, DEFAULTS[key])
            : Services.prefs.getStringPref(PREF + key, DEFAULTS[key]);
      } catch (e) {
        raw = DEFAULTS[key];
      }
      out[key] = sanitise(key, raw);
    }
    return out;
  },

  /** Called once when the browser starts. Loads the style sheet into every window, now and later. */
  init() {
    if (this._started) {
      return;
    }
    this._started = true;
    Services.obs.addObserver(this, "browser-delayed-startup-finished");
    Services.prefs.addObserver(PREF, this);
    this._setNewTabPage();
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this.applyToWindow(win);
    }
  },

  observe(subject, topic) {
    if (topic === "browser-delayed-startup-finished") {
      this.applyToWindow(subject);
      this._onFirstWindow(subject);
    } else if (topic === "nsPref:changed") {
      this.refreshAll();
      for (const fn of this._listeners) {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }
    }
  },

  /** New tabs (and the start page) open the Glyde page, and the address bar stays empty on it. */
  _setNewTabPage() {
    try {
      const { AboutNewTab } = ChromeUtils.importESModule("resource:///modules/AboutNewTab.sys.mjs");
      AboutNewTab.newTabURL = HOME_URL;
    } catch (e) {
      console.error("Glyde: could not set the new tab page", e);
    }
  },

  /** Runs once per start, for the first normal window: apply the Glyde theme and show the wizard. */
  _onFirstWindow(win) {
    if (this._firstDone || win.closed || win.gBrowser === undefined) {
      return;
    }
    if (win.PrivateBrowsingUtils?.isWindowPrivate(win)) {
      return;
    }
    this._firstDone = true;
    this._applyThemeOnce();
    if (!Services.prefs.getBoolPref("glyde.welcome.done", false)) {
      this.openWelcome(win);
    }
  },

  async _applyThemeOnce() {
    try {
      if (Services.prefs.getBoolPref("glyde.theme.applied", false)) {
        return;
      }
      if (this.values().theme === "glyde") {
        await this._setTheme("glyde");
      }
      Services.prefs.setBoolPref("glyde.theme.applied", true);
    } catch (e) {
      console.error("Glyde: could not apply the Glyde theme", e);
    }
  },

  /**
   * Open the welcome wizard (a page on the Glyde website) in a new tab. When the page reaches its
   * final address, remember that it is finished and show the Glyde start page in that tab instead.
   */
  openWelcome(win) {
    try {
      win = win || Services.wm.getMostRecentWindow("navigator:browser");
      const gBrowser = win.gBrowser;
      const tab = gBrowser.addTrustedTab(WELCOME_URL);
      gBrowser.selectedTab = tab;
      const listener = {
        onLocationChange(browser, webProgress, request, location) {
          if (browser !== tab.linkedBrowser || !webProgress.isTopLevel) {
            return;
          }
          if (location.spec.split("?")[0] === WELCOME_DONE_URL) {
            Services.prefs.setBoolPref("glyde.welcome.done", true);
            gBrowser.removeTabsProgressListener(listener);
            browser.loadURI(Services.io.newURI(HOME_URL), {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
          }
        },
      };
      gBrowser.addTabsProgressListener(listener);
      tab.addEventListener("TabClose", () => gBrowser.removeTabsProgressListener(listener), { once: true });
    } catch (e) {
      console.error("Glyde: could not open the welcome page", e);
    }
  },

  /** Be told when any setting changes (the settings page uses this to stay up to date). */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  refreshAll() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this.applyToWindow(win);
    }
  },

  applyToWindow(win) {
    try {
      const utils = win.windowUtils;
      const type = Ci.nsIDOMWindowUtils.USER_SHEET;
      const old = this._sheets.get(win);
      if (old) {
        utils.removeSheetUsingURIString(old, type);
      }
      const uri = "data:text/css;charset=utf-8," + encodeURIComponent(buildCss(this.values()));
      utils.loadSheetUsingURIString(uri, type);
      this._sheets.set(win, uri);
    } catch (e) {
      console.error("Glyde: could not apply appearance settings", e);
    }
  },

  /** Change one setting. Stores it, and writes the Firefox preferences that carry it out. */
  set(key, value) {
    if (!(key in DEFAULTS)) {
      throw new Error("Unknown Glyde setting: " + key);
    }
    const v = sanitise(key, value);
    if (typeof DEFAULTS[key] === "number") {
      Services.prefs.setIntPref(PREF + key, v);
    } else {
      Services.prefs.setStringPref(PREF + key, v);
    }
    this._carryOut(key, v);
    // Used by sync to tell which side changed last.
    Services.prefs.setStringPref("glyde.sync.localModified", String(Date.now()));
  },

  /** Apply many values at once (used when settings arrive from sync). Does not stamp the time. */
  setMany(obj) {
    for (const key of Object.keys(DEFAULTS)) {
      if (!(key in obj)) {
        continue;
      }
      const v = sanitise(key, obj[key]);
      if (typeof DEFAULTS[key] === "number") {
        Services.prefs.setIntPref(PREF + key, v);
      } else {
        Services.prefs.setStringPref(PREF + key, v);
      }
      this._carryOut(key, v);
    }
  },

  _carryOut(key, v) {
    const p = Services.prefs;
    switch (key) {
      case "interfaceScale":
        // -1 means "use the system setting".
        p.setCharPref("layout.css.devPixelsPerPx", v === 100 ? "-1.0" : (v / 100).toFixed(2));
        break;
      case "density":
        p.setIntPref("browser.uidensity", { normal: 0, compact: 1, roomy: 2 }[v]);
        break;
      case "tabs":
        p.setBoolPref("sidebar.verticalTabs", v !== "top");
        if (v !== "top") {
          p.setBoolPref("sidebar.position_start", v === "left");
        }
        break;
      case "pageTextSize":
        p.setIntPref("font.size.variable.x-western", Math.round((16 * v) / 100));
        break;
      case "pageFont":
        p.setCharPref(
          "font.default.x-western",
          { system: "sans-serif", serif: "serif", mono: "monospace" }[v]
        );
        break;
      case "theme": {
        // 0 dark, 1 light, 2 follow the system: this is the colour scheme web pages see.
        p.setIntPref("layout.css.prefers-color-scheme.content-override", { dark: 0, light: 1, system: 2, glyde: 2 }[v]);
        this._setTheme(v);
        break;
      }
      default:
        break;
    }
  },

  async _setTheme(name) {
    try {
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
      if (name === "glyde") {
        // Built-in themes are only installed when asked for.
        const { BuiltInThemes } = ChromeUtils.importESModule("resource:///modules/BuiltInThemes.sys.mjs");
        await BuiltInThemes.ensureBuiltInThemes();
      }
      const addon = await AddonManager.getAddonByID(THEME_IDS[name]);
      if (addon) {
        await addon.enable();
      }
    } catch (e) {
      console.error("Glyde: could not switch theme", e);
    }
  },
};
