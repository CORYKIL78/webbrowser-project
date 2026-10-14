(() => {
  "use strict";
  const CFG = window.GLYDE_CONFIG;
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  /* ---------- storage helpers (never throw) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };

  /* ---------- settings ---------- */
  const DEFAULTS = {
    theme: "dark", accent: "#14a08c", radius: 16, scale: 100, bgStyle: "glow",
    motion: "auto", speed: 100, engine: "duckduckgo", suggest: true,
    showQuick: true, showExt: true, name: "", inApp: false, links: [], updatedAt: 0
  };
  let settings = Object.assign({}, DEFAULTS, store.get("glyde.settings", {}));

  const lowEnd = () =>
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    (navigator.connection && navigator.connection.saveData);

  function applySettings() {
    const dark = settings.theme === "auto"
      ? !matchMedia("(prefers-color-scheme: light)").matches
      : settings.theme === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    root.style.setProperty("--accent", settings.accent);
    root.style.setProperty("--radius", settings.radius + "px");
    root.style.setProperty("--scale", settings.scale / 100);
    root.style.setProperty("--speed", settings.speed / 100);
    root.dataset.bg = settings.bgStyle;
    root.dataset.motion = settings.motion === "auto" ? (lowEnd() ? "lite" : "full") : settings.motion;
    $("quick").hidden = !settings.showQuick;
    $("ext").hidden = !settings.showExt;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#0d0f1a" : "#f4f5fb";
    $("engine").value = settings.engine;
    renderGreeting();
    renderQuick();
  }

  let saveTimer = 0;
  function saveSettings(touch = true) {
    if (touch) settings.updatedAt = Date.now();
    store.set("glyde.settings", settings);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushSettings, 1200);
  }

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
  }

  /* ---------- greeting, quick links, extensions ---------- */
  function renderGreeting() {
    const h = new Date().getHours();
    const part = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    $("greeting").textContent = settings.name ? `${part}, ${settings.name}` : part;
  }

  function tile(label, letter, onClick, sub, disabled) {
    const b = document.createElement("button");
    b.className = "tile";
    if (disabled) b.setAttribute("aria-disabled", "true");
    const d = document.createElement("span");
    d.className = "dot";
    d.textContent = letter;
    const t = document.createElement("span");
    t.textContent = label;
    if (sub) { const s = document.createElement("small"); s.textContent = sub; t.appendChild(s); }
    b.append(d, t);
    b.addEventListener("click", onClick);
    return b;
  }

  function renderQuick() {
    const box = $("quick");
    box.replaceChildren();
    Object.entries(CFG.engines).forEach(([key, e]) => {
      box.appendChild(tile(e.name, e.name[0], () => { settings.engine = key; $("engine").value = key; saveSettings(); toast(`${e.name} is now your search engine`); }));
    });
    settings.links.forEach((l, i) => {
      const b = tile(l.title, (l.title[0] || "?").toUpperCase(), () => openUrl(l.url));
      b.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        if (confirm(`Remove ${l.title}?`)) { settings.links.splice(i, 1); saveSettings(); renderQuick(); }
      });
      box.appendChild(b);
    });
    box.appendChild(tile("Add link", "+", addLink));
  }

  function addLink() {
    const url = prompt("Address of the site (for example example.com)");
    if (!url) return;
    const full = normaliseUrl(url);
    if (!full) return toast("That does not look like an address");
    const title = prompt("Name for this link", new URL(full).hostname.replace(/^www\./, "")) || new URL(full).hostname;
    settings.links.push({ title: title.slice(0, 20), url: full });
    saveSettings();
    renderQuick();
  }

  function renderExt() {
    const box = $("ext");
    box.replaceChildren();
    CFG.extensions.forEach((x) => {
      const locked = x.requiresSignIn && !auth();
      box.appendChild(tile(x.name, x.name[0], () => {
        if (locked) return toast("Sign in with Cirkle ID to use this");
        openUrl(x.url, true);
      }, locked ? "Sign in to use" : x.blurb, locked));
    });
  }

  /* ---------- tabs ---------- */
  let tabs = store.get("glyde.tabs", []);
  let active = store.get("glyde.active", 0);
  if (!tabs.length) tabs = [{ title: "Start", url: null }];
  if (active >= tabs.length) active = 0;

  function persistTabs() { store.set("glyde.tabs", tabs); store.set("glyde.active", active); }

  function renderTabs(entering) {
    const box = $("tabs");
    box.replaceChildren();
    tabs.forEach((t, i) => {
      const el = document.createElement("div");
      el.className = "tab" + (entering === i ? " enter" : "");
      el.setAttribute("role", "tab");
      el.setAttribute("aria-selected", String(i === active));
      el.tabIndex = 0;
      const s = document.createElement("span");
      s.textContent = t.title;
      const x = document.createElement("button");
      x.setAttribute("aria-label", "Close tab");
      x.textContent = "×";
      x.addEventListener("click", (e) => { e.stopPropagation(); closeTab(i); });
      el.append(s, x);
      el.addEventListener("click", () => selectTab(i));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") selectTab(i); });
      box.appendChild(el);
    });
    const cur = box.children[active];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  function showView() {
    const t = tabs[active];
    const page = $("page"), home = $("home");
    if (t.url) {
      home.hidden = true; page.hidden = false;
      page.classList.remove("enter"); void page.offsetWidth; page.classList.add("enter");
      $("addr").value = t.url;
      $("frame").src = t.url;
      $("frameNote").hidden = false;
    } else {
      page.hidden = true; home.hidden = false;
      $("frame").src = "about:blank";
      home.classList.remove("enter"); void home.offsetWidth; home.classList.add("enter");
    }
    persistTabs();
  }

  function selectTab(i) { active = i; renderTabs(); showView(); }
  function newTab() { tabs.push({ title: "Start", url: null }); active = tabs.length - 1; renderTabs(active); showView(); $("q").focus(); }
  function closeTab(i) {
    tabs.splice(i, 1);
    if (!tabs.length) tabs.push({ title: "Start", url: null });
    if (active >= tabs.length) active = tabs.length - 1;
    renderTabs(); showView();
  }

  /* ---------- navigation ---------- */
  function normaliseUrl(input) {
    const v = input.trim();
    if (!v || /\s/.test(v)) return null;
    if (/^https?:\/\//i.test(v)) { try { return new URL(v).href; } catch { return null; } }
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) || /^localhost(:\d+)?(\/.*)?$/.test(v)) {
      try { return new URL("https://" + v).href; } catch { return null; }
    }
    return null;
  }

  function openUrl(url, forceExternal) {
    // Most big sites forbid being shown inside another page, so by default pages open in a real browser tab.
    if (settings.inApp && !forceExternal) {
      tabs[active] = { title: new URL(url).hostname.replace(/^www\./, ""), url };
      renderTabs(); showView();
    } else {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) location.href = url;
    }
  }

  function go(raw) {
    const text = raw.trim();
    if (!text) return;
    addHistory(text);
    const direct = normaliseUrl(text);
    if (direct) return openUrl(direct);
    const eng = CFG.engines[settings.engine] || CFG.engines.duckduckgo;
    openUrl(eng.url.replace("%s", encodeURIComponent(text)));
  }

  /* ---------- history based suggestions (private, on device) ---------- */
  const addHistory = (q) => {
    const h = store.get("glyde.history", []).filter((x) => x !== q);
    h.unshift(q);
    store.set("glyde.history", h.slice(0, 40));
  };

  let sugTimer = 0, sugSeq = 0, sugIndex = -1;
  function showSuggestions(items) {
    const ul = $("suggest");
    ul.replaceChildren();
    sugIndex = -1;
    if (!items.length) { ul.hidden = true; return; }
    items.slice(0, 7).forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); $("q").value = s; go(s); ul.hidden = true; });
      ul.appendChild(li);
    });
    ul.hidden = false;
  }

  async function remoteSuggest(q, seq) {
    const eng = CFG.engines[settings.engine];
    if (!eng || !eng.suggest) return [];
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch(eng.suggest.replace("%s", encodeURIComponent(q)), { signal: ctl.signal });
      clearTimeout(timer);
      const j = await r.json();
      return seq === sugSeq && Array.isArray(j[1]) ? j[1] : [];
    } catch { return []; } // blocked by the browser or offline, history still works
  }

  function onType() {
    const q = $("q").value.trim();
    clearTimeout(sugTimer);
    if (!q || !settings.suggest) return showSuggestions([]);
    const local = store.get("glyde.history", []).filter((h) => h.toLowerCase().includes(q.toLowerCase()));
    showSuggestions(local);
    const seq = ++sugSeq;
    sugTimer = setTimeout(async () => {
      const remote = await remoteSuggest(q, seq);
      if (seq === sugSeq && remote.length) showSuggestions([...new Set([...local, ...remote])]);
    }, 180);
  }

  /* ---------- Cirkle ID (OAuth 2.0 authorisation code with PKCE) ---------- */
  const auth = () => store.get("glyde.auth", null);
  const idUrl = (p) => CFG.cirkleId.base.replace(/\/$/, "") + p;
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const rand = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const redirectUri = () => location.origin + "/";

  async function signIn() {
    const verifier = rand(48);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = rand(16);
    sessionStorage.setItem("glyde.pkce", JSON.stringify({ verifier, state }));
    const p = new URLSearchParams({
      response_type: "code", client_id: CFG.cirkleId.clientId, redirect_uri: redirectUri(),
      scope: CFG.cirkleId.scope, state, code_challenge: challenge, code_challenge_method: "S256"
    });
    location.href = idUrl(CFG.cirkleId.authorizePath) + "?" + p;
  }

  async function finishSignIn() {
    const u = new URL(location.href);
    const code = u.searchParams.get("code"), state = u.searchParams.get("state");
    if (!code || !state) return;
    history.replaceState(null, "", "/");
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem("glyde.pkce") || "null"); } catch { saved = null; }
    sessionStorage.removeItem("glyde.pkce");
    if (!saved || saved.state !== state) return toast("Sign in could not be verified. Please try again.");
    try {
      const r = await fetch(idUrl(CFG.cirkleId.tokenPath), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code", code, client_id: CFG.cirkleId.clientId,
          redirect_uri: redirectUri(), code_verifier: saved.verifier
        })
      });
      if (!r.ok) throw new Error(String(r.status));
      const t = await r.json();
      store.set("glyde.auth", { token: t.access_token, expires: Date.now() + (t.expires_in || 3600) * 1000, user: null });
      await loadUser();
      toast("Signed in with Cirkle ID");
      await pullSettings();
    } catch {
      toast("Cirkle ID sign in failed. Check the settings in config.js.");
    }
    renderAccount();
  }

  async function loadUser() {
    const a = auth();
    if (!a) return;
    try {
      const r = await fetch(idUrl(CFG.cirkleId.userinfoPath), { headers: { Authorization: "Bearer " + a.token } });
      if (r.ok) { const u = await r.json(); a.user = { name: u.name || u.preferred_username || u.email || "Account" }; store.set("glyde.auth", a); }
    } catch { /* offline, keep going */ }
  }

  function signedIn() {
    const a = auth();
    if (!a) return false;
    if (a.expires && a.expires < Date.now()) { store.del("glyde.auth"); return false; }
    return true;
  }

  function renderAccount() {
    const a = signedIn() ? auth() : null;
    $("account").textContent = a ? (a.user && a.user.name ? a.user.name : "Account") : "Sign in";
    $("syncState").textContent = a ? "Signed in. Your settings sync automatically." : "Sign in with Cirkle ID to keep these settings on every device.";
    renderExt();
  }

  async function pushSettings() {
    if (!signedIn()) return;
    try {
      await fetch(idUrl(CFG.cirkleId.settingsPath), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + auth().token },
        body: JSON.stringify(settings)
      });
    } catch { /* will retry on next change */ }
  }

  async function pullSettings() {
    if (!signedIn()) return;
    try {
      const r = await fetch(idUrl(CFG.cirkleId.settingsPath), { headers: { Authorization: "Bearer " + auth().token } });
      if (!r.ok) return;
      const remote = await r.json();
      if (remote && (remote.updatedAt || 0) > settings.updatedAt) {
        settings = Object.assign({}, DEFAULTS, remote);
        store.set("glyde.settings", settings);
        syncControls(); applySettings();
        toast("Settings loaded from your account");
      } else {
        pushSettings();
      }
    } catch { /* offline */ }
  }

  /* ---------- settings sheet ---------- */
  function syncControls() {
    document.querySelectorAll("[data-s]").forEach((el) => {
      const v = settings[el.dataset.s];
      if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    });
  }

  function openSheet(on) {
    const s = $("sheet"), sc = $("scrim");
    if (on) {
      sc.hidden = false; void sc.offsetWidth; sc.classList.add("on");
      s.classList.add("on");
    } else {
      sc.classList.remove("on"); s.classList.remove("on");
      setTimeout(() => { if (!s.classList.contains("on")) sc.hidden = true; }, 260);
    }
    s.setAttribute("aria-hidden", String(!on));
  }

  /* ---------- wire everything up ---------- */
  function init() {
    Object.entries(CFG.engines).forEach(([k, e]) => {
      [$("engine"), $("engineSetting")].forEach((sel) => sel.add(new Option(e.name, k)));
    });
    syncControls();
    applySettings();
    renderTabs();
    showView();
    renderAccount();

    $("omni").addEventListener("submit", (e) => { e.preventDefault(); $("suggest").hidden = true; go($("q").value); });
    $("q").addEventListener("input", onType);
    $("q").addEventListener("blur", () => setTimeout(() => ($("suggest").hidden = true), 120));
    $("q").addEventListener("keydown", (e) => {
      const items = $("suggest").children;
      if (!items.length || $("suggest").hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sugIndex = (sugIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        [...items].forEach((li, i) => li.setAttribute("aria-selected", String(i === sugIndex)));
        $("q").value = items[sugIndex].textContent;
      }
    });
    $("engine").addEventListener("change", (e) => { settings.engine = e.target.value; syncControls(); saveSettings(); });
    $("newTab").addEventListener("click", newTab);
    $("back").addEventListener("click", () => { tabs[active] = { title: "Start", url: null }; renderTabs(); showView(); });
    $("external").addEventListener("click", () => tabs[active].url && window.open(tabs[active].url, "_blank", "noopener,noreferrer"));
    $("openSettings").addEventListener("click", () => openSheet(true));
    $("closeSettings").addEventListener("click", () => openSheet(false));
    $("scrim").addEventListener("click", () => openSheet(false));
    $("account").addEventListener("click", () => {
      if (!signedIn()) return signIn();
      if (confirm("Sign out of Cirkle ID on this device?")) { store.del("glyde.auth"); renderAccount(); toast("Signed out"); }
    });
    $("syncNow").addEventListener("click", async () => {
      if (!signedIn()) return toast("Sign in with Cirkle ID first");
      await pullSettings(); toast("Sync complete");
    });
    $("resetAll").addEventListener("click", () => {
      if (!confirm("Reset all settings to the defaults?")) return;
      settings = Object.assign({}, DEFAULTS); saveSettings(); syncControls(); applySettings();
    });

    document.querySelectorAll("[data-s]").forEach((el) => {
      const ev = el.type === "range" || el.type === "color" || el.type === "text" ? "input" : "change";
      el.addEventListener(ev, () => {
        const k = el.dataset.s;
        settings[k] = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
        saveSettings();
        applySettings();
      });
    });

    matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => settings.theme === "auto" && applySettings());

    addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "t") { e.preventDefault(); newTab(); }
      else if (mod && e.key.toLowerCase() === "l") { e.preventDefault(); $("q").focus(); }
      else if (e.key === "Escape") openSheet(false);
    });

    const params = new URLSearchParams(location.search);
    if (params.get("panel") === "settings") openSheet(true);
    if (params.get("focus") === "search") $("q").focus();

    finishSignIn().then(() => { if (signedIn()) { loadUser().then(renderAccount); pullSettings(); } });

    if ("serviceWorker" in navigator) {
      addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
    }
  }

  init();
})();
