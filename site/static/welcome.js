(function () {
  var shell = document.getElementById('shell');
  if (!shell) return;
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var marks = Array.prototype.slice.call(document.querySelectorAll('.steps li'));
  function go(n) {
    steps.forEach(function (s) { s.hidden = s.getAttribute('data-step') !== String(n); });
    var shown = n === 4 ? 2 : n;
    marks.forEach(function (m) {
      var k = Number(m.getAttribute('data-for'));
      m.classList.toggle('on', k === shown);
      m.classList.toggle('done', k < shown);
    });
    shell.setAttribute('data-step', String(n));
    window.scrollTo(0, 0);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
    b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); });
  });
  var boxes = ['age', 'terms', 'privacy'].map(function (id) { return document.getElementById(id); });
  var agree = document.getElementById('agree');
  function refresh() { agree.disabled = !boxes.every(function (b) { return b.checked; }); }
  boxes.forEach(function (b) { b.addEventListener('change', refresh); });
  agree.addEventListener('click', function () { go(3); });
  document.getElementById('decline').addEventListener('click', function () { go(4); });
  go(1);
})();
