/*
 * Glyde runtime configuration.
 * Edit the Cirkle ID values to match your real Cirkle ID deployment.
 * The paths below are sensible defaults for an OAuth 2.0 authorisation code
 * flow with PKCE. Change them if your Cirkle ID uses different routes.
 */
window.GLYDE_CONFIG = {
  cirkleId: {
    base: "https://id.teamcirkle.co.uk",
    clientId: "glyde-browser",
    authorizePath: "/authorize",
    tokenPath: "/token",
    userinfoPath: "/userinfo",
    // Where saved settings live for a signed in user (GET returns JSON, PUT saves JSON).
    settingsPath: "/api/browser/settings",
    scope: "openid profile browser:settings extensions"
  },
  // Extensions that belong to the Cirkle ID account. Add more entries as you build them.
  extensions: [
    {
      id: "vault",
      name: "Password vault",
      blurb: "Open your saved logins. Needs Cirkle ID.",
      url: "https://id.teamcirkle.co.uk/vault",
      requiresSignIn: true
    }
  ],
  engines: {
    google: { name: "Google", url: "https://www.google.com/search?q=%s", suggest: "https://suggestqueries.google.com/complete/search?client=firefox&q=%s" },
    bing: { name: "Bing", url: "https://www.bing.com/search?q=%s", suggest: null },
    duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", suggest: "https://duckduckgo.com/ac/?type=list&q=%s" }
  }
};
