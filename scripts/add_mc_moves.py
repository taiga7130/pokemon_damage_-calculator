#!/usr/bin/env python3
"""
レギュレーション M-C (2026/09/09) で解禁・追加された技を data/move_data.json に追加する。

背景:
  正典ソース PChamp DB の技一覧 (/moves) は 497 件のまま M-C 未反映のため、
  build_move_data.py を再実行しても以下の技は取得できない。

出典:
  - 攻略大百科「M-C での変更点まとめ」/ Game8「変更された要素・強化＆弱体化まとめ」
      きりさく      : ノーマル / 物理 / 威力 70→80（M-C で解禁）
      ねらいうち    : みず     / 特殊 / 威力 80→85
      スターアサルト: かくとう / 物理 / 威力 150→170（命中100・接触・次ターン反動）
  - 命中・接触・技フラグは Pokémon Showdown の moves データ（きりさく=切る技・接触、
    ねらいうち=非接触）。スターアサルトは Showdown 未収録のため上記記事の記載
    （命中100・直接攻撃）を採用。

使い方:
    python3 scripts/add_mc_moves.py
    （冪等: 既存 moveId は威力のみ更新する）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "move_data.json")

MC_MOVES = [
    {"moveId": "slash", "name": "きりさく", "type": "normal", "category": "physical",
     "power": 80, "accuracy": 100, "contact": True, "flags": {"slicing": True}},
    {"moveId": "snipe-shot", "name": "ねらいうち", "type": "water", "category": "special",
     "power": 85, "accuracy": 100, "contact": False, "flags": {}},
    {"moveId": "star-assault", "name": "スターアサルト", "type": "fighting", "category": "physical",
     "power": 170, "accuracy": 100, "contact": True, "flags": {}},
]


def main() -> None:
    with open(DATA, encoding="utf-8") as f:
        moves = json.load(f)
    by_id = {m["moveId"]: m for m in moves}

    added, updated = 0, 0
    for mv in MC_MOVES:
        cur = by_id.get(mv["moveId"])
        if cur is None:
            moves.append(dict(mv))
            added += 1
        elif cur.get("power") != mv["power"]:
            cur["power"] = mv["power"]
            updated += 1

    moves.sort(key=lambda m: m["moveId"])
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(moves, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"追加 {added} / 威力更新 {updated} / 合計 {len(moves)}")


if __name__ == "__main__":
    main()
