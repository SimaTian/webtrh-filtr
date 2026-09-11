# Webtrh filtr

Rozšíření do prohlížeče, které uklízí dvě místa na [webtrh.cz](https://webtrh.cz/):

1. tabulku **Nový obsah** (vyhodí inzeráty na holé domény a načte další položky, aby tabulka nebyla zbytečně prázdná)
2. **Webtrh chat** (vyhodí vhozené odkazy a handlování s doménami)

V obou případech je možné filtr rozšířit přes regexy. 

Nic se nemaže. Vše zůstane na místě a je možné si skryté položky prohlédnout.

Lišta si půjčuje vzhled od webtrhu: jejich odkazy, jejich přepínače, jejich
odstíny. Snaha je, aby přirozeně zapadla do layoutu a nerušila.

> Nezávislý nástroj. S provozovatelem webtrh.cz nemá nic společného a nikdo ho
> neschvaloval. Je to čistě moje reakce na doménový spam.

## Instalace

**Chrome** > `chrome://extensions` > zapnout *Režim pro vývojáře* > *Načíst
rozbalené* > vybrat tuhle složku.

**Firefox** > `about:debugging#/runtime/this-firefox` > *Načíst dočasný doplněk* >
vybrat `manifest.json`. (Dočasný = zmizí po restartu. Natrvalo je potřeba podpis
z addons.mozilla.org.)

- addon pro chrome je v review. Pokud bude zájem, pokusím se i o Mozillu, ale tam jsem to ještě nikdy nezkoušel.

## Co filtr umí

### Tabulka Nový obsah

 - Skryje všechny inzeráty na prodej domén
 - Tento filtr je možno rozšířit či omezit pomocí regexů
 - Skryje duplicitní inzeráty (když se někomu třese ruka a odpálí tu samou inzerci vícekrát)
 - Možnost filtrovat podle typu

### Chat

- skryje všechny zprávy obsahující aktivní odkaz
- skryje všechny nabídky týkající se domén
- banlist na autory s možností banu jedním klikem (skryje veškeré jejich správy)
- sdílí allow list a banlist na klíčová slova (a regexy) s tabulkou Nového Obsahu


### Soubory

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

* Řeší jen úvodní stránku. Archivy `/prodeje/…` nechává být.
* Ve výpisu filtruje podle titulku a URL. Cenu ani autora řádek tabulky
  neobsahuje, takže „skrýt pod 5 000 Kč“ by znamenalo stahovat každý inzerát.
  V chatu autor k dispozici je, proto je ztlumení autorů jen tam.
* Načítání dalších položek využívá vlastní tlačítko webtrhu, takže rozšíření respektuje přihlášení
  i limity webu.

## Licence

[0BSD](LICENSE). Mouchy snězte si mě. Rozšíření je nabízeno bez jakéhokoliv omezení a bez jakékoliv záruky. Kód je poctivý AI slop, je ho dohromady jen pár set řádek. Kdo mu nevěří, ať si ho přečte, nebo ho předhodí svému agentovi.

## Snímky

Ve složce `store/` jsou snímky obrazovky pro Chrome Web Store. Na `2-chat.png`
jsou jména pisatelů rozmazaná schválně: chat je sice veřejný, ale cizí jména do
cizího repozitáře nepatří. Ze stejného důvodu má `chat-fixtures.json` zástupné
autory i adresy.
