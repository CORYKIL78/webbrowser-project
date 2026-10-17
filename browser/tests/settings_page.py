"""Opens the Glyde settings page in a real browser with stand-ins for the Glyde modules, then clicks through it.
   python3 browser/tests/settings_page.py [screenshot folder]"""
import pathlib, re, shutil, sys, tempfile, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(tempfile.mkdtemp())
OUT.mkdir(parents=True, exist_ok=True)
site = pathlib.Path(tempfile.mkdtemp())
for f in ("settings.html", "settings.css", "settings.js"):
    t = (ROOT / "browser/ui/settings" / f).read_text().replace("chrome://browser/content/glyde/", "/")
    t = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', "", t)  # the policy only makes sense for chrome:// pages
    (site / f).write_text(t)
(site / "logo.svg").write_text((ROOT / "pwa/logo.svg").read_text())
shutil.copytree(ROOT / "browser/ui/wallpapers", site / "wallpapers")

MOCK = r"""
const DEFAULTS = {theme:'glyde',accent:'#0e7c70',roundness:8,interfaceScale:100,density:'normal',font:'system',fontCustom:'',pageFont:'system',pageTextSize:100,tabs:'top',wallpaper:'glide-lines'};
const state = {...DEFAULTS}; const L = new Set(); window.__calls = [];
const acct = {signedIn:false,id:'',name:'',email:''}; let pass = false; const sync = {enabled:false,lastSynced:0};
let upd = {phase:'idle',progress:0,error:'',info:null,file:''}; const UL = new Set();
const setUpd = p => { upd = {...upd, ...p}; UL.forEach(f => f(upd)); };
const mods = {
 'GlydeUI.sys.mjs': {WALLPAPERS:['glide-lines','dusk-hills','soft-glow','contours','night-arcs','paper-waves'],
   GlydeUI:{openWelcome(){window.__welcome=true},values:()=>({...state}),set(k,v){window.__calls.push(['set',k,v]);state[k]=v;L.forEach(f=>f());},onChange(f){L.add(f)}}},
 'GlydeAccount.sys.mjs': {GlydeAccount:{status:()=>({...acct}),async signIn(){ if(window.__signinFails) throw new Error('Sign-in was cancelled.'); Object.assign(acct,{signedIn:true,id:'CID-1',name:'Sam',email:'sam@example.test'}); return acct;},async signOut(){Object.assign(acct,{signedIn:false})},async verify(){return acct.signedIn}}},
 'GlydeSync.sys.mjs': {GlydeSync:{status:()=>({...sync}),hasPassphrase:async()=>pass,setEnabled(b){sync.enabled=b},async setPassphrase(p){ if(p.length<8) throw new Error('Use a sync passphrase of at least 8 characters.'); pass=true},async syncNow(){sync.lastSynced=Date.now();return 'uploaded'},async resetRemote(){}}},
 'GlydeUpdate.sys.mjs': {GlydeUpdate:{version:'0.1.0',get state(){return upd},onChange(f){UL.add(f)},async check(){setUpd({phase:'checking'});await new Promise(r=>setTimeout(r,30));setUpd({phase:'available',info:{version:'0.2.0',page:'#',asset:{name:'x'},sumsUrl:'u'}})},async download(){for(const p of [10,60]){setUpd({phase:'downloading',progress:p});await new Promise(r=>setTimeout(r,20))}setUpd({phase:'verifying',progress:100});await new Promise(r=>setTimeout(r,20));setUpd({phase:'ready',file:'f'})},async apply(){window.__applied=true;return ''}}},
};
window.ChromeUtils = {importESModule:(u)=>mods[u.split('/').pop()]};
window.browsingContext = {topChromeWindow:{}};
"""

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(site)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/settings.html"

problems = []
def check(cond, msg):
    if not cond: problems.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ("light", "dark"):
        pg = b.new_page(viewport={"width": 820, "height": 900}, color_scheme=scheme)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.add_init_script(MOCK)
        pg.goto(url)
        pg.wait_for_selector("#run-welcome")
        if scheme == "light":
            # look and feel
            pg.fill("#roundness", "0") if False else pg.eval_on_selector("#roundness", "e=>{e.value=0;e.dispatchEvent(new Event('input'))}")
            check(pg.evaluate("window.__calls.at(-1)[1]") == "roundness", "roundness slider calls set")
            check(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--r')").strip() == "0px", "page follows roundness")
            pg.click(".sw[data-colour='#7c3aed']")
            check(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent')").strip() == "#7c3aed", "accent applied to the page")
            pg.check("input[name=tabs][value=right]", force=True)
            check(pg.evaluate("window.__calls.some(c=>c[1]=='tabs'&&c[2]=='right')"), "tab layout calls set")
            pg.select_option("#font", "custom")
            check(pg.is_visible("#font-custom-wrap"), "custom font box appears")
            pg.check("input[name=theme][value=dark]", force=True)
            check(pg.evaluate("window.__calls.some(c=>c[1]=='theme'&&c[2]=='dark')"), "theme calls set")
            check(pg.is_visible("input[name=theme][value=glyde]", timeout=500) or pg.locator("input[name=theme][value=glyde]").count() == 1, "Glyde theme choice exists")
            pg.click("#run-welcome")
            check(pg.evaluate("window.__welcome===true"), "welcome tour button calls openWelcome")
            # account
            pg.click("#signin")
            pg.wait_for_selector("#acct-in:not([hidden])")
            check(pg.inner_text("#who-name") == "Sam", "signed in name shown")
            pg.check("#sync-on", force=True)
            pg.wait_for_selector("#sync-setup:not([hidden])")
            pg.fill("#passphrase", "short")
            pg.click("#save-pass")
            pg.wait_for_function("document.getElementById('acct-status').textContent.includes('8 characters')")
            check("err" in pg.get_attribute("#acct-status", "class"), "short passphrase shows an error")
            pg.fill("#passphrase", "a long passphrase")
            pg.click("#save-pass")
            pg.wait_for_selector("#sync-ready:not([hidden])")
            # update
            pg.click("#upd-check"); pg.wait_for_selector("#upd-download:not([hidden])")
            pg.click("#upd-download"); pg.wait_for_selector("#upd-apply:not([hidden])")
            check("downloaded and checked" in pg.inner_text("#upd-status"), "ready message shown")
            pg.click("#upd-apply")
            check(pg.evaluate("window.__applied===true"), "apply is called")
            pg.click("#signout")
            pg.wait_for_selector("#acct-out:not([hidden])")
        pg.screenshot(path=str(OUT / f"settings-{scheme}.png"), full_page=True)
        check(not errs, f"no page errors ({scheme}): {errs}")
        pg.close()
    b.close()
print("\n".join("PROBLEM: " + x for x in problems) or "all checks passed")
print("screenshots in", OUT)
sys.exit(1 if problems else 0)
