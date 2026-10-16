(function () {
  var KEY = 'glyde.cookieNotice';
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) { /* storage blocked: show it each time */ }
  function show() {
    var box = document.createElement('div');
    box.className = 'cookie';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Cookie notice');
    var p = document.createElement('p');
    p.appendChild(document.createTextNode('This website uses no cookies and no trackers. '));
    var a = document.createElement('a');
    a.href = '/legal/cookies';
    a.textContent = 'Read the cookie policy';
    p.appendChild(a);
    p.appendChild(document.createTextNode('.'));
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = 'OK';
    b.addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
      box.remove();
    });
    box.appendChild(p);
    box.appendChild(b);
    document.body.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
