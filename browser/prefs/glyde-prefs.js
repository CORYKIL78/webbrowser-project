// Glyde default preferences.
// These are appended to browser/app/profile/firefox.js in the Firefox source before the build.
// They are DEFAULTS, so people can still change them in settings. Things that must be
// enforced live in browser/distribution/policies.json instead.

// ---- Search: Google only, nothing sent while typing ----
pref("browser.search.suggest.enabled", false);
pref("browser.urlbar.suggest.searches", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);

// ---- New tab: no adverts, no sponsored content ----
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
pref("browser.newtabpage.activity-stream.telemetry", false);

// ---- No reporting of any kind ----
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.archive.enabled", false);
pref("datareporting.healthreport.uploadEnabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("app.shield.optoutstudies.enabled", false);
pref("app.normandy.enabled", false);
pref("extensions.pocket.enabled", false);

// ---- Tracking protection and cookies ----
pref("browser.contentblocking.category", "strict");
pref("privacy.trackingprotection.enabled", true);
pref("privacy.trackingprotection.socialtracking.enabled", true);
pref("privacy.trackingprotection.fingerprinting.enabled", true);
pref("privacy.trackingprotection.cryptomining.enabled", true);
pref("network.cookie.cookieBehavior", 5);
pref("privacy.globalprivacycontrol.enabled", true);

// ---- Connections ----
pref("dom.security.https_only_mode", true);
pref("network.dns.disablePrefetch", true);
pref("network.prefetch-next", false);
pref("network.predictor.enabled", false);
pref("network.http.speculative-parallel-limit", 0);
pref("network.http.referer.XOriginTrimmingPolicy", 2);
pref("media.peerconnection.ice.default_address_only", true);
pref("network.captive-portal-service.enabled", false);
pref("geo.provider.network.url", "");

// ---- Layout: Firefox's own vertical tabs are available but off by default ----
pref("sidebar.revamp", true);
pref("sidebar.verticalTabs", false);

// First run: show the Glyde setup wizard instead of Firefox's welcome pages.
pref("browser.aboutwelcome.enabled", false);
pref("startup.homepage_welcome_url", "chrome://browser/content/glyde/welcome.html");
pref("startup.homepage_welcome_url.additional", "");

// ---- Low power and low memory: aimed at weak laptops ----
// Fewer web content processes means much less memory and CPU. Pages still load in parallel.
pref("dom.ipc.processCount", 2);
pref("dom.ipc.processPrelaunch.enabled", false);
// Free memory from tabs nobody is looking at.
pref("browser.tabs.unloadOnLowMemory", true);
pref("browser.tabs.min_inactive_duration_before_unload", 300000);
// Keep less in memory, and write the session to disk less often (less disk and CPU work).
pref("browser.cache.memory.capacity", 65536);
pref("browser.sessionhistory.max_total_viewers", 2);
pref("browser.sessionstore.interval", 60000);
// No videos or sounds that start by themselves.
pref("media.autoplay.default", 1);
// No background lookups for things that are not needed.
pref("browser.discovery.enabled", false);
pref("extensions.getAddons.cache.enabled", false);

// ---- Faster page loads ----
pref("network.http.pacing.requests.enabled", false);
pref("network.http.max-persistent-connections-per-server", 8);
pref("browser.startup.preXulSkeletonUI", true);

// ---- Startup: land on the Glyde home page ----
pref("browser.startup.homepage", "chrome://browser/content/glyde/home.html");
pref("browser.startup.page", 1);
