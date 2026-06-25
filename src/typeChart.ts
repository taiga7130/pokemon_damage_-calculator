// ============================================================
// §5.3 タイプ相性（18×18 確定表 + 倍率算出）
// 表本体は data/type_chart.json（第9世代/SV）を正準ソースとして読み込む。
// 倍率は pokeRound を使わず 2のべき乗で適用する（適用はダメージ側 damage.ts）。
// ============================================================
import type { PokemonType } from './types';
import chartData from '../data/type_chart.json';

/** 全18タイプ（pokemon_data.json と同じ英語ID）。 */
export const ALL_TYPES: PokemonType[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

/**
 * 攻撃タイプ → { 防御タイプ: 倍率 }。等倍(1)は省略（記載なし=1.0）。
 * 単体相性は 0 / 0.5 / 1 / 2 のみ。0.25・4 は複合タイプの掛け算で発生する。
 */
export const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> =
  (chartData as { chart: Record<PokemonType, Partial<Record<PokemonType, number>>> }).chart;

// ロード時の整合ガード: 18攻撃タイプ行がすべて存在すること（欠落=データ破損）。
for (const t of ALL_TYPES) {
  if (!(t in TYPE_CHART)) {
    throw new Error(`type_chart.json: 攻撃タイプ行が欠落しています: ${t}`);
  }
}

/**
 * §5.3 攻撃技タイプ × 防御側タイプ の総合相性倍率。
 * 複合タイプは各防御タイプ相性の掛け算（0.25・4 はここで自然発生）。
 * 0倍が1つでもあれば最終0倍。戻り値は 0 / 0.25 / 0.5 / 1 / 2 / 4 のいずれか。
 */
export function calcTypeEffectiveness(moveType: PokemonType, defenderTypes: PokemonType[]): number {
  let eff = 1;
  const row = TYPE_CHART[moveType];
  for (const t of defenderTypes) {
    const m = row[t];
    eff *= m === undefined ? 1 : m;
  }
  return eff;
}
