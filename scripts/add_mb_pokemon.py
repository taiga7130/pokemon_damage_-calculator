#!/usr/bin/env python3
"""
レギュレーション M-B (2026/06/17) で追加されたポケモン・メガシンカを
data/pokemon_data.json に追加する。

背景:
  正典ソース PChamp DB のマスター一覧 (/pokemon) は M-A 時点の 326 エントリで止まっており、
  build_pokemon_data.py を再実行しても M-B 分は取得できない。
  ただし個別ページ /pokemon/{dexNo} は一部の M-B ポケモンで先行公開されている。

データの出典（種族値・タイプ・特性を分けて記載）:
  種族値・タイプ:
    - 18種 + メガ11種は PChamp DB 個別ページから取得し BST 合計を検証済み
      (ラフレシア/ハリーセン/ジュカイン/バシャーモ/ラグラージ/メタグロス/ムクホーク/
       ズルズキン/シビルドン/カエンジシ/カラマネロ/ドラミドロ/オーロンゲ/タイレーツ/
       ハリーマン/ハカドッグ/コノヨザル/サーフゴー とその各メガ)
    - PChamp DB に個別ページが無い4種(ムシャーナ/クチート/ペンドラー/ガメノデス)と
      そのメガは PokemonDB・攻略大百科・Game8 の3ソース以上の一致で確定
    - メガガメノデスのタイプ変化(いわ/みず → いわ/かくとう)は Game8 複数記事で確認。
      弱点7タイプの記載が いわ/かくとう の相性計算と一致することも裏付けとした
  特性:
    - 本家シリーズ通常フォルムは PokeAPI(スロット番号 + is_hidden) と PokemonDB で確定
    - チャンピオンズ新規メガの特性は攻略大百科の新メガ一覧と Game8 メガシンカ一覧が一致

使い方:
    python3 scripts/add_mb_pokemon.py
    （冪等: 既に存在する dexNo / formName はスキップする）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "pokemon_data.json")
S = ["hp", "atk", "def", "spa", "spd", "spe"]


def st(*v):
    return dict(zip(S, v))


# dexNo: (名前, タイプ, 種族値, BST, 特性[通常...→隠れ], [メガ...])
# メガ: (フォルム名, タイプ, 種族値, BST, 特性)
MB = {
    45: ("ラフレシア", ["grass", "poison"], st(75, 80, 85, 110, 90, 50), 490,
         ["ようりょくそ", "ほうし"], []),
    211: ("ハリーセン", ["water", "poison"], st(65, 95, 85, 55, 55, 85), 440,
          ["どくのトゲ", "すいすい", "いかく"], []),
    254: ("ジュカイン", ["grass"], st(70, 85, 65, 105, 85, 120), 530,
          ["しんりょく", "かるわざ"],
          [("メガジュカイン", ["grass", "dragon"], st(70, 110, 75, 145, 85, 145), 630, ["ひらいしん"])]),
    257: ("バシャーモ", ["fire", "fighting"], st(80, 120, 70, 110, 70, 80), 530,
          ["もうか", "かそく"],
          [("メガバシャーモ", ["fire", "fighting"], st(80, 160, 80, 130, 80, 100), 630, ["かそく"])]),
    260: ("ラグラージ", ["water", "ground"], st(100, 110, 90, 85, 90, 60), 535,
          ["げきりゅう", "しめりけ"],
          [("メガラグラージ", ["water", "ground"], st(100, 150, 110, 95, 110, 70), 635, ["すいすい"])]),
    303: ("クチート", ["steel", "fairy"], st(50, 85, 85, 55, 55, 50), 380,
          ["かいりきバサミ", "いかく", "ちからずく"],
          [("メガクチート", ["steel", "fairy"], st(50, 105, 125, 55, 95, 50), 480, ["ちからもち"])]),
    376: ("メタグロス", ["steel", "psychic"], st(80, 135, 130, 95, 90, 70), 600,
          ["クリアボディ", "ライトメタル"],
          [("メガメタグロス", ["steel", "psychic"], st(80, 145, 150, 105, 110, 110), 700, ["かたいツメ"])]),
    398: ("ムクホーク", ["normal", "flying"], st(85, 120, 70, 50, 60, 100), 485,
          ["いかく", "すてみ"],
          [("メガムクホーク", ["fighting", "flying"], st(85, 140, 100, 60, 90, 110), 585, ["あまのじゃく"])]),
    518: ("ムシャーナ", ["psychic"], st(116, 55, 85, 107, 95, 29), 487,
          ["よちむ", "シンクロ", "テレパシー"], []),
    545: ("ペンドラー", ["bug", "poison"], st(60, 100, 89, 55, 69, 112), 485,
          ["どくのトゲ", "むしのしらせ", "かそく"],
          [("メガペンドラー", ["bug", "poison"], st(60, 140, 149, 75, 99, 62), 585, ["シェルアーマー"])]),
    560: ("ズルズキン", ["dark", "fighting"], st(65, 90, 115, 45, 115, 58), 488,
          ["だっぴ", "じしんかじょう", "いかく"],
          [("メガズルズキン", ["dark", "fighting"], st(65, 130, 135, 55, 135, 68), 588, ["いかく"])]),
    604: ("シビルドン", ["electric"], st(85, 115, 80, 105, 80, 50), 515,
          ["ふゆう"],
          [("メガシビルドン", ["electric"], st(85, 145, 80, 135, 90, 80), 615, ["うなぎのぼり"])]),
    668: ("カエンジシ", ["fire", "normal"], st(86, 68, 72, 109, 66, 106), 507,
          ["とうそうしん", "きんちょうかん", "じしんかじょう"],
          [("メガカエンジシ", ["fire", "normal"], st(86, 88, 92, 129, 86, 126), 607, ["ほのおのたてがみ"])]),
    687: ("カラマネロ", ["dark", "psychic"], st(86, 92, 88, 68, 75, 73), 482,
          ["あまのじゃく", "きゅうばん", "すりぬけ"],
          [("メガカラマネロ", ["dark", "psychic"], st(86, 102, 88, 98, 120, 88), 582, ["あまのじゃく"])]),
    689: ("ガメノデス", ["rock", "water"], st(72, 105, 115, 54, 86, 68), 500,
          ["かたいツメ", "スナイパー", "わるいてぐせ"],
          [("メガガメノデス", ["rock", "fighting"], st(72, 140, 130, 64, 106, 88), 600, ["かたいツメ"])]),
    691: ("ドラミドロ", ["poison", "dragon"], st(65, 75, 90, 97, 123, 44), 494,
          ["どくのトゲ", "どくしゅ", "てきおうりょく"],
          [("メガドラミドロ", ["poison", "dragon"], st(65, 85, 105, 132, 163, 44), 594, ["さいせいりょく"])]),
    861: ("オーロンゲ", ["dark", "fairy"], st(95, 120, 65, 95, 75, 60), 510,
          ["いたずらごころ", "おみとおし", "わるいてぐせ"], []),
    870: ("タイレーツ", ["fighting"], st(65, 100, 100, 70, 60, 75), 470,
          ["カブトアーマー", "まけんき"],
          [("メガタイレーツ", ["fighting"], st(65, 135, 135, 70, 65, 100), 570, ["まけんき"])]),
    904: ("ハリーマン", ["dark", "poison"], st(85, 115, 95, 65, 65, 85), 510,
          ["どくのトゲ", "すいすい", "いかく"], []),
    972: ("ハカドッグ", ["ghost"], st(72, 101, 100, 50, 97, 68), 488,
          ["すなかき", "もふもふ"], []),
    979: ("コノヨザル", ["fighting", "ghost"], st(110, 115, 80, 50, 90, 90), 535,
          ["やるき", "せいしんりょく", "まけんき"], []),
    1000: ("サーフゴー", ["steel", "ghost"], st(87, 60, 95, 133, 91, 84), 550,
           ["おうごんのからだ"], []),
}

VALID_TYPES = {"normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
               "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
               "steel", "fairy"}


def validate() -> list[str]:
    """投入前の自己検証: BST合計 / タイプ名 / 種族値レンジ。"""
    errs = []
    for dex, (name, types, stats, bst, abil, megas) in MB.items():
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
        for mname, mtypes, mstats, mbst, mabil in megas:
            if sum(mstats.values()) != mbst:
                errs.append(f"{mname}: BST不一致 sum={sum(mstats.values())} bst={mbst}")
            for t in mtypes:
                if t not in VALID_TYPES:
                    errs.append(f"{mname}: 不正なタイプ {t}")
            if not mabil:
                errs.append(f"{mname}: 特性が空")
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
    for dex, (name, types, stats, bst, abil, megas) in sorted(MB.items()):
        forms = [{"formName": name, "formType": "base", "types": types,
                  "abilities": abil, "baseStats": stats, "bst": bst}]
        for mname, mtypes, mstats, mbst, mabil in megas:
            forms.append({"formName": mname, "formType": "mega", "types": mtypes,
                          "abilities": mabil, "baseStats": mstats, "bst": mbst,
                          "megaStone": None})

        if dex in by_dex:
            existing = {f["formName"] for f in by_dex[dex]["forms"]}
            for form in forms:
                if form["formName"] not in existing:
                    by_dex[dex]["forms"].append(form)
                    added_forms += 1
        else:
            data.append({"dexNo": dex, "name": name, "forms": forms})
            added_species += 1
            added_forms += len(forms)

    data.sort(key=lambda p: p["dexNo"])
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")

    total_forms = sum(len(p["forms"]) for p in data)
    print(f"追加: 種 {added_species} / フォルム {added_forms}")
    print(f"合計: 種 {len(data)} / フォルム {total_forms}")


if __name__ == "__main__":
    main()
