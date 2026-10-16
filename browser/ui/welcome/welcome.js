(function () {
  var stage = document.getElementById('stage');
  function go(n) { stage.setAttribute('data-step', String(n)); window.scrollTo(0, 0); }
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); });
  });
  var boxes = ['age', 'terms', 'privacy'].map(function (id) { return document.getElementById(id); });
  var agree = document.getElementById('agree');
  function refresh() { agree.disabled = !boxes.every(function (b) { return b.checked; }); }
  boxes.forEach(function (b) { b.addEventListener('change', refresh); });
  agree.addEventListener('click', function () {
    try { localStorage.setItem('glyde.accepted', new Date().toISOString()); } catch (e) { /* storage may be unavailable */ }
    go(3);
  });
  document.getElementById('decline').addEventListener('click', function () { go(4); });
  document.getElementById('start').addEventListener('click', function () {
    window.location.href = 'https://www.google.com/';
  });
})();
