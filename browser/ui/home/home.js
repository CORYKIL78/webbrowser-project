(function () {
  var BASE = 'chrome://browser/content/glyde/';
  var NAMES = {
    'none': 'Plain', 'glide-lines': 'Glide lines', 'dusk-hills': 'Dusk hills', 'soft-glow': 'Soft glow',
    'contours': 'Contours', 'night-arcs': 'Night arcs', 'paper-waves': 'Paper waves'
  };
  // Wallpapers that are light need dark lettering.
  var LIGHT = { 'dusk-hills': 1, 'paper-waves': 1 };
  var KEY = 'glyde.wallpaper';
  var DEFAULT = 'glide-lines';

  // Inside Glyde this page can use the settings engine. Anywhere else (a plain preview) it uses local storage.
  var ui = null;
  try { ui = ChromeUtils.importESModule(BASE + 'GlydeUI.sys.mjs'); } catch (e) { ui = null; }

  function get() {
    if (ui) { try { return ui.GlydeUI.values().wallpaper; } catch (e) { /* fall through */ } }
    try { return localStorage.getItem(KEY) || DEFAULT; } catch (e) { return DEFAULT; }
  }
  function put(name) {
    if (ui) { try { ui.GlydeUI.set('wallpaper', name); return; } catch (e) { /* fall through */ } }
    try { localStorage.setItem(KEY, name); } catch (e) { /* storage may be unavailable */ }
  }

  function paint() {
    var w = get();
    if (!NAMES[w]) w = DEFAULT;
    document.body.style.backgroundImage = w === 'none' ? 'none' : 'url(wallpapers/' + w + '.svg)';
    document.body.setAttribute('data-tone', LIGHT[w] ? 'light' : 'dark');
    var radios = document.querySelectorAll('#walls input');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === w;
  }

  var walls = document.getElementById('walls');
  Object.keys(NAMES).forEach(function (name) {
    var l = document.createElement('label'); l.className = 'wall';
    var i = document.createElement('input'); i.type = 'radio'; i.name = 'wall'; i.value = name;
    i.addEventListener('change', function () { if (i.checked) { put(name); paint(); } });
    var t = document.createElement('span'); t.className = 'th' + (name === 'none' ? ' none' : '');
    if (name === 'none') t.textContent = 'Plain'; else t.style.backgroundImage = 'url(wallpapers/' + name + '.svg)';
    var n = document.createElement('span'); n.className = 'n'; n.textContent = NAMES[name];
    l.appendChild(i); l.appendChild(t); l.appendChild(n); walls.appendChild(l);
  });

  var panel = document.getElementById('panel'), openBtn = document.getElementById('open');
  function toggle(show) {
    panel.hidden = !show;
    openBtn.setAttribute('aria-expanded', String(show));
    if (show) panel.querySelector('input:checked, input').focus(); else openBtn.focus();
  }
  openBtn.addEventListener('click', function () { toggle(panel.hidden); });
  document.getElementById('close').addEventListener('click', function () { toggle(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });

  if (ui) { try { ui.GlydeUI.onChange(paint); } catch (e) { /* not essential */ } }
  paint();
})();
