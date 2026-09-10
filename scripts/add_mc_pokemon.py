#!/usr/bin/env python3
"""
レギュレーション M-C (2026/09/09) で追加されたポケモン・メガシンカを
data/pokemon_data.json に追加する。

背景:
  正典ソース PChamp DB のマスター一覧 (/pokemon) は M-A 時点の 326 エントリで止まっており、
  build_pokemon_data.py を再実行しても M-B / M-C 分は取得できない。
  （M-B 分は scripts/add_mb_pokemon.py で管理）

データの出典（種族値・タイプ・特性を分けて記載）:
  追加対象の確定:
    - 攻略大百科「新レギュレーション M-C の追加ポケモン・追加アイテム一覧」
    - Game8「MC追加ポケモン一覧」/ AppMedia「MCレギュレーションの追加ポケモン」
      → 3ソースで 24種（フォルム含め 26体）＋メガ 6体 が一致
    - カモネギ / バリヤード は各ソースとも姿の明記が無いため 本家（カントー）のすがた として投入
  種族値・タイプ・特性（本家シリーズ通常フォルム）:
    - PokeAPI（スロット番号 + is_hidden + 日本語特性名）を機械取得し、
      PChamp DB 個別ページ（先行公開済みの 16種）と種族値・タイプが一致することを確認
  新規メガシンカ:
    - メガボーマンダ / メガセグレイブ: PChamp DB 個別ページ と Game8 の種族値が一致
    - メガグソクムシャ: Game8 / GameWith / ポケモン徹底攻略 の種族値・タイプ(むし/はがね)が一致
      （攻略大百科の一覧表は みず/むし 表記だが同表は他メガの表記も乱れており不採用）
    - 特性は Game8 と 攻略大百科 の一致で確定
      （メガボーマンダ=スカイスキン / メガグソクムシャ=かたいツメ / メガセグレイブ=ねつこうかん）
  メガシンカZ（既存フォルムの特性補完）:
    - メガアブソルZ=きれあじ / メガガブリアスZ=ふゆう / メガルカリオZ=はどうのぼうご
      （Game8・攻略大百科 が一致。種族値は既存の PChamp DB 値をそのまま維持）
    - 注: 攻略大百科の記事はメガアブソルZ の HP を 85 としているが、PChamp DB・Game8 は 65 で
      合計 565（メガ +100 の規則とも整合）のため 65 を維持する。

使い方:
    python3 scripts/add_mc_pokemon.py
    （冪等: 既に存在する dexNo / formName はスキップし、Zメガの特性は空の場合のみ補完する）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "pokemon_data.json")
S = ["hp", "atk", "def", "spa", "spd", "spe"]


def st(*v):
    return dict(zip(S, v))


# dexNo: (名前, タイプ, 種族値, BST, 特性[通常...→隠れ], [追加フォルム...])
# 追加フォルム: (フォルム名, formType, タイプ, 種族値, BST, 特性)
MC = {
    40: ("プクリン", ["normal", "fairy"], st(140, 70, 45, 85, 50, 45), 435,
         ["メロメロボディ", "かちき", "おみとおし"], []),
    53: ("ペルシアン", ["normal"], st(65, 70, 60, 65, 65, 115), 440,
         ["じゅうなん", "テクニシャン", "きんちょうかん"],
         [("ペルシアン(アローラのすがた)", "regional", ["dark"], st(65, 60, 60, 75, 65, 115), 440,
           ["ファーコート", "テクニシャン", "びびり"])]),
    83: ("カモネギ", ["normal", "flying"], st(52, 90, 55, 58, 62, 60), 377,
         ["するどいめ", "せいしんりょく", "まけんき"], []),
    122: ("バリヤード", ["psychic", "fairy"], st(40, 45, 65, 100, 120, 90), 460,
          ["ぼうおん", "フィルター", "テクニシャン"], []),
    317: ("マルノーム", ["poison"], st(100, 73, 83, 73, 83, 55), 467,
          ["ヘドロえき", "ねんちゃく", "くいしんぼう"], []),
    373: ("ボーマンダ", ["dragon", "flying"], st(95, 135, 80, 110, 80, 100), 600,
          ["いかく", "じしんかじょう"],
          [("メガボーマンダ", "mega", ["dragon", "flying"], st(95, 145, 130, 120, 90, 120), 700,
            ["スカイスキン"])]),
    673: ("ゴーゴート", ["grass"], st(123, 100, 62, 97, 81, 68), 531,
          ["そうしょく", "くさのけがわ"], []),
    768: ("グソクムシャ", ["bug", "water"], st(75, 125, 140, 60, 90, 40), 530,
          ["ききかいひ"],
          [("メガグソクムシャ", "mega", ["bug", "steel"], st(75, 150, 175, 70, 120, 40), 630,
            ["かたいツメ"])]),
    812: ("ゴリランダー", ["grass"], st(100, 125, 90, 60, 70, 85), 530,
          ["しんりょく", "グラスメイカー"], []),
    815: ("エースバーン", ["fire"], st(80, 116, 75, 65, 75, 119), 530,
          ["もうか", "リベロ"], []),
    818: ("インテレオン", ["water"], st(70, 85, 65, 125, 65, 120), 530,
          ["げきりゅう", "スナイパー"], []),
    828: ("フォクスライ", ["dark"], st(70, 58, 58, 87, 92, 90), 455,
          ["にげあし", "かるわざ", "はりこみ"], []),
    849: ("ストリンダー", ["electric", "poison"], st(75, 98, 70, 114, 70, 75), 502,
          ["パンクロック", "プラス", "テクニシャン"],   # ベース = ハイなすがた
          [("ストリンダー(ローなすがた)", "other", ["electric", "poison"], st(75, 98, 70, 114, 70, 75), 502,
            ["パンクロック", "マイナス", "テクニシャン"])]),
    853: ("オトスパス", ["fighting"], st(80, 118, 90, 70, 80, 42), 480,
          ["じゅうなん", "テクニシャン"], []),
    863: ("ニャイキング", ["steel"], st(70, 110, 100, 50, 60, 50), 440,
          ["カブトアーマー", "かたいツメ", "はがねのせいしん"], []),
    865: ("ネギガナイト", ["fighting"], st(62, 135, 95, 68, 82, 65), 507,
          ["ふくつのこころ", "きもったま"], []),
    871: ("バチンウニ", ["electric"], st(48, 101, 95, 91, 85, 15), 435,
          ["ひらいしん", "エレキメイカー"], []),
    876: ("イエッサン", ["psychic", "normal"], st(60, 65, 55, 105, 95, 95), 475,
          ["せいしんりょく", "シンクロ", "サイコメイカー"],   # ベース = オスのすがた
          [("イエッサン(メスのすがた)", "regional", ["psychic", "normal"], st(70, 55, 65, 95, 105, 85), 475,
            ["マイペース", "シンクロ", "サイコメイカー"])]),
    923: ("パーモット", ["electric", "fighting"], st(70, 115, 70, 70, 60, 105), 490,
          ["ちくでん", "しぜんかいふく", "てつのこぶし"], []),
    930: ("オリーヴァ", ["grass", "normal"], st(78, 69, 90, 125, 109, 39), 510,
          ["こぼれダネ", "しゅうかく"], []),
    931: ("イキリンコ", ["normal", "flying"], st(82, 96, 51, 45, 51, 92), 417,
          ["いかく", "はりきり", "こんじょう"],   # ベース = グリーンフェザー
          [("イキリンコ(ブルーフェザー)", "other", ["normal", "flying"], st(82, 96, 51, 45, 51, 92), 417,
            ["いかく", "はりきり", "こんじょう"]),
           ("イキリンコ(イエローフェザー)", "other", ["normal", "flying"], st(82, 96, 51, 45, 51, 92), 417,
            ["いかく", "はりきり", "ちからずく"]),
           ("イキリンコ(ホワイトフェザー)", "other", ["normal", "flying"], st(82, 96, 51, 45, 51, 92), 417,
            ["いかく", "はりきり", "ちからずく"])]),
    943: ("マフィティフ", ["dark"], st(80, 120, 90, 60, 70, 85), 505,
          ["いかく", "ばんけん", "はりこみ"], []),
    998: ("セグレイブ", ["dragon", "ice"], st(115, 145, 92, 75, 86, 87), 600,
          ["ねつこうかん", "アイスボディ"],
          [("メガセグレイブ", "mega", ["dragon", "ice"], st(115, 175, 117, 105, 101, 87), 700,
            ["ねつこうかん"])]),
}

# 既存フォルムの特性補完（M-C で解禁されたメガシンカZ）: (dexNo, フォルム名) -> 特性
ABILITY_PATCH = {
    (359, "メガアブソルZ"): ["きれあじ"],
    (445, "メガガブリアスZ"): ["ふゆう"],
    (448, "メガルカリオZ"): ["はどうのぼうご"],
}

VALID_TYPES = {"normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
               "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
               "steel", "fairy"}
VALID_FORM_TYPES = {"base", "mega", "regional", "other"}


def _check(errs, name, types, stats, bst, abil):
    if sum(stats.values()) != bst:
        errs.append(f"{name}: BST不一致 sum={sum(stats.values())} bst={bst}")
    for t in types:
        if t not in VALID_TYPES:
            errs.append(f"{name}: 不正なタイプ {t}")
    for k, v in stats.items():
        if not (1 <= v <= 255):
            errs.append(f"{name}: 種族値レンジ外 {k}={v}")
    if not abil:
        errs.append(f"{name}: 特性が空")


def validate() -> list[str]:
    """投入前の自己検証: BST合計 / タイプ名 / 種族値レンジ / 特性空 / formType。"""
    errs = []
    for dex, (name, types, stats, bst, abil, forms) in MC.items():
        _check(errs, name, types, stats, bst, abil)
        for fname, ftype, ftypes, fstats, fbst, fabil in forms:
            _check(errs, fname, ftypes, fstats, fbst, fabil)
            if ftype not in VALID_FORM_TYPES:
                errs.append(f"{fname}: 不正な formType {ftype}")
    return errs


def main() -> None:
    errs = validate()
    if errs:
        print("投入前検証でエラー:")
        for e in errs:
            print("  ", e)
        raise SystemExit(1)

    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)
    by_dex = {p["dexNo"]: p for p in data}

    added_species, added_forms = 0, 0
    for dex, (name, types, stats, bst, abil, extra) in sorted(MC.items()):
        forms = [{"formName": name, "formType": "base", "types": types,
                  "abilities": abil, "baseStats": stats, "bst": bst}]
        for fname, ftype, ftypes, fstats, fbst, fabil in extra:
            form = {"formName": fname, "formType": ftype, "types": ftypes,
                    "abilities": fabil, "baseStats": fstats, "bst": fbst}
            if ftype == "mega":
                form["megaStone"] = None
            forms.append(form)

        if dex in by_dex:
            existing = {f["formName"] for f in by_dex[dex]["forms"]}
            for form in forms:
                if form["formName"] not in existing:
                    by_dex[dex]["forms"].append(form)
                    added_forms += 1
        else:
            data.append({"dexNo": dex, "name": name, "forms": forms})
            by_dex[dex] = data[-1]
            added_species += 1
            added_forms += len(forms)

    patched = 0
    for (dex, fname), abil in ABILITY_PATCH.items():
        p = by_dex.get(dex)
        if p is None:
            print(f"警告: dexNo {dex} が存在しないため {fname} の特性補完をスキップ")
            continue
        for form in p["forms"]:
            if form["formName"] == fname and not form["abilities"]:
                form["abilities"] = abil
                patched += 1

    data.sort(key=lambda p: p["dexNo"])
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")

    total_forms = sum(len(p["forms"]) for p in data)
    print(f"追加: 種 {added_species} / フォルム {added_forms} / 特性補完 {patched}")
    print(f"合計: 種 {len(data)} / フォルム {total_forms}")


if __name__ == "__main__":
    main()
