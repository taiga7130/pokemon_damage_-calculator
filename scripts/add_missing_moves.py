#!/usr/bin/env python3
"""
正典ソース PChamp DB の技一覧（M-A 時点・497件）に無い技の追加と、
チャンピオンズ独自のバランス調整（威力・命中・タイプ）を data/move_data.json に反映する。

背景:
  PChamp DB /moves は 2026-09-20 時点でも 497 件のまま更新されておらず、
  build_move_data.py を再実行しても M-B / M-C で解禁された技や調整後の数値は取得できない。
  そのため Game8「技一覧」と GameWith「技一覧」の 2 ソースが一致した内容だけを本スクリプトで上乗せする。
  （旧 add_mc_moves.py を統合・拡張したもの）

出典（2026-09-20 時点で Game8 と GameWith が一致。攻略大百科の変更点記事で裏付けがあるものは併記）:
  追加技（PChamp DB 未収録）:
    ドラムアタック(ゴリランダー) / かえんボール(エースバーン) / きょけんとつげき(セグレイブ) /
    くらいつく(マフィティフ) / びりびりちくちく(バチンウニ) / オーバードライブ(ストリンダー) /
    ゴールドラッシュ(サーフゴー) / ソウルクラッシュ(オーロンゲ) / どくばりセンボン(ハリーマン) /
    ふんどのこぶし(コノヨザル) / きりさく / ねらいうち / スターアサルト
    変化技: ギアチェンジ / コートチェンジ / たこがため / はいすいのじん / ひっくりかえす
  バランス調整（PChamp DB の値 → 現行値）:
    くちばしキャノン 100→120 / であいがしら 90→100 / ひょうざんおろし 100→120 /
    トロピカルキック 70→85 / トラバサミ くさ→はがね   （以上 攻略大百科「過去作からの変更点」でも確認）
    Gのちから 80→90 / かげぬい 80→90 / ナイトバースト 85→90 / バリアーラッシュ 70→90 /
    ひゃっきやこう 60→65 / ほのおのムチ 80→90 / りんごさん 80→90 / クラブハンマー 命中 90→95
    きりさく 70→80 / ねらいうち 80→85 / スターアサルト 150→170（M-C 変更点記事）
    ゴールドラッシュ 命中 100→95（M-B 変更点記事）
  接触・技フラグ: Pokémon Showdown moves データ（英語 moveId は PokeAPI の日本語名対応表で解決）。
    スターアサルトは Showdown 未収録のため記事記載（命中100・直接攻撃）を採用。

使い方:
    python3 scripts/add_missing_moves.py
    （冪等: 既存 moveId は指定フィールドのみ上書きし、無ければ追加する）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "move_data.json")


def mv(moveId, name, type_, category, power, accuracy, contact, **flags):
    return {"moveId": moveId, "name": name, "type": type_, "category": category,
            "power": power, "accuracy": accuracy, "contact": contact,
            "flags": {k: True for k, v in flags.items() if v}}


# PChamp DB に無い技（追加）
NEW_MOVES = [
    # --- 攻撃技 ---
    mv("drum-beating", "ドラムアタック", "grass", "physical", 80, 100, False, hasSecondary=True),
    mv("pyro-ball", "かえんボール", "fire", "physical", 120, 90, False, hasSecondary=True),
    mv("glaive-rush", "きょけんとつげき", "dragon", "physical", 120, 100, True),
    mv("jaw-lock", "くらいつく", "dark", "physical", 80, 100, True),
    mv("zing-zap", "びりびりちくちく", "electric", "physical", 80, 100, True, hasSecondary=True),
    mv("overdrive", "オーバードライブ", "electric", "special", 80, 100, False, sound=True),
    mv("make-it-rain", "ゴールドラッシュ", "steel", "special", 120, 95, False),
    mv("spirit-break", "ソウルクラッシュ", "fairy", "physical", 75, 100, True, hasSecondary=True),
    mv("barb-barrage", "どくばりセンボン", "poison", "physical", 60, 100, False, hasSecondary=True),
    mv("rage-fist", "ふんどのこぶし", "ghost", "physical", 50, 100, True, punch=True),
    mv("slash", "きりさく", "normal", "physical", 80, 100, True, slicing=True),
    mv("snipe-shot", "ねらいうち", "water", "special", 85, 100, False),
    mv("star-assault", "スターアサルト", "fighting", "physical", 170, 100, True),
    # --- 変化技（ダメージ計算対象外。一覧の完全性のため収録） ---
    mv("shift-gear", "ギアチェンジ", "steel", "status", None, None, False),
    mv("court-change", "コートチェンジ", "normal", "status", None, 100, False),
    mv("octolock", "たこがため", "fighting", "status", None, 100, False),
    mv("no-retreat", "はいすいのじん", "fighting", "status", None, None, False),
    mv("topsy-turvy", "ひっくりかえす", "dark", "status", None, None, False),
]

# 既存技のバランス調整（moveId -> 上書きするフィールド）
OVERRIDES = {
    "beak-blast": {"power": 120},
    "first-impression": {"power": 100},
    "mountain-gale": {"power": 120},
    "trop-kick": {"power": 85},
    "snap-trap": {"type": "steel"},
    "grav-apple": {"power": 90},
    "spirit-shackle": {"power": 90},
    "night-daze": {"power": 90},
    "psyshield-bash": {"power": 90},
    "infernal-parade": {"power": 65},
    "fire-lash": {"power": 90},
    "apple-acid": {"power": 90},
    "crabhammer": {"accuracy": 95},
}


def main() -> None:
    with open(DATA, encoding="utf-8") as f:
        moves = json.load(f)
    by_id = {m["moveId"]: m for m in moves}

    added, updated = 0, 0
    for m in NEW_MOVES:
        cur = by_id.get(m["moveId"])
        if cur is None:
            moves.append(dict(m))
            by_id[m["moveId"]] = moves[-1]
            added += 1
        else:
            for k in ("type", "category", "power", "accuracy"):
                if cur.get(k) != m[k]:
                    cur[k] = m[k]
                    updated += 1
    for mid, fields in OVERRIDES.items():
        cur = by_id.get(mid)
        if cur is None:
            print(f"警告: {mid} が存在しないため調整をスキップ")
            continue
        for k, v in fields.items():
            if cur.get(k) != v:
                cur[k] = v
                updated += 1

    moves.sort(key=lambda m: m["moveId"])
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(moves, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"追加 {added} / 更新フィールド {updated} / 合計 {len(moves)}")


if __name__ == "__main__":
    main()
