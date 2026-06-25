// ============================================================
// §3 ステータス実数値の計算 / §4.1 ランク補正
// ============================================================
import type { PokemonState, Nature, StatKey, BattleStatKey } from './types';

/**
 * §3.1 HP 実数値。
 *   HP = floor((種族値*2 + 31) * 50 / 100) + 50 + 10 + SP
 * Lv50固定・個体値31固定。1 SP = +1。
 */
export function calcHP(baseStat: number, sp: number): number {
  return Math.floor((baseStat * 2 + 31) * 50 / 100) + 50 + 10 + sp;
}

/**
 * §3.2 HP以外の実数値。
 *   Stat = floor((floor((種族値*2 + 31) * 50 / 100) + 5 + SP) * 性格補正)
 * SP は性格補正の【内側】で加算する。性格補正は最後に乗じ切り捨て。
 */
export function calcStat(baseStat: number, sp: number, natureMod: 1.1 | 1.0 | 0.9): number {
  const inner = Math.floor((baseStat * 2 + 31) * 50 / 100) + 5 + sp;
  return Math.floor(inner * natureMod);
}

/** 性格補正倍率を解決（上昇1.1 / 無補正1.0 / 下降0.9）。 */
export function natureMultiplier(nature: Nature, key: StatKey): 1.1 | 1.0 | 0.9 {
  if (key === 'hp') return 1.0;
  if (nature.plus === key && nature.minus === key) return 1.0; // 相殺
  if (nature.plus === key) return 1.1;
  if (nature.minus === key) return 0.9;
  return 1.0;
}

/** 個体の状態から指定ステータスの実数値を引く。 */
export function getStatValue(p: PokemonState, key: StatKey): number {
  if (key === 'hp') return calcHP(p.species.baseStats.hp, p.sp.hp);
  return calcStat(p.species.baseStats[key], p.sp[key], natureMultiplier(p.nature, key));
}

/**
 * §4.1 ランク補正（内部分数で計算。UI表示値は信用しない）。
 *   rank > 0: floor(stat * (2 + rank) / 2)
 *   rank < 0: floor(stat * 2 / (2 - rank))
 */
export function applyRankBoost(stat: number, rank: number): number {
  if (rank > 0) return Math.floor(stat * (2 + rank) / 2);
  if (rank < 0) return Math.floor(stat * 2 / (2 - rank));
  return stat;
}

/** §1 SP上限の検証（1ステ32 / 合計66）。計算では強制しないが入力検証に使える。 */
export function validateSP(sp: Record<StatKey, number>): boolean {
  const keys: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  let total = 0;
  for (const k of keys) {
    if (sp[k] < 0 || sp[k] > 32) return false;
    total += sp[k];
  }
  return total <= 66;
}

export type { BattleStatKey };
