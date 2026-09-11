#!/usr/bin/env python3
"""Stáhne z webtrh.cz aktuální rozdělení inzerátů na 'prodej domén' vs 'prodej
webů' a přepíše fixtures.json. Tohle je jediná pravda, proti které se
klasifikátor měří — webtrh si inzeráty zařazuje sám.

    python3 refresh-fixtures.py && node eval.js
"""
import json, re, time, urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CATS = {"domains": ("prodej-domen", "sell-domain-box"),
        "websites": ("prodej-webu", "sell-website-box")}
PAGES = 6


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def main() -> None:
    out = {"_source": f"webtrh.cz taxonomie, staženo {time.strftime('%Y-%m-%d')} skriptem refresh-fixtures.py"}
    for key, (cat, cls) in CATS.items():
        found = set()
        for page in range(1, PAGES + 1):
            url = (f"https://webtrh.cz/prodeje/{cat}/" if page == 1
                   else f"https://webtrh.cz/prodeje/{cat}/strana/{page}/")
            html = fetch(url)
            found |= set(re.findall(
                r'<a href="https://webtrh\.cz/(prodej/[^"]+?)/"\s+class="' + cls, html))
            time.sleep(1)
        out[key] = sorted(found)
        print(f"{cat}: {len(found)}")

    overlap = set(out["domains"]) & set(out["websites"])
    if overlap:
        raise SystemExit(f"inzerát ve dvou kategoriích naráz: {overlap}")

    with open("fixtures.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("zapsáno fixtures.json")


if __name__ == "__main__":
    main()
