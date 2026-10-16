// Fills in the download buttons from the newest GitHub release. Without JavaScript the
// buttons still point to the releases page, so nothing depends on this script.
(function () {
  var API = 'https://api.github.com/repos/CORYKIL78/webbrowser-project/releases?per_page=5';
  var buttons = document.querySelectorAll('[data-asset]');
  if (!buttons.length) return;

  function mb(n) { return (n / 1048576).toFixed(0) + ' MB'; }

  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
    .then(function (list) {
      var rel = (list || []).filter(function (r) { return !r.draft; })[0];
      if (!rel) throw new Error('none');
      var tag = String(rel.tag_name).replace(/^v/, '');
      var version = document.getElementById('version');
      if (version) version.textContent = 'Version ' + tag + (rel.prerelease ? ' (early preview)' : '');
      buttons.forEach(function (b) {
        var want = b.getAttribute('data-asset');
        var asset = (rel.assets || []).filter(function (a) { return a.name.indexOf(want) !== -1; })[0];
        if (!asset) return;
        b.href = asset.browser_download_url;
        b.removeAttribute('aria-disabled');
        b.textContent = 'Download ' + mb(asset.size);
      });
    })
    .catch(function () {
      var version = document.getElementById('version');
      if (version) version.textContent = 'No release is published yet.';
    });
})();
