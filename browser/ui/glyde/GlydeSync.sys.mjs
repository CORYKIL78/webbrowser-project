/* Settings sync for Glyde, through Cirkle ID.
 *
 * What is synced: the look and layout settings (glyde.ui.*) and the update-check switch.
 * Not synced: history, passwords, bookmarks, open tabs. (Those may come later.)
 *
 * Everything is encrypted on this computer before it is sent. The key comes from a sync passphrase
 * that is stored only here (in the encrypted login store), so Cirkle ID holds ciphertext it cannot
 * read. Lose the passphrase and the stored copy cannot be recovered, only replaced.
 */
import { GlydeAccount, Secrets, serverBase } from "chrome://browser/content/glyde/GlydeAccount.sys.mjs";
import { GlydeUI } from "chrome://browser/content/glyde/GlydeUI.sys.mjs";

const { setTimeout, clearTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");

const PBKDF2_ITERATIONS = 600000;
const KEEP_BOOLS = ["glyde.autoUpdateCheck"];

const toB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.stringify({ v: 1, i: PBKDF2_ITERATIONS, s: toB64(salt), n: toB64(iv), c: toB64(cipher) });
}

export async function decryptJson(blob, passphrase) {
  let box;
  try {
    box = JSON.parse(blob);
  } catch (e) {
    throw new Error("The saved settings are not in a format this version understands.");
  }
  if (box.v !== 1 || !box.s || !box.n || !box.c || !(box.i >= 100000 && box.i <= 5000000)) {
    throw new Error("The saved settings are not in a format this version understands.");
  }
  const key = await deriveKey(passphrase, fromB64(box.s), box.i);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.n) }, key, fromB64(box.c));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch (e) {
    const err = new Error("That sync passphrase does not match the one used to save these settings.");
    err.code = "BAD_PASSPHRASE";
    throw err;
  }
}

function snapshot() {
  const prefs = { ...GlydeUI.values() };
  for (const k of KEEP_BOOLS) {
    prefs[k] = Services.prefs.getBoolPref(k, true);
  }
  const modified = Number(Services.prefs.getStringPref("glyde.sync.localModified", "0")) || 0;
  return { v: 1, modified, prefs };
}

function applySnapshot(snap) {
  if (!snap || snap.v !== 1 || typeof snap.prefs !== "object") {
    throw new Error("The saved settings are not in a format this version understands.");
  }
  GlydeUI.setMany(snap.prefs); // unknown keys are ignored, bad values are replaced by safe ones
  for (const k of KEEP_BOOLS) {
    if (typeof snap.prefs[k] === "boolean") {
      Services.prefs.setBoolPref(k, snap.prefs[k]);
    }
  }
  Services.prefs.setStringPref("glyde.sync.localModified", String(snap.modified || 0));
}

async function api(method, body) {
  const token = await GlydeAccount.token();
  if (!token) {
    throw new Error("You are not signed in.");
  }
  const res = await fetch(serverBase() + "/api/sync/settings", {
    method,
    headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await GlydeAccount.verify();
    throw new Error("Your Cirkle ID sign-in has expired. Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

export const GlydeSync = {
  _timer: null,
  _started: false,

  /** Called once at browser start. Syncs a little after start-up, and a few seconds after a change. */
  init() {
    if (this._started) {
      return;
    }
    this._started = true;
    Services.prefs.addObserver("glyde.ui.", () => this._later(8000));
    this._later(20000);
  },

  _later(ms) {
    if (!this.status().enabled || !GlydeAccount.status().signedIn) {
      return;
    }
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      try {
        if (await this.hasPassphrase()) {
          await this.syncNow();
        }
      } catch (e) {
        console.warn("Glyde sync:", e.message);
      }
    }, ms);
  },

  hasPassphrase: async () => !!(await Secrets.get("syncPassphrase")),

  async setPassphrase(passphrase) {
    if (typeof passphrase !== "string" || passphrase.length < 8) {
      throw new Error("Use a sync passphrase of at least 8 characters.");
    }
    await Secrets.set("syncPassphrase", passphrase);
    Services.prefs.clearUserPref("glyde.sync.rev");
  },

  status() {
    return {
      enabled: Services.prefs.getBoolPref("glyde.sync.enabled", false),
      lastSynced: Number(Services.prefs.getStringPref("glyde.sync.lastSynced", "0")) || 0,
    };
  },

  setEnabled(on) {
    Services.prefs.setBoolPref("glyde.sync.enabled", !!on);
  },

  /**
   * Bring this computer and Cirkle ID in line. Newest change wins:
   *  - nothing stored yet: upload this computer's settings
   *  - stored copy is newer: apply it here
   *  - this computer is newer: upload
   */
  async syncNow() {
    const passphrase = await Secrets.get("syncPassphrase");
    if (!passphrase) {
      throw new Error("Set a sync passphrase first.");
    }
    const remote = await api("GET");
    if (remote.status === 404) {
      return this._push(passphrase, 0);
    }
    if (!remote.ok) {
      throw new Error(remote.data.error || "Cirkle ID could not be reached.");
    }
    const remoteSnap = await decryptJson(remote.data.blob, passphrase);
    const local = snapshot();
    const knownRev = Services.prefs.getIntPref("glyde.sync.rev", 0);

    if (remote.data.rev === knownRev && local.modified <= (remoteSnap.modified || 0)) {
      this._done(remote.data.rev);
      return "up-to-date";
    }
    if ((remoteSnap.modified || 0) > local.modified) {
      applySnapshot(remoteSnap);
      this._done(remote.data.rev);
      return "downloaded";
    }
    return this._push(passphrase, remote.data.rev);
  },

  async _push(passphrase, baseRev) {
    const blob = await encryptJson(snapshot(), passphrase);
    const res = await api("PUT", { baseRev, blob });
    if (res.status === 409) {
      throw new Error("Another computer saved settings at the same moment. Press Sync now again.");
    }
    if (!res.ok) {
      throw new Error(res.data.error || "Cirkle ID could not save the settings.");
    }
    this._done(res.data.rev);
    return "uploaded";
  },

  _done(rev) {
    Services.prefs.setIntPref("glyde.sync.rev", rev);
    Services.prefs.setStringPref("glyde.sync.lastSynced", String(Date.now()));
  },

  /** Throw away the stored copy on Cirkle ID (used after a forgotten passphrase). */
  async resetRemote() {
    const res = await api("DELETE");
    if (!res.ok) {
      throw new Error(res.data.error || "Cirkle ID could not remove the settings.");
    }
    Services.prefs.clearUserPref("glyde.sync.rev");
  },
};

