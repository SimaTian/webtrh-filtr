/* Nastavení rozšíření Webtrh filtr. */
(function () {
  'use strict';

  var api = (typeof chrome !== 'undefined' && chrome.storage) ? chrome : browser;  // Firefox: chrome = callbacky
  var KNOWN_TYPES = ['Prodej', 'Poptávka', 'Nabídka', 'Práce', 'Diskuse', 'Článek'];
  var BOOLS = ['hideDomainSales', 'hideMediumConfidence', 'dedupe', 'autoload',
    'chatHideLinks', 'chatHideDomainTalk', 'chatHideDomainChat', 'chatHideUnrated', 'onlyPinned'];
  var NUMS = ['target', 'maxLoads'];
  var LISTS = ['pin', 'mute', 'chatMuteAuthors'];
  var $ = function (id) { return document.getElementById(id); };

  function lines(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function renderTypes(all, hidden) {
    var box = $('types');
    box.textContent = '';
    all.forEach(function (t) {
      var l = document.createElement('label');
      l.className = 'row';
      var i = document.createElement('input');
      i.type = 'checkbox';
      i.value = t;
      i.checked = hidden.indexOf(t) === -1;   // zaškrtnuté = chci vidět
      i.className = 'type';
      l.appendChild(i);
      l.appendChild(document.createTextNode(' ' + t));
      box.appendChild(l);
    });
  }

  function collect() {
    var p = {};
    BOOLS.forEach(function (k) { p[k] = $(k).checked; });
    NUMS.forEach(function (k) { p[k] = Math.max(1, parseInt($(k).value, 10) || WTF.DEFAULTS[k]); });
    LISTS.forEach(function (k) { p[k] = lines($(k).value); });
    p.hiddenTypes = Array.prototype.filter
      .call(document.querySelectorAll('input.type'), function (i) { return !i.checked; })
      .map(function (i) { return i.value; });
    return p;
  }

  function fill(prefs, allTypes) {
    BOOLS.forEach(function (k) { $(k).checked = !!prefs[k]; });
    NUMS.forEach(function (k) { $(k).value = prefs[k]; });
    LISTS.forEach(function (k) { $(k).value = (prefs[k] || []).join('\n'); });
    renderTypes(allTypes, prefs.hiddenTypes || []);
    probe();
  }

  /* ---- na zkoušku ---- */

  function cell(verdict, off) {
    var td = document.createElement('td');
    td.className = 'v';
    var s = document.createElement('span');
    if (off) {
      s.className = 'pill off';
      s.textContent = 'vypnuto';
    } else {
      s.className = 'pill ' + (verdict.keep ? 'keep' : 'drop');
      s.textContent = verdict.keep ? 'projde' : 'zmizí';
      if (verdict.why) s.title = verdict.why;
    }
    td.appendChild(s);
    return td;
  }

  function probe() {
    var prefs = collect();
    var out = $('probeOut');
    out.textContent = '';

    lines($('probe').value).forEach(function (line) {
      var isUrl = /^https?:\/\//i.test(line);
      var listing = WTF.decide(isUrl ? { title: '', url: line, type: '' } : { title: line, url: '', type: '' }, prefs);
      var message = WTF.chatDecide({
        text: line,
        hasLink: /https?:\/\/|www\./i.test(line),
        author: '', profile: '', ratingCount: 1
      }, prefs);

      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.textContent = line;
      tr.appendChild(td);
      tr.appendChild(cell(listing));
      tr.appendChild(cell(message));

      var why = document.createElement('td');
      why.className = 'why';
      why.textContent = listing.why || message.why || '';
      tr.appendChild(why);
      out.appendChild(tr);
    });

    if (out.children.length) {
      var head = document.createElement('tr');
      ['', 'výpis', 'chat', ''].forEach(function (h) {
        var th = document.createElement('td');
        th.className = 'why';
        th.textContent = h;
        head.appendChild(th);
      });
      out.insertBefore(head, out.firstChild);
    }
  }

  function flash() {
    $('saved').classList.add('on');
    setTimeout(function () { $('saved').classList.remove('on'); }, 1400);
  }

  /* ---- start ---- */

  api.storage.local.get({ seenTypes: [] }, function (local) {
    var allTypes = KNOWN_TYPES.slice();
    ((local && local.seenTypes) || []).forEach(function (t) {
      if (allTypes.indexOf(t) === -1) allTypes.push(t);
    });

    WTF.migrate(api, function () {
      api.storage.local.get(WTF.DEFAULTS, function (got) {
        fill(Object.assign({}, WTF.DEFAULTS, got || {}), allTypes);
      });
    });

    $('save').addEventListener('click', function () {
      api.storage.local.set(collect(), flash);
    });

    $('reset').addEventListener('click', function () {
      api.storage.local.set(WTF.DEFAULTS, function () {
        fill(WTF.DEFAULTS, allTypes);
        flash();
      });
    });
  });

  document.addEventListener('input', probe);
  document.addEventListener('change', probe);

  function listRules(ul, rules) {
    rules.forEach(function (r) {
      var li = document.createElement('li');
      var code = document.createElement('code');
      code.textContent = r.id;
      li.appendChild(code);
      li.appendChild(document.createTextNode(' ' + r.why));
      ul.appendChild(li);
    });
  }
  listRules($('ruleList'), WTF.ruleInfo());
  listRules($('chatRuleList'), WTF.chatRuleInfo());
})();
