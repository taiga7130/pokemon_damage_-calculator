#!/usr/bin/env python3
"""
PChamp DB から全実装ポケモンの固定データ（種族値・タイプ・特性・メガ/別フォルム）を
取得し、data/pokemon_data.json と data/ability_completion_list.json を生成する。

正準ソース: https://app.gamepedia.jp/pokemon-champions/pokemon  （これ以外は使わない）

設計（調査で確定した事実）:
- 個別ページ /pokemon/{dexNo}?lang=ja は完全SSR。HTMLに全データが含まれる（SPA対策不要）。
- タイプの正準ソースはマスター一覧の data-types（英語ID, 全326エントリで100%充足）。
  例) "grass,poison" / "fire,dragon"。エンジンの PokemonType と同じ表記なのでそのまま採用。
- ステータスは個別ページから取得し、フォルム毎に検証する:
    * ベース: class="stats-bars"（合計は <strong> 内）
    * メガ  : class="mega-compare" テーブル
    * 別フォルム(リージョン等): class="mega-form-name" の可視カード
  → これらの和集合でフォルム毎の種族値を確定（sum == 表示BST を必須検証）。
- 特性はベースの class="ability-name" のみページに存在。順序は [通常→隠れ] で安定
  （隠れ特性は <span class="hidden-badge">隠れ特性</span> で明示）。
  メガ/別フォルムの特性はページに無いため null とし、補完対象リストへ出力する。

使い方:
    python3 scripts/build_pokemon_data.py            # 取得から生成まで
    python3 scripts/build_pokemon_data.py --cache /path/to/htmlcache  # 取得済みHTML再利用
"""
import re, os, sys, json, time, argparse, urllib.request

BASE = "https://app.gamepedia.jp/pokemon-champions"
STATS = ["hp", "atk", "def", "spa", "spd", "spe"]
VALID_TYPES = {"normal","fire","water","electric","grass","ice","fighting","poison",
    "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"}

def strip(s): return re.sub(r"<[^>]+>", "", s).strip()

def fetch(url, dest, throttle=0.4):
    if os.path.exists(dest) and os.path.getsize(dest) > 4096:
        return open(dest, encoding="utf-8").read()
    req = urllib.request.Request(url, headers={"User-Agent": "champions-data-builder/1.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    open(dest, "w", encoding="utf-8").write(html)
    time.sleep(throttle)
    return html

# ---------- マスター: タイプ正準 + フォルム順序 ----------
def parse_master(html):
    cards = re.findall(
        r'href="/pokemon-champions/pokemon/(\d+)\?lang=ja"[^>]*data-id="\d+"\s+'
        r'data-name="([^"]+)"\s+data-types="([^"]*)"', html)
    type_map, dex_forms = {}, {}
    for d, name, types in cards:
        d = int(d)
        type_map[(d, name)] = [t for t in types.split(",") if t]
        dex_forms.setdefault(d, [])
        if name not in dex_forms[d]:
            dex_forms[d].append(name)
    return type_map, dex_forms

def form_type(name, basename):
    if name == basename: return "base"
    if name.startswith("メガ"): return "mega"
    if "のすがた" in name: return "regional"   # 注: 一部の天候/性別フォルムも含む簡易判定
    return "other"

# ---------- 個別ページ ----------
def parse_page(html):
    h1 = strip(re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S).group(1))
    basename = re.match(r"#?\d+\s*(.+)", h1).group(1).strip()

    # ベース特性（DOM順 = 通常→隠れ）
    abilities = []
    for a in re.findall(r'class="ability-name"><a[^>]*>([^<]+)</a>', html):
        if a not in abilities:
            abilities.append(a)

    stats = {}  # formName -> (statsdict, total)
    # ベース: stats-bars（合計は <strong> 内）
    sb = re.search(r'class="stats-bars">(.*?)class="stats-total"[^>]*>(.*?)</div>', html, re.S)
    if sb:
        vals = [int(x) for x in re.findall(r"stat-value[^>]*>\s*(\d+)", sb.group(1))[:6]]
        tot = re.search(r"(\d+)", sb.group(2))
        if len(vals) == 6 and tot:
            stats["Base"] = (dict(zip(STATS, vals)), int(tot.group(1)))
    # メガ: mega-compare テーブル
    mt = re.search(r'class="mega-compare".*?<table.*?>(.*?)</table>', html, re.S)
    if mt:
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", mt.group(1), re.S):
            c = [strip(x) for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
            if len(c) == 8 and c[0] != "フォーム":
                stats[c[0]] = (dict(zip(STATS, [int(x) for x in c[1:7]])), int(c[7]))
    # 別フォルム: 可視カード mega-form-name
    for cm in re.finditer(r'mega-form-name"[^>]*>([^<]+)<(.*?)(?=mega-form-name"|使用率|</section)', html, re.S):
        name = cm.group(1).strip()
        nums = [int(x) for x in re.findall(r">\s*(\d+)\s*<", cm.group(2))]
        if len(nums) >= 7 and name not in stats:
            stats[name] = (dict(zip(STATS, nums[:6])), nums[6])
    return basename, abilities, stats

def build(cache):
    os.makedirs(cache, exist_ok=True)
    master = fetch(f"{BASE}/pokemon", os.path.join(cache, "master.html"))
    type_map, dex_forms = parse_master(master)

    dataset, completion, problems = [], [], []
    for dex in sorted(dex_forms):
        html = fetch(f"{BASE}/pokemon/{dex}?lang=ja", os.path.join(cache, f"{dex}.html"))
        basename, abilities, stats = parse_page(html)
        forms = []
        for name in dex_forms[dex]:
            ft = form_type(name, basename)
            sd = (stats.get("Base") if ft == "base" else stats.get(name)) or stats.get(name) or stats.get("Base")
            if sd is None:
                problems.append((dex, name, "NO STATS")); continue
            bs, total = sd
            if sum(bs.values()) != total:
                problems.append((dex, name, f"BST sum={sum(bs.values())} total={total}"))
            types = type_map.get((dex, name), [])
            abil = abilities if ft == "base" else None
            if not abil:
                completion.append({"dexNo": dex, "formName": name, "formType": ft})
            form = {"formName": name, "formType": ft, "types": types,
                    "abilities": abil, "baseStats": bs, "bst": total}
            if ft == "mega":
                form["megaStone"] = None
            forms.append(form)
        dataset.append({"dexNo": dex, "name": basename, "forms": forms})
    dataset.sort(key=lambda x: x["dexNo"])
    return dataset, completion, problems

def validate(dataset):
    errs = []
    for p in dataset:
        for f in p["forms"]:
            bs = f["baseStats"]
            if sum(bs.values()) != f["bst"]:
                errs.append((p["dexNo"], f["formName"], "BST"))
            for t in f["types"]:
                if t not in VALID_TYPES:
                    errs.append((p["dexNo"], f["formName"], f"BADTYPE:{t}"))
            for k, v in bs.items():
                if not (1 <= v <= 255):
                    errs.append((p["dexNo"], f["formName"], f"RANGE:{k}={v}"))
    return errs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(os.path.dirname(__file__), "..", ".cache_pchamp"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data"))
    args = ap.parse_args()
    dataset, completion, problems = build(args.cache)
    errs = validate(dataset)
    os.makedirs(args.out, exist_ok=True)
    json.dump(dataset, open(os.path.join(args.out, "pokemon_data.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    json.dump(completion, open(os.path.join(args.out, "ability_completion_list.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    nforms = sum(len(p["forms"]) for p in dataset)
    print(f"species={len(dataset)} forms={nforms} completion={len(completion)} "
          f"problems={len(problems)} validation_errors={len(errs)}")
    if problems: print("PROBLEMS:", problems[:10])
    if errs: print("ERRORS:", errs[:10])

if __name__ == "__main__":
    main()
