"use strict";
/* The Glyde settings page. It runs inside about:preferences (in a frame), with browser privileges,
 * so it can talk to the Glyde modules directly. All the real work happens in those modules. */

const BASE = "chrome://browser/content/glyde/";
const { GlydeUI } = ChromeUtils.importESModule(BASE + "GlydeUI.sys.mjs");
const { GlydeAccount } = ChromeUtils.importESModule(BASE + "GlydeAccount.sys.mjs");
const { GlydeSync } = ChromeUtils.importESModule(BASE + "GlydeSync.sys.mjs");
const { GlydeUpdate } = ChromeUtils.importESModule(BASE + "GlydeUpdate.sys.mjs");

const $ = id => document.getElementById(id);
const ACCENTS = ["#0e7c70", "#2563eb", "#7c3aed", "#e11d48", "#ea580c", "#ca8a04", "#475569"];

function say(el, text, isError) {
  el.textContent = text || "";
  el.classList.toggle("err", !!isError);
}

function readableInk(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#1c2321" : "#ffffff";
}

// ---------- Look and feel ----------

function buildControls() {
  const sw = $("swatches");
  for (const colour of ACCENTS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw";
    b.style.background = colour;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", "Accent " + colour);
    b.dataset.colour = colour;
    b.addEventListener("click", () => GlydeUI.set("accent", colour));
    sw.appendChild(b);
  }
  $("accent-custom").addEventListener("input", e => GlydeUI.set("accent", e.target.value));

  for (const r of document.querySelectorAll('input[name="theme"],input[name="tabs"]')) {
    r.addEventListener("change", () => r.checked && GlydeUI.set(r.name, r.value));
  }
  const slider = (id, key, out, fmt) => {
    $(id).addEventListener("input", e => {
      GlydeUI.set(key, Number(e.target.value));
      $(out).textContent = fmt(Number(e.target.value));
    });
  };
  slider("roundness", "roundness", "roundness-out", n => (n === 0 ? "Square" : n + " px"));
  slider("interfaceScale", "interfaceScale", "scale-out", n => n + "%");
  slider("pageTextSize", "pageTextSize", "text-out", n => n + "%");
  $("density").addEventListener("change", e => GlydeUI.set("density", e.target.value));
  $("font").addEventListener("change", e => GlydeUI.set("font", e.target.value));
  $("fontCustom").addEventListener("change", e => GlydeUI.set("fontCustom", e.target.value));
  $("pageFont").addEventListener("change", e => GlydeUI.set("pageFont", e.target.value));

  $("run-welcome").addEventListener("click", () => GlydeUI.openWelcome());
}

function renderLook() {
  const v = GlydeUI.values();
  const root = document.documentElement.style;
  root.setProperty("--accent", v.accent);
  root.setProperty("--accent-ink", readableInk(v.accent));
  root.setProperty("--r", v.roundness + "px");
  for (const r of document.querySelectorAll('input[name="theme"]')) {
    r.checked = r.value === v.theme;
  }
  for (const r of document.querySelectorAll('input[name="tabs"]')) {
    r.checked = r.value === v.tabs;
  }
  for (const b of document.querySelectorAll(".sw")) {
    b.setAttribute("aria-checked", String(b.dataset.colour === v.accent));
  }
  $("accent-custom").value = v.accent;
  $("roundness").value = v.roundness;
  $("roundness-out").textContent = v.roundness === 0 ? "Square" : v.roundness + " px";
  $("interfaceScale").value = v.interfaceScale;
  $("scale-out").textContent = v.interfaceScale + "%";
  $("pageTextSize").value = v.pageTextSize;
  $("text-out").textContent = v.pageTextSize + "%";
  $("density").value = v.density;
  $("font").value = v.font;
  $("fontCustom").value = v.fontCustom;
  $("font-custom-wrap").hidden = v.font !== "custom";
  $("pageFont").value = v.pageFont;
}

// ---------- Account and sync ----------

async function renderAccount() {
  const s = GlydeAccount.status();
  $("acct-out").hidden = s.signedIn;
  $("acct-in").hidden = !s.signedIn;
  if (!s.signedIn) {
    return;
  }
  $("who-name").textContent = s.name || s.id;
  $("who-email").textContent = s.email;
  $("avatar").textContent = (s.name || s.email || "?").trim().charAt(0).toUpperCase();
  const sync = GlydeSync.status();
  const hasPass = await GlydeSync.hasPassphrase();
  $("sync-on").checked = sync.enabled;
  $("sync-setup").hidden = !(sync.enabled && !hasPass);
  $("sync-ready").hidden = !(sync.enabled && hasPass);
  $("sync-when").textContent = sync.lastSynced ? "Last synced " + new Date(sync.lastSynced).toLocaleString("en-GB") : "Not synced yet";
}

function wireAccount() {
  $("signin").addEventListener("click", async () => {
    const status = $("signin-status");
    $("signin").disabled = true;
    say(status, "Finish signing in in the new tab...");
    try {
      await GlydeAccount.signIn(window.browsingContext.topChromeWindow);
      say(status, "");
    } catch (e) {
      say(status, e.message, true);
    }
    $("signin").disabled = false;
    renderAccount();
  });
  $("signout").addEventListener("click", async () => {
    await GlydeAccount.signOut();
    GlydeSync.setEnabled(false);
    renderAccount();
  });
  $("sync-on").addEventListener("change", e => {
    GlydeSync.setEnabled(e.target.checked);
    renderAccount();
  });
  const run = async (btn, fn, okText) => {
    const status = $("acct-status");
    btn.disabled = true;
    say(status, "Working...");
    try {
      const out = await fn();
      say(status, typeof okText === "function" ? okText(out) : okText);
    } catch (e) {
      say(status, e.message, true);
    }
    btn.disabled = false;
    renderAccount();
  };
  $("save-pass").addEventListener("click", () =>
    run($("save-pass"), async () => {
      await GlydeSync.setPassphrase($("passphrase").value);
      $("passphrase").value = "";
      return GlydeSync.syncNow();
    }, out => ({ uploaded: "Saved. Your settings are now stored, encrypted.", downloaded: "Saved. Settings from your other computer were applied here.", "up-to-date": "Saved. Everything already matches." })[out])
  );
  $("sync-now").addEventListener("click", () =>
    run($("sync-now"), () => GlydeSync.syncNow(), out => ({ uploaded: "Your settings were uploaded.", downloaded: "Settings from your other computer were applied here.", "up-to-date": "Everything already matches." })[out])
  );
  $("reset-remote").addEventListener("click", () =>
    run($("reset-remote"), async () => {
      await GlydeSync.resetRemote();
      return GlydeSync.syncNow();
    }, () => "The stored copy was replaced with this computer's settings.")
  );
}

// ---------- Updates ----------

function renderUpdate(s = GlydeUpdate.state) {
  $("cur-ver").textContent = GlydeUpdate.version;
  const info = s.info;
  const status = $("upd-status");
  const show = (check, download, apply) => {
    $("upd-check").hidden = !check;
    $("upd-download").hidden = !download;
    $("upd-apply").hidden = !apply;
  };
  $("upd-progress").hidden = !["downloading", "verifying"].includes(s.phase);
  $("upd-bar").style.width = (s.progress || 0) + "%";
  $("upd-notes").hidden = !info;
  if (info) {
    $("upd-notes").href = info.page;
    $("upd-notes").target = "_blank";
  }
  $("upd-check").disabled = s.phase === "checking";
  switch (s.phase) {
    case "checking":
      say(status, "Checking...");
      show(true, false, false);
      break;
    case "current":
      say(status, "You are up to date.");
      show(true, false, false);
      break;
    case "available":
      say(status, "Glyde " + info.version + " is available.");
      show(false, true, false);
      break;
    case "downloading":
      say(status, "Downloading... " + Math.round(s.progress) + "%");
      show(false, false, false);
      break;
    case "verifying":
      say(status, "Checking the download...");
      show(false, false, false);
      break;
    case "ready":
      say(status, "Glyde " + info.version + " is downloaded and checked. Glyde will close and open again when it is installed.");
      show(false, false, true);
      break;
    case "error":
      say(status, s.error, true);
      show(true, !!info && !!info.sumsUrl, false);
      break;
    default:
      say(status, "Not checked yet.");
      show(true, false, false);
  }
}

function wireUpdate() {
  $("upd-check").addEventListener("click", () => GlydeUpdate.check());
  $("upd-download").addEventListener("click", () => GlydeUpdate.download());
  $("upd-apply").addEventListener("click", async () => {
    $("upd-apply").disabled = true;
    const problem = await GlydeUpdate.apply();
    if (problem) {
      say($("upd-status"), problem, true);
      $("upd-apply").disabled = false;
    }
  });
  GlydeUpdate.onChange(renderUpdate);
}

// ---------- Start ----------

buildControls();
wireAccount();
wireUpdate();
renderLook();
renderAccount();
renderUpdate();
GlydeUI.onChange(renderLook);
GlydeAccount.verify().then(renderAccount);
