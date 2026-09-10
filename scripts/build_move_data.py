#!/usr/bin/env python3
"""
PChamp DB から全技の基本属性を取得し、data/move_data.json を生成する。
接触(contact)と技フラグ（パンチ/音/切る/反動/追加効果）は PChamp DB に存在しないため、
Pokémon Showdown の moves データを補助ソースとして併用する（英語moveIdの完全一致で結合）。

技フラグ（flags, true のもののみ出力）:
  punch        : パンチ技（てつのこぶし ×1.2）
  sound        : 音技（パンクロック ×1.3 / 被弾 ×0.5）
  slicing      : 切る技（きれあじ ×1.5）
  recoil       : 反動技（すてみ ×1.2。Showdown の recoil / hasCrashDamage）
  hasSecondary : 追加効果あり（ちからずく ×1.3。Showdown の secondary / secondaries）
チャンピオンズ独自の分類変更は CHAMPIONS_FLAG_OVERRIDES で上書きする。

正準ソース（基本属性）: https://app.gamepedia.jp/pokemon-champions/moves?lang=ja
補助ソース（contact・技フラグ）: https://play.pokemonshowdown.com/data/moves.json

調査で確定した事実:
- 技一覧ページは完全SSR。各技は <a class="move-card"> の data-* 属性で全項目を保持
  （data-key=英語ID / data-name / data-type=英語ID / data-class / data-power / data-accuracy）。
  個別ページ巡回は不要（1ページに全497件・全属性）。
- sentinel: power=-1 → null、accuracy=-1 および 0 → null（必中/該当なし）。
- type は18タイプID（pokemon_data.json / type_chart.json と一致）。

可変威力/連続技の扱い（承認ルール）:
- 基礎威力そのものが状況依存（HP/素早さ/重さ）・固定ダメージ・反射・OHKO・連続技 のみ
  power=null とし special_move_flags.json に出力。
- 基礎威力が固定で条件付き倍率のみの技（じしんの地中2倍 等）は power=固定値のまま。

出力:
  data/move_data.json              … 全497技
  data/special_move_flags.json     … 可変威力/連続技の候補
  data/contact_join_failures.json  … Showdown と結合できなかった技（contact=null）
"""
import re, json, os, sys, time, urllib.request

PCHAMP = "https://app.gamepedia.jp/pokemon-champions/moves?lang=ja"
# チャンピオンズ独自の技分類（本家と異なるもの）。moveId -> {flag: bool}
#   でんこうそうげき: M-C(2026/09/09) でパンチ技に分類変更（攻略大百科 / Game8 の変更点まとめ）
CHAMPIONS_FLAG_OVERRIDES = {
    "double-shock": {"punch": True},
}
SHOWDOWN = "https://play.pokemonshowdown.com/data/moves.json"
VALID_TYPES = {"normal","fire","water","electric","grass","ice","fighting","poison",
    "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"}

# 連続技は「N回連続で攻撃 / 連続攻撃」のみ。「2回連続で出すことはできない」(デカハンマー)は除外。
MULTI = re.compile(r"連続(?:で)?攻撃|回攻撃")
# 基礎威力が可変なものは効果文に威力レンジ「威力1-150」等を持つ。
RANGE = re.compile(r"威力[0-9０-９]+\s*[ー\-－〜~]\s*[0-9０-９]+")

def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 10000:
        return open(dest, encoding="utf-8").read()
    req = urllib.request.Request(url, headers={"User-Agent": "champions-move-builder/1.0"})
    data = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    open(dest, "w", encoding="utf-8").write(data)
    time.sleep(0.5)
    return data

def is_variable(cls, power_raw, effect):
    if cls == "status":
        return False
    if power_raw == "-1":
        return True
    return bool(MULTI.search(effect) or RANGE.search(effect))

def build(cache, out):
    os.makedirs(cache, exist_ok=True)
    html = fetch(PCHAMP, os.path.join(cache, "moves_list.html"))
    ps = json.loads(fetch(SHOWDOWN, os.path.join(cache, "ps_moves.json")))

    moves, special_flags, join_fail = [], [], []
    matched = 0
    for body in re.findall(r'<a class="move-card"(.*?)</a>', html, re.S):
        a = dict(re.findall(r'(data-[a-z-]+)="([^"]*)"', body))
        eff = re.search(r'mc-effect">([^<]*)<', body)
        effect = eff.group(1) if eff else ""
        key, cls = a["data-key"], a["data-class"]

        power = None if cls == "status" or a["data-power"] == "-1" else int(a["data-power"])
        if is_variable(cls, a["data-power"], effect):
            power = None
            special_flags.append({"moveId": key, "name": a["data-name"],
                                  "category": cls, "effect": effect})
        acc = None if a["data-accuracy"] in ("-1", "0") else int(a["data-accuracy"])

        psk = key.replace("-", "")          # Showdown は英語IDからハイフン除去
        flags = {}
        if psk in ps:
            matched += 1
            pm = ps[psk]
            pf = pm.get("flags") or {}
            contact = bool(pf.get("contact"))
            if cls != "status":
                if pf.get("punch"): flags["punch"] = True
                if pf.get("sound"): flags["sound"] = True
                if pf.get("slicing"): flags["slicing"] = True
                if pm.get("recoil") or pm.get("hasCrashDamage"): flags["recoil"] = True
                if pm.get("secondary") or pm.get("secondaries"): flags["hasSecondary"] = True
        else:
            contact = None
            join_fail.append({"moveId": key, "name": a["data-name"]})
        for fk, fv in CHAMPIONS_FLAG_OVERRIDES.get(key, {}).items():
            if fv: flags[fk] = True
            else: flags.pop(fk, None)

        moves.append({"moveId": key, "name": a["data-name"], "type": a["data-type"],
                      "category": cls, "power": power, "accuracy": acc, "contact": contact,
                      "flags": flags})

    moves.sort(key=lambda m: m["moveId"])
    special_flags.sort(key=lambda m: m["moveId"])
    os.makedirs(out, exist_ok=True)
    json.dump(moves, open(os.path.join(out, "move_data.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    json.dump(special_flags, open(os.path.join(out, "special_move_flags.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    json.dump(join_fail, open(os.path.join(out, "contact_join_failures.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    return moves, special_flags, join_fail, matched

def validate(moves, special_ids):
    errs = {"category": [], "type": [], "power_range": [], "power_not_flagged": [],
            "accuracy": [], "status_power": [], "dup": []}
    seen = set()
    for m in moves:
        if m["category"] not in ("physical", "special", "status"):
            errs["category"].append(m["moveId"])
        if m["type"] not in VALID_TYPES:
            errs["type"].append(m["moveId"])
        if m["category"] == "status" and m["power"] is not None:
            errs["status_power"].append(m["moveId"])
        if m["category"] in ("physical", "special"):
            if m["power"] is None:
                if m["moveId"] not in special_ids:
                    errs["power_not_flagged"].append(m["moveId"])
            elif not (1 <= m["power"] <= 250):
                errs["power_range"].append((m["moveId"], m["power"]))
        if m["accuracy"] is not None and not (1 <= m["accuracy"] <= 100):
            errs["accuracy"].append(m["moveId"])
        if m["moveId"] in seen:
            errs["dup"].append(m["moveId"])
        seen.add(m["moveId"])
    return errs

def main():
    here = os.path.dirname(__file__)
    cache = os.path.join(here, "..", ".cache_pchamp")
    out = os.path.join(here, "..", "data")
    moves, special_flags, join_fail, matched = build(cache, out)
    special_ids = {s["moveId"] for s in special_flags}
    errs = validate(moves, special_ids)
    from collections import Counter
    print(f"moves={len(moves)} categories={dict(Counter(m['category'] for m in moves))}")
    print(f"contact_join={matched}/{len(moves)} ({100*matched/len(moves):.1f}%) failures={len(join_fail)}")
    print(f"special_flags={len(special_flags)}")
    print("validation_errors=", {k: len(v) for k, v in errs.items()})

if __name__ == "__main__":
    main()
