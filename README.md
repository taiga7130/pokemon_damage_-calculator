# ポケモンチャンピオンズ ダメージ計算エンジン（コア）

`champions_damage_spec.md` を正典とした計算コアのみの実装。UI・特殊技(§6)・メガシンカ(§8)・本物のデータ(§9)は対象外。

## セットアップ

```bash
npm install
npm test          # vitest（全テスト）
npm run sample    # §10 検証用の入力例を1件出力
npm run typecheck # tsc --noEmit
```

## 構成

```
src/
  types.ts       型定義
  pokeRound.ts   §2 4096基準固定小数点 + modifier定数
  stats.ts       §3 実数値 / §4.1 ランク補正
  effective.ts   §4 実効攻撃A_eff / 実効防御D_eff（急所・天候補正含む）
  typeChart.ts   §5.3 18タイプ相性表 + 倍率算出
  damage.ts      §5.1 基礎ダメージ / §5.2 補正適用順 / §7 乱数16通り
  ko.ts          §7 確定数（組み合わせ確率）
  index.ts       calcDamage 統合関数 + 公開API
  sample.ts      §10 サンプル実行
data/
  dummy.ts       テスト用ダミー（種族・技・性格・ヘルパー）
  pokemon_data.json / move_data.json  実データ（PChamp DB 由来 + レギュレーション追加分）
  learnsets.json         ポケモン（フォルム別）ごとの習得技一覧 "dexNo:formName" -> moveId[] | null
  learnsets_meta.json    フォルムごとの取得元（pchamp / game8+gamewith / null）
  learnsets_disputed.json  Game8/GameWithで技名が一致しなかったため不採用にしたもの
  learnsets_unmapped.json  技名/moveIdを move_data.json に変換できなかったもの（採用せず記録のみ）
scripts/
  build_pokemon_data.py  PChamp DB からポケモンデータを生成（M-A 時点の一覧）
  build_move_data.py     PChamp DB から技データを生成（技フラグは Showdown から補完）
  add_mb_pokemon.py      レギュレーション M-B 追加分（PChamp DB 未反映のため手動管理）
  add_mc_pokemon.py      レギュレーション M-C 追加分（同上）
  add_missing_moves.py   PChamp DB 未収録の技とバランス調整（M-B/M-C 分。Game8+GameWith で照合）
  build_learnsets.py     ポケモンごとの習得技一覧を生成（PChamp DB 正典 + Game8/GameWith 突合の46dexNo）
tests/           各関数の手計算検証テスト（期待値の根拠コメント付き）＋ 実データ整合性テスト
```

## データ更新の手順

```bash
python3 scripts/build_pokemon_data.py   # PChamp DB 一覧（M-A 分）
python3 scripts/add_mb_pokemon.py       # M-B 追加分を上乗せ（冪等）
python3 scripts/add_mc_pokemon.py       # M-C 追加分を上乗せ（冪等）
python3 scripts/build_move_data.py      # PChamp DB 技一覧 + 技フラグ
python3 scripts/add_missing_moves.py    # 未収録技・バランス調整を上乗せ（冪等）
python3 scripts/build_learnsets.py      # 習得技一覧を生成（.cache_pchamp/ にHTMLキャッシュ）
npm test                                # data.test.ts が整合性を検証
```

## 主要関数

`pokeRound` / `calcHP` / `calcStat` / `applyRankBoost` / `calcEffectiveAttack` /
`calcEffectiveDefense` / `calcTypeEffectiveness` / `calcBaseDamage` / `applyModifiers` /
`calcDamageRange` / `calcKOProbability` / `calcDamage`

## 実装メモ（要検証フラグ）

- 全乗算補正は pokeRound（4096基準）。乱数とタイプ相性のみ単純floor / 2のべき乗。
- SP は性格補正の内側で加算（`(... + 5 + SP) × 性格補正`）。
- 持ち物は いのちのたま(×1.3) のみ実体実装（端数倍率で pokeRound 検証価値が高いため）。
- 4096方式の実機妥当性・半減実の適用順などは仕様書付録の要検証フラグに従う。
