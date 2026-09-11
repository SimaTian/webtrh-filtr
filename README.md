# Webtrh filtr

Rozšíření do prohlížeče, které uklízí dvě místa na [webtrh.cz](https://webtrh.cz/):

1. tabulku **Nový obsah** (vyhodí inzeráty na holé domény a dotáhne další stránky,
   dokud není na obrazovce dost toho, co stojí za přečtení)
2. **Webtrh chat** (vyhodí vhozené odkazy a handlování s doménami)

Nic se nemaže. Skryté řádky i zprávy zůstávají ve stránce a tlačítkem se vrátí,
každý s poznámkou, které pravidlo ho schovalo.

Lišta si půjčuje vzhled od webtrhu: jejich odkazy, jejich přepínače, jejich
odstíny. Na stránce nemá nic křičet.

> Nezávislý nástroj. S provozovatelem webtrh.cz nemá nic společného a nikdo ho
> neschvaloval. Filtruje jenom to, co si zobrazíš ve vlastním prohlížeči.

## Instalace

**Chrome** > `chrome://extensions` > zapnout *Režim pro vývojáře* > *Načíst
rozbalené* > vybrat tuhle složku.

**Firefox** > `about:debugging#/runtime/this-firefox` > *Načíst dočasný doplněk* >
vybrat `manifest.json`. (Dočasný = zmizí po restartu. Natrvalo je potřeba podpis
z addons.mozilla.org.)

## Co filtr umí

### Výpis Nový obsah

| | |
|---|---|
| **Skrýt inzeráty na holé domény** | Hlavní věc. Prodej webu, e-shopu nebo projektu projde dál, i když má adresu v titulku. |
| **Brát i slabší shody** | Titulek je jenom název domény, nebo o ní mluví a nic dalšího nenabízí. |
| **Typy obsahu** | Prodej / Poptávka / Nabídka / Práce / Diskuse / Článek. |
| **Načítání** | Samo mačká *Načíst další*, dokud není `target` položek. Nepřihlášenému webtrh další stránku nepošle, filtr to pozná a přestane. |
| **Duplicity** | Stejný inzerát podruhé ve výpisu zmizí. |

### Chat

| | |
|---|---|
| **Skrýt zprávy s odkazem** | Zapnuté. Počítá se i holá adresa webu a e-mail. |
| **Skrýt handlování s doménami** | Zapnuté. Kdo sám nabízí nebo shání. |
| **Skrýt i řeči o doménách** | Vypnuté. Sebere i ty, kdo si na spam stěžují. |
| **Skrýt lidi bez hodnocení** | Účet, kterému zatím nikdo nic nepotvrdil. |
| **Ztlumení autoři** | U každé zprávy přibude tlačítko *ztlumit*, které autora doplní do seznamu. |

Sledovaná a ztlumená slova platí na obojí. Hledá se kus textu, bez ohledu na
diakritiku a velikost písmen. Řádek mezi lomítky je regulární výraz:

```
/^\[.*\]/                                 křik v hranaté závorce: [PRODÁM AUTOMATICKÝ E-SHOP]
/ready.?made|automatick\w* (e-?shop|eshop)/  ready-made a automatické e-shopy
/prod[áa]m .{0,20}domén/                   prodám něco domén
```

Diakritika ve vzoru je v pořádku, sundá se stejně jako v hledaném textu. Vzor,
který nejde přeložit, se tiše přeskočí, takže překlep filtr nerozbije.

## Jak to rozhoduje

Sada pojmenovaných pravidel v `classify.js`. Žádná síť, žádný model.

**U inzerátů** rozhoduje pořadí slov v titulku, protože co je zmíněné první, to se
prodává. *„Prémiová doména … pro SaaS“* je doména, *„E-shop se značkou … + 3×
prémiová doména“* je e-shop. Zmínka o provozu (tržby, výdělek, návštěvnost, marže,
Shopify) přebíjí všechno, to se neprodává doména.

**V chatu** rozhoduje mluvnická osoba. Kdo nabízí, píše o sobě („prodám“,
„v portfoliu máme“). Kdo si stěžuje, mluví o někom jiném („ten spam prodeje domén
za 100K“). Ten druhý je na chatu to lepší a filtr ho nechá být.

### Změřeno

Inzeráty si webtrh sám třídí do `/prodeje/prodej-domen/` a `/prodeje/prodej-webu/`.
Chat je 40 zpráv z úvodní stránky, oštítkovaných ručně. Stav k 11. 9. 2026:

```
prodej domén   : 196/202 zachyceno
prodej webů    :  32/32  ponecháno   ← ani jeden prodej webu omylem skrytý
poptávky/práce :   0/139 dotčeno
chat, výchozí  :  40/40  sedí
chat, handlování: 40/40  sedí
chat, adresy   :  40/40  sedí
```

Šest domén, co projde, jsou titulky, ze kterých to nepozná ani člověk
(*„Digitální monopol DB96/96DB, kompletní zrcadlový ekosystém“*).

Přepočítat:

```sh
python3 refresh-fixtures.py   # stáhne aktuální rozdělení inzerátů z webtrhu
node eval.js                  # exit 1, když se skryje prodej webu nebo špatná zpráva
```

V nastavení je navíc pole **Na zkoušku**: vložíš řádky a vidíš verdikt pro výpis
i pro chat, ještě než něco uložíš.

## Soubory

```
manifest.json         MV3, bez background scriptu, jediné právo je storage
classify.js           pravidla a rozhodování (sdílí stránka i nastavení)
content.js            napojení na tabulku a na chat, dotahování, lišty
content.css           to málo, co se nedá půjčit od webtrhu
options.html/js       nastavení a zkušební pole
eval.js               měření proti fixtures.json a chat-fixtures.json
fixtures.json         202 domén + 32 webů, z taxonomie webtrhu
chat-fixtures.json    40 zpráv z chatu, ruční štítky, autoři a adresy zástupné
refresh-fixtures.py   aktualizace fixtures.json
```

## Kde má hranice

* Řeší jen úvodní stránku, ne archivy `/prodeje/…`.
* Ve výpisu filtruje podle titulku a URL. Cenu ani autora řádek tabulky
  neobsahuje, takže „skrýt pod 5 000 Kč“ by znamenalo stahovat každý inzerát.
  V chatu autor k dispozici je, proto je ztlumení autorů jen tam.
* Dotahování jede přes vlastní tlačítko webtrhu, takže respektuje přihlášení
  i limity webu.
* Chatových zpráv je na měření málo. Když narazíš na zprávu, kterou filtr
  posoudí špatně, přidej ji do `chat-fixtures.json` se štítkem a spusť `node eval.js`.
  **Jména autorů, e-maily a adresy webů nahraď zástupnými** (`autor-01`,
  `jmeno@example.com`, `example.cz`), jako je tam mají ostatní. Pravidla čtou tvar
  textu, ne konkrétní jméno, takže se tím o nic nepřijde. Chat psali skuteční lidé
  a do repozitáře jejich kontakty nepatří.

## Licence

[0BSD](LICENSE). Dělej si s tím, co chceš. Nemusíš uvádět zdroj, nemusíš se ptát,
nemusíš nic zveřejňovat. Záruka žádná.

## Snímky

Ve složce `store/` jsou snímky obrazovky pro Chrome Web Store. Na `2-chat.png`
jsou jména pisatelů rozmazaná schválně: chat je sice veřejný, ale cizí jména do
cizího repozitáře nepatří. Ze stejného důvodu má `chat-fixtures.json` zástupné
autory i adresy.
