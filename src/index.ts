// ============================================================
// 統合関数 + 公開API
// ============================================================
import type { PokemonState, Move, Conditions, DamageResult } from './types';
import { getStatValue } from './stats';
import { calcDamageRange } from './damage';
import { calcTypeEffectiveness } from './typeChart';
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
  const typeEff = calcTypeEffectiveness(move.type, defender.species.types);

  const maxHP = getStatValue(defender, 'hp');
  const targetHP = defender.currentHP ?? maxHP;

  const minDamage = rolls[0];
  const maxDamage = rolls[rolls.length - 1];

  // 割合は対 最大HP %（小数第1位まで）
  const minPercent = Math.round((minDamage / maxHP) * 1000) / 10;
  const maxPercent = Math.round((maxDamage / maxHP) * 1000) / 10;

  const ko = calcKOProbability(rolls, targetHP);

  return { rolls, minDamage, maxDamage, minPercent, maxPercent, ko, isImmune: typeEff === 0 };
}

// re-export
export * from './types';
export { pokeRound, MOD } from './pokeRound';
export { calcHP, calcStat, getStatValue, applyRankBoost, natureMultiplier, validateSP } from './stats';
export { calcEffectiveAttack, calcEffectiveDefense } from './effective';
export { calcTypeEffectiveness, TYPE_CHART } from './typeChart';
export { calcBaseDamage, applyModifiers, calcDamageRange } from './damage';
export { calcKOProbability } from './ko';
