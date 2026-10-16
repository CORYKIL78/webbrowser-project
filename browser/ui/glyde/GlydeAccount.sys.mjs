/* Cirkle ID sign-in for Glyde.
 *
 * Uses the OAuth 2.0 authorisation code flow with PKCE, so the browser never holds a secret:
 *   1. open Cirkle ID's sign-in page in a normal tab, with a one-time challenge
 *   2. Cirkle ID sends the tab to REDIRECT_URI with a short-lived code
 *   3. we watch for that address, close the tab, and swap the code (plus the matching verifier)
 *      for a bearer token
 * The token is kept in the browser's encrypted login store, never in a preference.
 *
 * Replaces the Firefox Account sign-in, which is switched off in Glyde.
 */

export const CLIENT_ID = "glyde";
export const REDIRECT_URI = "https://glyde.teamcirkle.co.uk/signin/done";
const SECRET_ORIGIN = "chrome://glyde-account";
const SECRET_REALM = "Glyde";
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

const b64url = bytes =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function randomString(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function makePkce() {
  const verifier = randomString(48); // 64 characters, inside the 43 to 128 the standard allows
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

export function serverBase() {
  const raw = Services.prefs.getStringPref("glyde.account.server", "https://id.teamcirkle.co.uk");
  return raw.replace(/\/+$/, "");
}

// ---- Encrypted storage for secrets (the token and the sync passphrase) ----

export const Secrets = {
  _info(name, value) {
    const LoginInfo = Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo, "init");
    return new LoginInfo(SECRET_ORIGIN, null, SECRET_REALM, name, value, "", "");
  },
  async _find(name) {
    await Services.logins.initializationPromise;
    const logins = await Services.logins.searchLoginsAsync({ origin: SECRET_ORIGIN, httpRealm: SECRET_REALM });
    return logins.find(l => l.username === name) || null;
  },
  async get(name) {
    return (await this._find(name))?.password ?? null;
  },
  async set(name, value) {
    const existing = await this._find(name);
    if (existing) {
      Services.logins.removeLogin(existing);
    }
    await Services.logins.addLoginAsync(this._info(name, value));
  },
  async remove(name) {
    const existing = await this._find(name);
    if (existing) {
      Services.logins.removeLogin(existing);
    }
  },
};

// ---- Account state ----

export const GlydeAccount = {
  /** What the settings page shows. Reads only plain preferences, so it is quick. */
  status() {
    const p = Services.prefs;
    const signedIn = p.getBoolPref("glyde.account.signedIn", false);
    return {
      signedIn,
      id: signedIn ? p.getStringPref("glyde.account.id", "") : "",
      name: signedIn ? p.getStringPref("glyde.account.name", "") : "",
      email: signedIn ? p.getStringPref("glyde.account.email", "") : "",
    };
  },

  async token() {
    return this.status().signedIn ? Secrets.get("token") : null;
  },

  /**
   * Opens the sign-in tab and resolves with the account when it finishes.
   * Rejects with an Error whose message can be shown to the person (cancelled, timed out, refused).
   */
  async signIn(win) {
    const { verifier, challenge } = await makePkce();
    const state = randomString(18);
    const url = new URL(serverBase() + "/api/oauth/authorize");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    const code = await this._waitForRedirect(win, url.toString(), state);
    const res = await fetch(serverBase() + "/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(data.error || "Cirkle ID would not complete the sign-in. Please try again.");
    }
    await Secrets.set("token", data.access_token);
    const p = Services.prefs;
    p.setBoolPref("glyde.account.signedIn", true);
    p.setStringPref("glyde.account.id", data.user?.id ?? "");
    p.setStringPref("glyde.account.name", data.user?.name ?? "");
    p.setStringPref("glyde.account.email", data.user?.email ?? "");
    return this.status();
  },

  _waitForRedirect(win, startUrl, expectedState) {
    return new Promise((resolve, reject) => {
      const gBrowser = win.gBrowser;
      const tab = gBrowser.addTrustedTab(startUrl);
      gBrowser.selectedTab = tab;
      let finished = false;

      const finish = (fn, value) => {
        if (finished) {
          return;
        }
        finished = true;
        gBrowser.removeTabsProgressListener(listener);
        tab.removeEventListener("TabClose", onClose);
        win.clearTimeout(timer);
        try {
          gBrowser.removeTab(tab);
        } catch (e) {
          /* already closed */
        }
        fn(value);
      };

      const listener = {
        onLocationChange(browser, webProgress, request, location) {
          if (browser !== tab.linkedBrowser || !webProgress.isTopLevel || !location.spec.startsWith(REDIRECT_URI)) {
            return;
          }
          const params = new URL(location.spec).searchParams;
          if (params.get("state") !== expectedState) {
            finish(reject, new Error("The sign-in answer did not match this request, so it was ignored."));
          } else if (params.get("error")) {
            finish(reject, new Error("Cirkle ID refused the sign-in."));
          } else if (!params.get("code")) {
            finish(reject, new Error("Cirkle ID did not send a sign-in code."));
          } else {
            finish(resolve, params.get("code"));
          }
        },
      };
      const onClose = () => finish(reject, new Error("Sign-in was cancelled."));
      gBrowser.addTabsProgressListener(listener);
      tab.addEventListener("TabClose", onClose);
      const timer = win.setTimeout(
        () => finish(reject, new Error("Sign-in took too long and was stopped.")),
        SIGN_IN_TIMEOUT_MS
      );
    });
  },

  /** Check the saved token is still good. Signs out locally if Cirkle ID no longer accepts it. */
  async verify() {
    const token = await this.token();
    if (!token) {
      return false;
    }
    try {
      const res = await fetch(serverBase() + "/api/oauth/userinfo", { headers: { Authorization: "Bearer " + token } });
      if (res.status === 401) {
        await this._forget();
        return false;
      }
      if (res.ok) {
        const u = await res.json();
        Services.prefs.setStringPref("glyde.account.name", u.name ?? "");
        Services.prefs.setStringPref("glyde.account.email", u.email ?? "");
      }
      return res.ok;
    } catch (e) {
      return true; // offline: keep the sign-in and try again later
    }
  },

  async signOut() {
    const token = await this.token();
    if (token) {
      try {
        await fetch(serverBase() + "/api/oauth/revoke", { method: "POST", headers: { Authorization: "Bearer " + token } });
      } catch (e) {
        /* offline: the token is still removed from this computer below */
      }
    }
    await this._forget();
  },

  async _forget() {
    await Secrets.remove("token");
    await Secrets.remove("syncPassphrase");
    const p = Services.prefs;
    for (const k of ["signedIn", "id", "name", "email"]) {
      p.clearUserPref("glyde.account." + k);
    }
    p.clearUserPref("glyde.sync.rev");
    p.clearUserPref("glyde.sync.lastSynced");
  },
};
