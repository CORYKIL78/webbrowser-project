(function () {
  var RELEASES = 'https://api.github.com/repos/CORYKIL78/webbrowser-project/releases?per_page=5';
  var DAY = 24 * 60 * 60 * 1000;
  var current = '0.0.0';

  // Wallpaper chosen in Glyde settings (only works inside Glyde, where this page can read preferences).
  try {
    var wall = Services.prefs.getStringPref('glyde.ui.wallpaper', 'none');
    if (/^[a-z-]{1,30}$/.test(wall) && wall !== 'none') {
      document.body.style.backgroundImage = 'url(wallpapers/' + wall + '.svg)';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.classList.add('has-wall');
    }
  } catch (e) { /* plain home page */ }

  function store(key, value) {
    try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (e) { return null; }
  }
  function newer(a, b) { // is version a newer than b?
    var x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; }
    return false;
  }
  function el(id) { return document.getElementById(id); }
  function item(t) {
    var li = document.createElement('li'), s = document.createElement('strong'), p = document.createElement('span');
    s.textContent = t.title; p.textContent = t.text; li.appendChild(s); li.appendChild(p); return li;
  }

  fetch('whatsnew.json').then(function (r) { return r.json(); }).then(function (d) {
    current = String(d.version || '0.0.0').replace(/^v/, '');
    el('version').textContent = 'Version ' + current;
    (d.items || []).forEach(function (t) { el('new-list').appendChild(item(t)); });
    startCheck();
  }).catch(function () { el('new-list').appendChild(item({ title: 'Welcome', text: 'Thanks for using Glyde.' })); });

  var auto = el('auto');
  auto.checked = store('glyde.autoUpdateCheck') !== 'off';
  auto.addEventListener('change', function () { store('glyde.autoUpdateCheck', auto.checked ? 'on' : 'off'); });
  el('check-now').addEventListener('click', function () { check(true); });

  function startCheck() {
    if (!auto.checked) return;
    var last = Number(store('glyde.lastUpdateCheck') || 0);
    if (Date.now() - last > DAY) check(false);
  }

  function pickAsset(assets) {
    var win = /Windows/i.test(navigator.userAgent), want = win ? 'windows' : 'linux';
    for (var i = 0; i < assets.length; i++) if (assets[i].name.indexOf(want) !== -1) return assets[i];
    return null;
  }

  function check(manual) {
    var status = el('status');
    if (manual) status.textContent = 'Checking...';
    fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
      .then(function (list) {
        store('glyde.lastUpdateCheck', String(Date.now()));
        var rel = (list || []).filter(function (r) { return !r.draft; })[0];
        if (!rel) { if (manual) status.textContent = 'No release is published yet.'; return; }
        if (newer(rel.tag_name, current)) {
          var a = pickAsset(rel.assets || []);
          el('update-title').textContent = 'Glyde ' + String(rel.tag_name).replace(/^v/, '') + ' is available';
          el('update-text').textContent = 'You have version ' + current + '. Download the new version, unzip it and run it to update.';
          el('update-link').href = a ? a.browser_download_url : rel.html_url;
          el('update').hidden = false;
          if (manual) status.textContent = 'A new version is ready.';
        } else if (manual) status.textContent = 'You have the latest version.';
      })
      .catch(function () { if (manual) status.textContent = 'Could not check right now.'; });
  }
})();
