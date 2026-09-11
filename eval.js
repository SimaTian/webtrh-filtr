/* Změří klasifikátor proti taxonomii webtrhu:  node eval.js
 *
 * fixtures.json = URL inzerátů, které webtrh sám zařadil do
 *   /prodeje/prodej-domen/  (mají zmizet)   vs
 *   /prodeje/prodej-webu/   (mají zůstat)
 * Aktualizace: python3 refresh-fixtures.py
 *
 * Pozn.: místo skutečného titulku se tu používá slug z URL (titulky archiv
 * u domén neukazuje). Slug je titulek bez diakritiky a interpunkce, takže
 * naměřené číslo je spíš spodní odhad.
 */
const WTF = require('./classify.js');
const fx = require('./fixtures.json');

function check(paths, expectHit) {
  const wrong = [];
  const rules = {};
  for (const path of paths) {
    const url = 'https://webtrh.cz/' + path + '/';
    const title = WTF.slugText(url).text;
    const d = WTF.domainSale({ title, url });
    rules[d.rule || '(žádné)'] = (rules[d.rule || '(žádné)'] || 0) + 1;
    if (d.hit !== expectHit) wrong.push([path, d.rule, d.confidence]);
  }
  return { wrong, rules, n: paths.length };
}

const dom = check(fx.domains, true);
const web = check(fx.websites, false);

console.log(`prodej domén : ${dom.n - dom.wrong.length}/${dom.n} zachyceno`);
dom.wrong.forEach(w => console.log('   uniklo ', w[0]));
console.log(`prodej webů  : ${web.n - web.wrong.length}/${web.n} ponecháno`);
web.wrong.forEach(w => console.log('   SKRYTO ', w[0], '|', w[1], w[2]));
console.log('\npravidla:', dom.rules);

/* ---- chat ---- */

const chat = require('./chat-fixtures.json').messages;

function chatRun(prefs, label, expect) {
  const wrong = [];
  for (const m of chat) {
    const v = WTF.chatDecide({ text: m.text, hasLink: m.hasLink, author: m.author, profile: '', ratingCount: m.rating }, prefs);
    if (v.keep === expect(m)) wrong.push([m.id, m.author, v.rule, m.text.slice(0, 60)]);
  }
  console.log(`\n${label}: ${chat.length - wrong.length}/${chat.length} sedí`);
  wrong.forEach(w => console.log('   ŠPATNĚ', w[0], w[1], '|', w[2] || '(prošlo)', '|', w[3]));
  return wrong.length;
}

let bad = web.wrong.length;
// Výchozí: vhozené adresy pryč, a k tomu ten, kdo sám nabízí doménu.
// Nadávání na doménový spam zůstává, to je na chatu to lepší.
bad += chatRun({}, 'chat, výchozí', m => m.trade || m.address);
// Samotné přepínače.
bad += chatRun({ chatHideLinks: false }, 'chat, jen handlování', m => m.trade);
bad += chatRun({ chatHideDomainTalk: false }, 'chat, jen adresy', m => m.address);

process.exit(bad ? 1 : 0);   // skrytý prodej webu nebo špatná zpráva = chyba, která bolí
