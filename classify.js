/* Webtrh filtr — klasifikace řádků tabulky "Nový obsah" na webtrh.cz.
 *
 * Žádná síť, žádná magie: jen pojmenovaná pravidla, která umí každý řádek
 * zdůvodnit. Pravidlo, které řádek skrylo, je vidět v UI i v nastavení.
 *
 * Kalibrováno proti vlastní taxonomii webtrh.cz (2026-09-11):
 *   /prodeje/prodej-domen/  202 inzerátů = pozitivní třída
 *   /prodeje/prodej-webu/    32 inzerátů = negativní třída
 * Naměřeno: viz eval.js v této složce (`node eval.js`).
 */
(function (root) {
  'use strict';

  var WTF = {};

  /* ---------- text ---------- */

  WTF.norm = function (s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[   ]/g, ' ')
      .replace(/[‐-―−]/g, '-')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  // https://webtrh.cz/prodej/izolacie-sk/ -> {section:'prodej', text:'izolacie sk'}
  WTF.slugText = function (url) {
    var m = /^(?:https?:\/\/[^/]+)?\/([a-z_]+)\/([^/?#]+)/i.exec(String(url || ''));
    if (!m) return { section: '', text: '' };
    var slug = m[2];
    try { slug = decodeURIComponent(slug); } catch (e) { /* ponech */ }
    return { section: m[1].toLowerCase(), text: WTF.norm(slug.replace(/-/g, ' ')) };
  };

  /* ---------- slovníky ---------- */

  var TLD = ['cz','sk','com','eu','net','org','info','shop','online','store','biz',
    'io','ai','dev','app','co','pl','de','at','hu','in','me','tv','cc','xyz','pro',
    'fun','life','space','tech','agency','group','team','works','zone','cloud',
    'site','blog','email','name','digital','media','click','link'].join('|');

  // "Prodávám něco, co BĚŽÍ" — tvrdé stopky, přebijí i zmínku o doméně.
  // Pozor: jen PODSTATNÁ JMÉNA provozu. Přídavná jména („ziskový“, „zákaznický“)
  // popisují potenciál domény, ne tržby, a patří mezi slabá slova níž.
  var SITE_STRONG = [
    'trzb\\w*','obrat\\w*','vydelek','vydelky','vydelku','navstevnost\\w*','navstevnik\\w*',
    'marz\\w*','zisk','zisku','zisky','ziskem','mrr','prijem','prijmy','objednavk\\w*',
    'zakaznik\\w*','zakazniku','klientu','klienty','klientela',
    'skladem','dropshipping','fulfillment','odbyt','predplatitel\\w*','registrovan\\w*',
    'bezici','fungujic\\w*','ready made','automatizovan\\w*','automaticky','automatickeho',
    'vcetne s r o','s r o','sro',
    'shopify','woocommerce','wordpress','shoptet','prestashop','upgates','wix','webnode'
  ];
  // Slova, která jen popisují ÚČEL (doména „pro e-shop“). Rozhoduje pořadí ve větě.
  var SITE_WEAK = [
    'e ?-? ?shop\\w*','eshop\\w*','webu','weby','webem','webovych? strank\\w*','stranky','stranek',
    'portal\\w*','projekt\\w*','saas','aplikac\\w*','platform\\w*','blogu?','magazin\\w*',
    'srovnavac\\w*','katalog\\w*','gastromap\\w*','map[ay]','ekosystem\\w*','komunit\\w*',
    'kompletni','s obsahem','znackou','zavedeny','zavedeneho','zavedeneho','hotovy','hotoveho',
    'ziskov\\w*','zakaznick\\w*','vydelecn\\w*'
  ];

  var RE_STRONG = new RegExp('\\b(?:' + SITE_STRONG.join('|') + ')\\b');
  var RE_WEAK = new RegExp('\\b(?:' + SITE_WEAK.join('|') + ')\\b');
  var DOMWORD = /\b(?:domen\w*|domain\w*)\b/;

  // Konstrukce, kterými se inzeruje HOLÁ doména.
  var RULES = [
    { id: 'domena-pro', why: 'nabízí doménu pro nějaký obor',
      re: /\bdomen\w*\s+(?:je\s+)?(?:pro|na|k|urcen\w*|vhodn\w*|idealni)\b/ },
    { id: 'prodej-domeny', why: 'prodej nebo koupě domény',
      re: /\b(?:prodam|prodej|prodeje|prodavam|nabizim|nabidka|koupim|kupim|hledam|drazba|aukce)\b(?:\s+\S+){0,3}\s+domen/ },
    { id: 'domena-k-prodeji', why: 'doména k prodeji',
      re: /\bdomen\w*\b(?:\s+\S+){0,2}\s+(?:na prodej|k prodeji|k pronajmu|levne|ihned|volna)\b/ },
    { id: 'premiova-domena', why: 'prémiová, volná nebo krátká doména',
      re: /\b(?:premi\w*|volna|volne|volnych|expirovan\w*|zaparkovan\w*|kratk\w*|\d+ ?(?:pismenn|znak)\w*|top|silna|silne|silny|brandabl\w*|catchy|generick\w*|klicov\w*|exkluzivn\w*|vyjimecn\w*|kvalitn\w*|zajimav\w*|super|skvel\w*|stari|stara|stare)\b(?:\s+\.?[a-z]{2,6})?\s+domen/ },
    { id: 'balik-domen', why: 'balík nebo portfolio domén',
      re: /\b(?:balik|balicek|sada|portfolio|kolekce|skupina|par)\w*[^|]{0,40}?\bdomen|\bdomen\w*[^|]{0,25}?\b(?:balik|balicek|portfolio)/ },
    { id: 'domena-tld', why: 'doména i s koncovkou',
      re: new RegExp('\\b\\.?(?:' + TLD + ')\\s+domen|\\bdomen\\w*\\s+\\.?(?:' + TLD + ')\\b') },
    { id: 'znakova-domena', why: 'doména popsaná tvarem, třeba 3znak',
      re: /\b\d ?(?:znak|pismen)\w*\b|\b(?:troj|ctyr|peti)(?:znak|pismen)\w*\b|\b(?:dve|tri|ctyri|pet|sest) pismen\w*\b/ }
  ];

  var BARE_DOMAIN = new RegExp('\\b[a-z0-9][a-z0-9-]{1,40}\\.(?:' + TLD + ')\\b', 'g');
  // Slug ztrácí tečku: "izolacie.sk" -> "izolacie sk". Bez tečky je to slabý důkaz,
  // takže jen pro TLD, které na webtrhu reálně chodí — jinak „nastavení online“
  // nebo „texty pro váš web“ vypadají jako doména.
  var SLUG_TLD = 'cz|sk|com|eu|net|org|info|io|de|pl|at|hu|biz';
  var SLUG_DOMAIN = new RegExp('\\b[a-z0-9][a-z0-9-]{1,40} (?:' + SLUG_TLD + ')\\b', 'g');

  function firstIndex(re, hay) {
    var m = re.exec(hay);
    return m ? m.index : -1;
  }

  // Zbyde po odmazání názvů domén ještě nějaký text?
  function residueWords(text, re) {
    var rest = text.replace(re, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    return rest ? rest.split(' ').filter(function (w) { return w.length > 1; }).length : 0;
  }

  /**
   * Je to inzerát na doménu (ne na web / e-shop / projekt)?
   * @param item {title, url}
   * @returns {{hit:boolean, rule:string, why:string, confidence:'high'|'medium'}}
   */
  WTF.domainSale = function (item) {
    var title = WTF.norm(item && item.title);
    var slug = WTF.slugText(item && item.url);
    var hay = title + ' | ' + slug.text;

    // 1) Běžící aktivum přebíjí všechno ostatní.
    if (RE_STRONG.test(hay)) {
      return { hit: false, rule: 'aktivum', why: 'popisuje běžící web nebo e-shop', confidence: 'high' };
    }

    // 2) Nejdřívější zmínka rozhoduje: co je v titulku první, to se prodává.
    //    „E-shop … + 3x prémiová doména“ = e-shop.  „Prémiová doména … pro SaaS“ = doména.
    var best = null;
    for (var i = 0; i < RULES.length; i++) {
      var at = firstIndex(RULES[i].re, hay);
      if (at !== -1 && (!best || at < best.at)) best = { at: at, rule: RULES[i] };
    }
    var weakAt = firstIndex(RE_WEAK, hay);

    if (best && (weakAt === -1 || best.at <= weakAt)) {
      return { hit: true, rule: best.rule.id, why: best.rule.why, confidence: 'high' };
    }
    if (weakAt !== -1) {
      return { hit: false, rule: 'aktivum', why: 'prodává web, doména je jen přívažek', confidence: 'high' };
    }

    // 3) Titulek je v podstatě jen název domény: "izolacie.sk", "cena.cz".
    //    Platí JEN pro inzeráty v sekci /prodej/ — u poptávky nebo nabídky služby
    //    je název domény v titulku adresa, ne zboží.
    if (slug.section === 'prodej' || slug.section === '') {
      if (title && title.match(BARE_DOMAIN) && residueWords(title, BARE_DOMAIN) <= 2) {
        return { hit: true, rule: 'holy-nazev', why: 'titulek je jen název domény', confidence: 'medium' };
      }
      if (slug.text && slug.text.match(SLUG_DOMAIN) && residueWords(slug.text, SLUG_DOMAIN) <= 1) {
        return { hit: true, rule: 'holy-nazev', why: 'titulek je jen název domény', confidence: 'medium' };
      }
    }

    if (DOMWORD.test(hay)) {
      return { hit: true, rule: 'slovo-domena', why: 'mluví o doméně a nic jiného nenabízí', confidence: 'medium' };
    }

    return { hit: false, rule: '', why: '', confidence: 'high' };
  };


  /* ---------- migrace nastavení ---------- */

  // Uložené nastavení vždycky přebije výchozí hodnotu v kódu. Když se tedy
  // výchozí hodnota změní, komu se jednou uložila ta stará, ten novou nikdy
  // neuvidí. Proto se klíč, jehož výchozí hodnota se změnila, jednorázově
  // smaže a napříště se bere z kódu.
  WTF.PREFS_VERSION = 2;
  WTF.CHANGED_DEFAULTS = {
    2: ['chatHideLinks']   // vhozené odkazy se teď schovávají rovnou
  };

  WTF.migrate = function (api, done) {
    try {
      api.storage.local.get({ prefsVersion: 0 }, function (got) {
        var from = (got && got.prefsVersion) || 0;
        if (from >= WTF.PREFS_VERSION) return done();

        var drop = [];
        for (var v = from + 1; v <= WTF.PREFS_VERSION; v++) {
          (WTF.CHANGED_DEFAULTS[v] || []).forEach(function (k) { drop.push(k); });
        }
        var stamp = function () { api.storage.local.set({ prefsVersion: WTF.PREFS_VERSION }, done); };
        if (drop.length) api.storage.local.remove(drop, stamp); else stamp();
      });
    } catch (e) {
      done();
    }
  };

  // Slovo se hledá jako kus textu. Když ho ale napíšeš mezi lomítka, bere se
  // jako regulární výraz: /^\[.*\]/ chytí každý titulek, co začíná křikem
  // v hranatých závorkách.
  //
  // Diakritiku ze vzoru sundáme, protože hledaný text ji taky nemá. Malá a
  // velká písmena řeší příznak i, ne převod vzoru: v regulárním výrazu je
  // \S něco úplně jiného než \s.
  var reCache = {};

  WTF.asRegExp = function (pattern) {
    var raw = String(pattern == null ? '' : pattern).trim();
    if (raw.length < 3 || raw.charAt(0) !== '/') return null;
    var end = raw.lastIndexOf('/');
    if (end < 1) return null;

    if (!(raw in reCache)) {
      var body = raw.slice(1, end);
      var flags = raw.slice(end + 1);
      if (!/^[gimsuy]*$/.test(flags)) { reCache[raw] = null; return null; }
      if (flags.indexOf('i') === -1) flags += 'i';
      flags = flags.replace(/g/g, '');          // g si pamatuje pozici, tady by škodil
      try {
        reCache[raw] = new RegExp(body.normalize('NFD').replace(/[̀-ͯ]/g, ''), flags);
      } catch (e) {
        reCache[raw] = null;                    // rozbitý vzor se prostě přeskočí
      }
    }
    return reCache[raw];
  };

  function anyMatch(list, hay) {
    for (var i = 0; i < (list || []).length; i++) {
      var re = WTF.asRegExp(list[i]);
      if (re) {
        if (re.test(hay)) return list[i];
        continue;
      }
      var t = WTF.norm(list[i]);
      if (t && hay.indexOf(t) !== -1) return list[i];
    }
    return null;
  }

  /* ---------- chat ---------- */

  // Adresa webu ve zprávě: "neco.cz", "www.neco.com", "https://…".
  var CHAT_DOMAIN = new RegExp('(?:https?:\\/\\/|www\\.)?\\b[a-z0-9][a-z0-9-]{1,40}\\.(?:' + TLD + ')\\b');
  var CHAT_MAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/;
  var CHAT_URL = /https?:\/\/|www\./;

  // Kdo nabízí, mluví o sobě: "prodám", "koupím", "v portfoliu máme".
  // Kdo si stěžuje, mluví o někom jiném: "ten spam prodeje domén za 100K".
  // Tenhle rozdíl drží pravidla dál od lidí, co na doménový spam nadávají.
  var CHAT_OFFER = /\b(prodam|prodavam|prodame|nabizim|nabizime|koupim|kupim|kupuji|odkoupim|poptavam|drzim|vlastnim|pronajmu|registruji)\b|\b(?:v )?portfoliu (?:mame|mam)\b|\bmame v portfoliu\b|\b(na prodej|k prodeji|k mani|cena dohodou|cena k jednani|top nabidka|volna domena|volne domeny|posledni kus)\b/;
  // Pomlčka místo mezery: ceny v adresách typu /8-x-eu-domena-za-2000-kc/.
  var CHAT_PRICE = /\b\d+[\s.,-]?\d*[\s-]?(?:kc|czk|kk|tis|tisic|mega|mio)\b|\bza[\s-]\d/;

  var CHAT_RULES = [
    { id: 'domena-nabidka', why: 'sám nabízí nebo shání doménu', weak: false,
      test: function (t) { return (DOMWORD.test(t) || CHAT_DOMAIN.test(t)) && CHAT_OFFER.test(t); } },
    { id: 'domena-cena', why: 'doména s cenovkou', weak: false,
      test: function (t) { return DOMWORD.test(t) && CHAT_DOMAIN.test(t) && CHAT_PRICE.test(t); } },
    { id: 'domena-rec', why: 'řeč o doménách', weak: true,
      test: function (t) { return DOMWORD.test(t); } }
  ];

  // Odkaz, holá adresa i e-mail. Vhozená adresa bývá inzerát bez inzerátu.
  WTF.chatHasAddress = function (msg) {
    var t = WTF.norm(msg.text);
    return !!msg.hasLink || CHAT_URL.test(t) || CHAT_MAIL.test(t) || CHAT_DOMAIN.test(t);
  };

  /**
   * Zpráva z chatu na homepage.
   * @param msg {text, hasLink, author, profile, ratingCount}
   * @returns {{keep:boolean, rule:string, why:string}}
   */
  WTF.chatDecide = function (msg, prefs) {
    var p = Object.assign({}, WTF.DEFAULTS, prefs || {});
    var text = WTF.norm(msg.text);
    var who = WTF.norm(msg.author) + ' ' + WTF.norm(msg.profile);

    if (anyMatch(p.pin, text + ' ' + who)) {
      return { keep: true, rule: 'sledovane', why: 'sledované slovo' };
    }

    var mutedAuthor = anyMatch(p.chatMuteAuthors, who);
    if (mutedAuthor) {
      return { keep: false, rule: 'autor', why: 'ztlumený autor (' + mutedAuthor + ')' };
    }

    var mutedWord = anyMatch(p.mute, text);
    if (mutedWord) {
      return { keep: false, rule: 'ztlumene', why: 'ztlumené slovo „' + mutedWord + '“' };
    }

    if (p.chatHideLinks && WTF.chatHasAddress(msg)) {
      return { keep: false, rule: 'odkaz', why: 'vložená adresa nebo odkaz' };
    }

    for (var i = 0; i < CHAT_RULES.length; i++) {
      var on = CHAT_RULES[i].weak ? p.chatHideDomainChat : p.chatHideDomainTalk;
      if (on && CHAT_RULES[i].test(text)) {
        return { keep: false, rule: 'domena:' + CHAT_RULES[i].id, why: CHAT_RULES[i].why };
      }
    }

    if (p.chatHideUnrated && msg.ratingCount === 0) {
      return { keep: false, rule: 'bez-hodnoceni', why: 'účet bez hodnocení' };
    }

    return { keep: true, rule: '', why: '' };
  };

  WTF.chatRuleInfo = function () {
    return CHAT_RULES.map(function (r) { return { id: r.id, why: r.why }; });
  };

  /* ---------- čeština ---------- */

  // 1 řádek / 2 řádky / 5 řádků
  WTF.plural = function (n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  };

  /* ---------- uživatelská rozhodnutí ---------- */

  WTF.DEFAULTS = {
    hideDomainSales: true,
    hideMediumConfidence: true,   // brát i slabší shody (holý název, samotné slovo „doména“)
    hiddenTypes: [],              // popisky sloupce Typ: "Prodej", "Poptávka", …
    mute: [],                     // substringy -> skrýt
    pin: [],                      // substringy -> vždy nechat (přebíjí vše)
    onlyPinned: false,            // ukázat POUZE řádky se sledovaným slovem
    dedupe: true,                 // stejný inzerát podruhé ve výpisu = skrýt

    // chat na homepage
    chatEnabled: true,
    chatHideLinks: true,          // vhozený odkaz = inzerát, co se nikam nevešel
    chatHideDomainTalk: true,     // sám nabízí nebo shání
    chatHideDomainChat: false,    // i řeči o doménách, včetně nadávání na spam
    chatHideUnrated: false,       // účet, kterému nikdo nic nepotvrdil
    chatMuteAuthors: [],          // jména nebo adresy profilů
    chatShowHidden: false,
    autoload: true,
    target: 15,                   // kolik zajímavých řádků chci vidět
    maxLoads: 8,                  // strop kliknutí na „Načíst další“
    showHidden: false
  };

  /**
   * @param item {title, url, type}  type = popisek sloupce Typ
   * @returns {{keep:boolean, rule:string, why:string}}
   */
  WTF.decide = function (item, prefs) {
    var p = Object.assign({}, WTF.DEFAULTS, prefs || {});
    var hay = WTF.norm(item.title) + ' ' + WTF.slugText(item.url).text + ' ' + WTF.norm(item.type);

    var pinned = anyMatch(p.pin, hay);
    if (pinned) return { keep: true, rule: 'sledovane', why: 'sledované slovo „' + pinned + '“' };

    if (p.onlyPinned && (p.pin || []).length) {
      return { keep: false, rule: 'jen-sledovane', why: 'režim „jen sledovaná slova“' };
    }

    var muted = anyMatch(p.mute, hay);
    if (muted) return { keep: false, rule: 'ztlumene', why: 'ztlumené slovo „' + muted + '“' };

    var type = WTF.norm(item.type);
    if (type && (p.hiddenTypes || []).some(function (t) { return WTF.norm(t) === type; })) {
      return { keep: false, rule: 'typ', why: 'skrytý typ „' + item.type + '“' };
    }

    if (p.hideDomainSales) {
      var d = WTF.domainSale(item);
      if (d.hit && (d.confidence === 'high' || p.hideMediumConfidence)) {
        return { keep: false, rule: 'domena:' + d.rule, why: d.why };
      }
    }

    return { keep: true, rule: '', why: '' };
  };

  // Pro nastavení: seznam pravidel tak, jak jsou v kódu, bez opisování.
  WTF.ruleInfo = function () {
    return RULES.map(function (r) { return { id: r.id, why: r.why }; }).concat([
      { id: 'holy-nazev', why: 'titulek je jen název domény, slabší shoda' },
      { id: 'slovo-domena', why: 'mluví o doméně a nic nenabízí, slabší shoda' },
      { id: 'aktivum', why: 'nechat, popisuje běžící web nebo e-shop' }
    ]);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = WTF;
  root.WTF = WTF;
})(typeof globalThis !== 'undefined' ? globalThis : this);
