// ============================================================
// 統合関数 + 公開API
// ============================================================
import type { PokemonState, Move, Conditions, DamageResult } from './types';
import { getStatValue } from './stats';
import { calcDamageRange } from './damage';
import { calcKOProbability } from './ko';

/**
 * 統合ダメージ計算。
 * 攻撃側・防御側・技・戦況から、最小〜最大ダメージ・割合・確定数を返す。
 */
export function calcDamage(
  attacker: PokemonState,
  defender: PokemonState,
  move: Move,
  conditions: Conditions = {},
): DamageResult {
  const rolls = calcDamageRange(attacker, defender, move, conditions);
  // 無効判定は特性(ふゆう等)も反映した実出力ベース（全ロール0 = 無効）
  const isImmune = rolls.every((d) => d === 0);

  const maxHP = getStatValue(defender, 'hp');
  const targetHP = defender.currentHP ?? maxHP;

  const minDamage = rolls[0];
  const maxDamage = rolls[rolls.length - 1];

  // 割合は対 最大HP %（小数第1位まで）
  const minPercent = Math.round((minDamage / maxHP) * 1000) / 10;
  const maxPercent = Math.round((maxDamage / maxHP) * 1000) / 10;

  const ko = calcKOProbability(rolls, targetHP);

  return { rolls, minDamage, maxDamage, minPercent, maxPercent, ko, isImmune };
}

// re-export
export * from './types';
export { pokeRound, MOD } from './pokeRound';
export { calcHP, calcStat, getStatValue, applyRankBoost, natureMultiplier, validateSP } from './stats';
export { calcEffectiveAttack, calcEffectiveDefense } from './effective';
export { calcTypeEffectiveness, TYPE_CHART, ALL_TYPES } from './typeChart';
export {
  computeEffectivePower, computeTypeEffectiveness, computeCritMod,
  computePostTypeMods, computeFinalMods,
} from './abilityItem';
export { calcBaseDamage, applyModifiers, calcDamageRange } from './damage';
export { calcKOProbability } from './ko';
