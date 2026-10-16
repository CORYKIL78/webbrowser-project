// Tests for the Glyde browser modules, run in Node with small stand-ins for Firefox's own objects.
//   node --test browser/tests/modules.test.mjs
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "ui", "glyde");

// ---- Stand-ins for Firefox globals ----
class FakePrefs {
  constructor() { this.m = new Map(); this.observers = []; }
  _get(k, d) { return this.m.has(k) ? this.m.get(k) : d; }
  getIntPref(k, d) { return this._get(k, d); }
  getStringPref(k, d) { return this._get(k, d); }
  getBoolPref(k, d) { return this._get(k, d); }
  setIntPref(k, v) { this.m.set(k, v); }
  setStringPref(k, v) { this.m.set(k, v); }
  setCharPref(k, v) { this.m.set(k, v); }
  setBoolPref(k, v) { this.m.set(k, v); }
  clearUserPref(k) { this.m.delete(k); }
  addObserver() {}
}
const secrets = new Map();
globalThis.Ci = { nsIDOMWindowUtils: { USER_SHEET: 1 }, nsILoginInfo: {}, nsIAppStartup: { eAttemptQuit: 2 } };
globalThis.Cc = {};
globalThis.Components = { Constructor: () => function (origin, a, realm, user, pass) { Object.assign(this, { origin, realm, username: user, password: pass }); } };
globalThis.Services = {
  prefs: new FakePrefs(),
  obs: { addObserver() {} },
  wm: { getEnumerator: () => [] },
  logins: {
    initializationPromise: Promise.resolve(),
    searchLoginsAsync: async () => [...secrets.entries()].map(([username, password]) => ({ username, password })),
    removeLogin: l => secrets.delete(l.username),
    addLoginAsync: async l => { secrets.set(l.username, l.password); },
  },
};
globalThis.ChromeUtils = {
  importESModule: url => {
    if (url.includes("Timer")) return { setTimeout, clearTimeout };
    if (url.includes("AddonManager")) return { AddonManager: { getAddonByID: async () => ({ enable: async () => {} }) } };
    if (url.includes("AppConstants")) return { AppConstants: { platform: "linux" } };
    throw new Error("unexpected import " + url);
  },
};
globalThis.AppConstants = { platform: "linux" };
globalThis.console = console;

let UI, Account, Sync, Update;
before(async () => {
  // Copy the modules to a temp folder with the chrome:// links turned into relative ones, so Node can load them.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glyde-mods-"));
  for (const f of fs.readdirSync(SRC)) {
    fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(SRC, f), "utf8").replaceAll("chrome://browser/content/glyde/", "./"));
  }
  const load = f => import(pathToFileURL(path.join(dir, f)).href);
  UI = await load("GlydeUI.sys.mjs");
  Account = await load("GlydeAccount.sys.mjs");
  Sync = await load("GlydeSync.sys.mjs");
  Update = await load("GlydeUpdate.sys.mjs");
});

test("settings are cleaned: bad values become safe ones", () => {
  assert.equal(UI.sanitise("roundness", 99), 20);
  assert.equal(UI.sanitise("roundness", -4), 0);
  assert.equal(UI.sanitise("roundness", "abc"), 8);
  assert.equal(UI.sanitise("accent", "red"), "#0e7c70");
  assert.equal(UI.sanitise("accent", "#ABCDEF"), "#abcdef");
  assert.equal(UI.sanitise("tabs", "bottom"), "top");
  assert.equal(UI.sanitise("wallpaper", "../../x"), "none");
  assert.equal(UI.sanitise("interfaceScale", 500), 150);
  assert.equal(UI.sanitise("nope", 1), undefined);
});

test("a font name can never break out of the style sheet", () => {
  const evil = UI.sanitise("fontCustom", 'Lexend"; } * { display:none } /*');
  assert.ok(!/["{};]/.test(evil), evil);
  const css = UI.buildCss({ ...UI.DEFAULTS, font: "custom", fontCustom: evil });
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test("style sheet follows the settings", () => {
  const css = UI.buildCss({ ...UI.DEFAULTS, roundness: 0, accent: "#2563eb", font: "serif" });
  assert.match(css, /--border-radius-medium: 0px !important/);
  assert.match(css, /--color-accent-primary: #2563eb !important/);
  assert.match(css, /font-family: Georgia/);
  const plain = UI.buildCss(UI.DEFAULTS);
  assert.ok(!/color-accent-primary/.test(plain), "the default accent leaves Firefox's own colours alone");
  assert.ok(!/font-family/.test(plain));
});

test("set() stores the value and writes the Firefox preferences that carry it out", () => {
  const p = Services.prefs;
  UI.GlydeUI.set("tabs", "right");
  assert.equal(p.getBoolPref("sidebar.verticalTabs"), true);
  assert.equal(p.getBoolPref("sidebar.position_start"), false);
  UI.GlydeUI.set("tabs", "left");
  assert.equal(p.getBoolPref("sidebar.position_start"), true);
  UI.GlydeUI.set("tabs", "top");
  assert.equal(p.getBoolPref("sidebar.verticalTabs"), false);
  UI.GlydeUI.set("interfaceScale", 120);
  assert.equal(p.getStringPref("layout.css.devPixelsPerPx"), "1.20");
  UI.GlydeUI.set("interfaceScale", 100);
  assert.equal(p.getStringPref("layout.css.devPixelsPerPx"), "-1.0");
  UI.GlydeUI.set("pageTextSize", 125);
  assert.equal(p.getIntPref("font.size.variable.x-western"), 20);
  UI.GlydeUI.set("density", "compact");
  assert.equal(p.getIntPref("browser.uidensity"), 1);
  assert.equal(UI.GlydeUI.values().density, "compact");
  assert.throws(() => UI.GlydeUI.set("bogus", 1));
});

test("PKCE: the challenge is the SHA-256 of the verifier", async () => {
  const { verifier, challenge } = await Account.makePkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("sign-in: opens Cirkle ID, reads the code from the redirect, trades it for a token", async () => {
  let listener, closed = false, openedUrl;
  const tab = { linkedBrowser: {}, addEventListener() {}, removeEventListener() {} };
  const win = {
    gBrowser: {
      addTrustedTab: url => { openedUrl = new URL(url); return tab; },
      addTabsProgressListener: l => { listener = l; },
      removeTabsProgressListener() {},
      removeTab: () => { closed = true; },
    },
    setTimeout: () => 1,
    clearTimeout() {},
  };
  const realFetch = globalThis.fetch;
  let tokenBody;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith("/api/oauth/token"));
    tokenBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ access_token: "tok123", user: { id: "CID-1", name: "Sam", email: "s@x.test" } }), { status: 200 });
  };
  const pending = Account.GlydeAccount.signIn(win);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(openedUrl.pathname, "/api/oauth/authorize");
  assert.equal(openedUrl.searchParams.get("client_id"), "glyde");
  assert.equal(openedUrl.searchParams.get("code_challenge_method"), "S256");
  const state = openedUrl.searchParams.get("state");
  // A wrong state must be refused.
  const bad = Account.GlydeAccount.signIn({ ...win, gBrowser: { ...win.gBrowser, addTrustedTab: () => tab, addTabsProgressListener: l => { listener = l; } } });
  await new Promise(r => setTimeout(r, 20));
  listener.onLocationChange(tab.linkedBrowser, { isTopLevel: true }, null, { spec: Account.REDIRECT_URI + "?code=zzz&state=WRONG" });
  await assert.rejects(bad, /did not match/);
  // The real one.
  const pending2 = Account.GlydeAccount.signIn(win);
  await new Promise(r => setTimeout(r, 20));
  const state2 = openedUrl.searchParams.get("state");
  assert.notEqual(state2, state);
  listener.onLocationChange(tab.linkedBrowser, { isTopLevel: true }, null, { spec: Account.REDIRECT_URI + "?code=abc&state=" + state2 });
  const who = await pending2;
  assert.equal(who.signedIn, true);
  assert.equal(who.name, "Sam");
  assert.equal(secrets.get("token"), "tok123");
  assert.equal(tokenBody.code, "abc");
  assert.equal(createHash("sha256").update(tokenBody.code_verifier).digest("base64url"), openedUrl.searchParams.get("code_challenge"));
  assert.ok(closed);
  globalThis.fetch = realFetch;
  pending.catch(() => {});
});

test("sync: encrypt, decrypt, and a wrong passphrase is refused", async () => {
  const blob = await Sync.encryptJson({ hello: "world" }, "correct horse battery");
  assert.ok(!blob.includes("world"));
  assert.deepEqual(await Sync.decryptJson(blob, "correct horse battery"), { hello: "world" });
  await assert.rejects(Sync.decryptJson(blob, "wrong passphrase!"), e => e.code === "BAD_PASSPHRASE");
  await assert.rejects(Sync.decryptJson("{}", "x"), /format/);
});

test("sync: first upload, then a change from another computer is applied, then a local change uploads", async () => {
  const realFetch = globalThis.fetch;
  let stored = null, rev = 0;
  globalThis.fetch = async (url, init = {}) => {
    const m = init.method || "GET";
    if (m === "GET") return stored ? new Response(JSON.stringify({ rev, blob: stored }), { status: 200 }) : new Response("{}", { status: 404 });
    if (m === "PUT") {
      const b = JSON.parse(init.body);
      if (b.baseRev !== rev) return new Response(JSON.stringify({ error: "Out of date." }), { status: 409 });
      stored = b.blob; rev += 1;
      return new Response(JSON.stringify({ rev }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };
  Services.prefs.setBoolPref("glyde.account.signedIn", true);
  await Sync.GlydeSync.setPassphrase("a long passphrase");
  UI.GlydeUI.set("accent", "#7c3aed");
  assert.equal(await Sync.GlydeSync.syncNow(), "uploaded");
  assert.equal(await Sync.GlydeSync.syncNow(), "up-to-date");

  // Another computer saves a newer copy.
  const other = { v: 1, modified: Date.now() + 5000, prefs: { ...UI.GlydeUI.values(), accent: "#e11d48", roundness: 3 } };
  stored = await Sync.encryptJson(other, "a long passphrase"); rev += 1;
  assert.equal(await Sync.GlydeSync.syncNow(), "downloaded");
  assert.equal(UI.GlydeUI.values().accent, "#e11d48");
  assert.equal(UI.GlydeUI.values().roundness, 3);

  // A later change here goes up.
  Services.prefs.setStringPref("glyde.sync.localModified", String(other.modified + 1000));
  assert.equal(await Sync.GlydeSync.syncNow(), "uploaded");
  const back = await Sync.decryptJson(stored, "a long passphrase");
  assert.equal(back.prefs.accent, "#e11d48");
  await assert.rejects(Sync.GlydeSync.setPassphrase("short"), /8 characters/);
  globalThis.fetch = realFetch;
});

test("updates: versions, picking a release, reading the checksum list", () => {
  const { compareVersions, pickRelease, findHash } = Update;
  assert.equal(compareVersions("v0.2.0", "0.1.9"), 1);
  assert.equal(compareVersions("0.1.0", "v0.1.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  const releases = [
    { tag_name: "v0.1.0", assets: [{ name: "glyde-linux-x86_64.tar.xz", browser_download_url: "u0", size: 1 }] },
    { tag_name: "v0.3.0", draft: true, assets: [] },
    { tag_name: "v0.2.0", body: "notes", html_url: "page", assets: [
      { name: "glyde-linux-x86_64.tar.xz", browser_download_url: "u1", size: 5 },
      { name: "glyde-windows-x86_64.zip", browser_download_url: "u2", size: 6 },
      { name: "SHA256SUMS.txt", browser_download_url: "u3", size: 1 } ] },
  ];
  const win = pickRelease(releases, "0.1.0", "windows");
  assert.equal(win.version, "0.2.0");
  assert.equal(win.asset.url, "u2");
  assert.equal(win.sumsUrl, "u3");
  assert.equal(pickRelease(releases, "0.2.0", "windows"), null);
  assert.equal(pickRelease([], "0.1.0", "linux"), null);
  const h = "a".repeat(64);
  assert.equal(findHash(`${h}  glyde-windows-x86_64.zip\n${"b".repeat(64)} *other.zip\n`, "glyde-windows-x86_64.zip"), h);
  assert.equal(findHash(`${h}  other.zip`, "glyde-windows-x86_64.zip"), null);
});
