/* Webtrh filtr — https://webtrh.cz/
 *
 * Dva filtry na jedné stránce:
 *   1. tabulka „Nový obsah“ (skryje inzeráty na holé domény, dotahuje další)
 *   2. „Webtrh chat“ (skryje vhozené odkazy a handlování s doménami)
 *
 * Nic se nemaže. Skryté řádky i zprávy zůstávají ve stránce a jdou vrátit.
 */
(function () {
  'use strict';

  var api = (typeof chrome !== 'undefined' && chrome.storage) ? chrome : browser;  // Firefox: chrome = callbacky
  var prefs = Object.assign({}, WTF.DEFAULTS);
  var feed = null;
  var chat = null;

  /* ---------- společné ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function linkButton(text, onClick) {
    var b = el('button', 'wtf-link', text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // Vlastní přepínač, schválně NE jejich .checkbox-wrapper: ten má na body
  // delegovaný click s preventDefault() a checked přepíná přes .prop(), takže
  // událost change nikdy nepřijde a posluchač se nespustí.
  function switchBox(text, checked, onChange) {
    var l = el('label', 'wtf-switch');
    var i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = !!checked;
    i.addEventListener('change', function () { onChange(i.checked); });
    l.appendChild(i);
    l.appendChild(el('span', 'wtf-box'));
    l.appendChild(el('span', null, text));
    return l;
  }

  function whyTag(text, rule) {
    var s = el('span', 'wtf-why', text);
    s.title = 'pravidlo: ' + rule;
    return s;
  }

  function save(patch) {
    Object.assign(prefs, patch);
    try { api.storage.local.set(patch); } catch (e) { /* nevadí */ }
  }

  function settingsLink() {
    var a = el('a', 'wtf-link', 'nastavení');
    a.href = api.runtime.getURL('options.html');
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  /* ---------- 1. tabulka Nový obsah ---------- */

  feed = {
    wrap: null, tbody: null, bar: null, seen: null, loading: false, loads: 0,

    read: function (tr) {
      var a = tr.querySelector('.home-novy-obsah-title a, td a[href]');
      if (!a) return null;
      var status = tr.querySelector('.status');
      return {
        title: (a.textContent || '').replace(/\s+/g, ' ').trim(),
        url: a.href || '',
        type: status ? (status.textContent || '').replace(/\s+/g, ' ').trim() : ''
      };
    },

    row: function (tr) {
      var item = feed.read(tr);
      if (!item) return;

      var v;
      if (prefs.dedupe && feed.seen[item.url] && feed.seen[item.url] !== tr) {
        v = { keep: false, rule: 'duplicita', why: 'stejný inzerát je ve výpisu výš' };
      } else {
        if (!feed.seen[item.url]) feed.seen[item.url] = tr;
        v = WTF.decide(item, prefs);
      }

      tr.classList.toggle('wtf-drop', !v.keep);
      tr.dataset.wtfRule = v.rule || '';
      tr.dataset.wtfType = item.type || '';

      var old = tr.querySelector('.wtf-why');
      if (old) old.remove();
      if (!v.keep) {
        var host = tr.querySelector('.home-novy-obsah-title') || tr.querySelector('td');
        if (host) host.appendChild(whyTag(v.why, v.rule));
      }
    },

    all: function () {
      feed.seen = {};
      var rows = feed.tbody.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) feed.row(rows[i]);
      document.body.classList.toggle('wtf-show-feed', !!prefs.showHidden);
      feed.remember();
      feed.draw();
    },

    counts: function () {
      var rows = feed.tbody.querySelectorAll('tr');
      var c = { kept: 0, hidden: 0, domains: 0, types: {} };
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.classList.contains('wtf-drop')) {
          c.hidden++;
          if ((r.dataset.wtfRule || '').indexOf('domena:') === 0) c.domains++;
        } else {
          c.kept++;
        }
        if (r.dataset.wtfType) c.types[r.dataset.wtfType] = 1;
      }
      return c;
    },

    // Popisky sloupce Typ si pamatujeme, ať je nastavení nemusí hádat.
    remember: function () {
      try {
        var seen = Object.keys(feed.counts().types);
        if (!seen.length) return;
        api.storage.local.get({ seenTypes: [] }, function (got) {
          var merged = (got && got.seenTypes) || [];
          var added = false;
          seen.forEach(function (t) { if (merged.indexOf(t) === -1) { merged.push(t); added = true; } });
          if (added) api.storage.local.set({ seenTypes: merged.sort() });
        });
      } catch (e) { /* nevadí */ }
    },

    button: function () {
      var more = feed.wrap.querySelector('.js-home-novy-obsah-more');
      if (more && more.offsetParent === null) return null;
      var btn = feed.wrap.querySelector('.js-home-novy-obsah-load');
      return (btn && !btn.disabled) ? btn : null;
    },

    grew: function (before, ms) {
      return new Promise(function (done) {
        var t0 = Date.now();
        (function poll() {
          if (feed.tbody.children.length > before) return done(true);
          if (Date.now() - t0 > ms) return done(false);
          setTimeout(poll, 150);
        })();
      });
    },

    topUp: async function (byHand) {
      if (feed.loading || (!prefs.autoload && !byHand)) return;
      feed.loading = true;
      feed.draw();
      try {
        var guard = 0;
        while (feed.counts().kept < prefs.target && feed.loads < prefs.maxLoads && guard++ < 40) {
          var btn = feed.button();
          if (!btn) break;
          var before = feed.tbody.children.length;
          btn.click();
          feed.loads++;
          // Nepřihlášenému webtrh další stránku nepošle. Nečekáme donekonečna.
          if (!await feed.grew(before, 8000)) break;
          await new Promise(function (r) { setTimeout(r, 120); });
        }
      } finally {
        feed.loading = false;
        feed.all();
      }
    },

    draw: function () {
      var c = feed.counts();
      var bar = feed.bar;
      bar.textContent = '';

      var left = el('div', 'wtf-side');
      left.appendChild(el('span', 'wtf-count',
        c.kept + ' ' + WTF.plural(c.kept, 'položka', 'položky', 'položek')
        + (c.hidden ? ', skryto ' + c.hidden + (c.domains ? ' (z toho ' + c.domains + ' ' + WTF.plural(c.domains, 'doména', 'domény', 'domén') + ')' : '') : '')));
      if (feed.loading) left.appendChild(el('span', 'wtf-count', 'načítám…'));

      var right = el('div', 'wtf-side');
      right.appendChild(switchBox('skrýt domény', prefs.hideDomainSales, function (v) {
        save({ hideDomainSales: v });
        feed.loads = 0;
        feed.all();
        feed.topUp();
      }));

      if (c.hidden) {
        right.appendChild(linkButton(prefs.showHidden ? 'skrýt zpět' : 'ukázat skryté (' + c.hidden + ')', function () {
          save({ showHidden: !prefs.showHidden });
          feed.all();
        }));
      }
      if (feed.button()) {
        right.appendChild(linkButton('načíst další', function () {
          feed.loads = 0;
          feed.topUp(true);
        }));
      }
      right.appendChild(settingsLink());

      bar.appendChild(left);
      bar.appendChild(right);
    },

    init: function () {
      feed.wrap = document.querySelector('.js-home-novy-obsah');
      feed.tbody = document.querySelector('.js-home-novy-obsah-rows');
      if (!feed.wrap || !feed.tbody) return false;

      feed.bar = el('div', 'wtf-bar');
      var table = feed.wrap.querySelector('.max-width-table') || feed.tbody.closest('table');
      feed.wrap.insertBefore(feed.bar, table);

      new MutationObserver(function (muts) {
        var added = false;
        muts.forEach(function (m) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var n = m.addedNodes[i];
            if (n.nodeType === 1 && n.tagName === 'TR') { feed.row(n); added = true; }
          }
        });
        if (added) feed.draw();
      }).observe(feed.tbody, { childList: true });
      return true;
    }
  };

  /* ---------- 2. Webtrh chat ---------- */

  chat = {
    box: null, list: null, bar: null,

    read: function (m) {
      var user = m.querySelector('.homepage-chat__user');
      var text = m.querySelector('.homepage-chat__text');
      var count = m.querySelector('.homepage-chat__rating-count');
      var body = text ? (text.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return {
        text: body,
        hasLink: !!(text && text.querySelector('a')) || /https?:\/\/|www\./i.test(body),
        author: user ? (user.textContent || '').trim() : '',
        profile: user ? (user.getAttribute('href') || '') : '',
        ratingCount: count ? (parseInt((count.textContent || '').replace(/\D+/g, ''), 10) || 0) : 0
      };
    },

    one: function (m) {
      var msg = chat.read(m);
      var v = prefs.chatEnabled ? WTF.chatDecide(msg, prefs) : { keep: true, rule: '', why: '' };

      m.classList.toggle('wtf-drop', !v.keep);
      m.dataset.wtfRule = v.rule || '';

      var old = m.querySelector('.wtf-why');
      if (old) old.remove();
      var head = m.querySelector('.homepage-chat__head');
      if (!v.keep && head) head.appendChild(whyTag(v.why, v.rule));

      if (head && !m.querySelector('.wtf-mute') && msg.author) {
        var mute = linkButton('ztlumit', function () {
          var who = msg.profile || msg.author;
          var list = (prefs.chatMuteAuthors || []).slice();
          if (list.indexOf(who) === -1) list.push(who);
          save({ chatMuteAuthors: list });
          chat.all();
        });
        mute.className = 'wtf-mute';
        mute.title = 'schovat všechno od ' + msg.author;
        head.appendChild(mute);
      }
    },

    all: function () {
      var items = chat.list.querySelectorAll('.homepage-chat__message');
      for (var i = 0; i < items.length; i++) chat.one(items[i]);
      document.body.classList.toggle('wtf-show-chat', !!prefs.chatShowHidden);
      chat.draw();
    },

    draw: function () {
      var items = chat.list.querySelectorAll('.homepage-chat__message');
      var hidden = 0;
      for (var i = 0; i < items.length; i++) if (items[i].classList.contains('wtf-drop')) hidden++;
      var shown = items.length - hidden;

      chat.bar.textContent = '';
      var left = el('div', 'wtf-side');
      left.appendChild(el('span', 'wtf-count',
        shown + ' ' + WTF.plural(shown, 'zpráva', 'zprávy', 'zpráv') + (hidden ? ', skryto ' + hidden : '')));

      var right = el('div', 'wtf-side');
      right.appendChild(switchBox('filtrovat', prefs.chatEnabled, function (v) {
        save({ chatEnabled: v });
        chat.all();
      }));
      if (hidden) {
        right.appendChild(linkButton(prefs.chatShowHidden ? 'skrýt zpět' : 'ukázat (' + hidden + ')', function () {
          save({ chatShowHidden: !prefs.chatShowHidden });
          chat.all();
        }));
      }

      chat.bar.appendChild(left);
      chat.bar.appendChild(right);
    },

    init: function () {
      chat.box = document.querySelector('.homepage-chat');
      chat.list = document.querySelector('.homepage-chat__messages');
      if (!chat.box || !chat.list) return false;

      chat.bar = el('div', 'wtf-bar');
      chat.box.insertBefore(chat.bar, chat.list);

      // Chat se sám doptává na nové zprávy a vkládá je nahoru.
      new MutationObserver(function (muts) {
        var added = false;
        muts.forEach(function (m) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var n = m.addedNodes[i];
            if (n.nodeType === 1 && n.classList.contains('homepage-chat__message')) { chat.one(n); added = true; }
          }
        });
        if (added) chat.draw();
      }).observe(chat.list, { childList: true });
      return true;
    }
  };

  /* ---------- start ---------- */

  function init() {
    var hasFeed = feed.init();
    var hasChat = chat.init();
    if (!hasFeed && !hasChat) return;

    WTF.migrate(api, function () {
      api.storage.local.get(WTF.DEFAULTS, function (got) {
        prefs = Object.assign({}, WTF.DEFAULTS, got || {});
        if (hasFeed) { feed.all(); feed.topUp(); }
        if (hasChat) chat.all();
      });
    });

    try {
      api.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        Object.keys(changes).forEach(function (k) { prefs[k] = changes[k].newValue; });
        if (hasFeed) { feed.loads = 0; feed.all(); feed.topUp(); }
        if (hasChat) chat.all();
      });
    } catch (e) { /* nevadí */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
