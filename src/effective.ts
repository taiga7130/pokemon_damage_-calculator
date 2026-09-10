// ============================================================
// §4 ステータス側補正（基礎ダメージ計算の「前」に適用）
//   実効攻撃 A_eff / 実効防御 D_eff を組み立てる。
// ============================================================
import type { PokemonState, Move, Conditions } from './types';
import { pokeRound, MOD } from './pokeRound';
import { getStatValue, applyRankBoost } from './stats';
import { applyAttackStatMods, applyDefenseStatMods } from './abilityItem';

/**
 * §4 実効攻撃 A_eff。
 * 順序: 実数値 → ランク補正（急所はマイナス無視）→ ちからもち(×2)。
 */
export function calcEffectiveAttack(attacker: PokemonState, move: Move, conditions: Conditions): number {
  const key = move.category === 'physical' ? 'atk' : 'spa';
  let rank = attacker.ranks[key];
  // §4.2 急所: 攻撃側のマイナスランクを無視（プラスは通常通り）
  if (conditions.isCrit && rank < 0) rank = 0;

  let stat = getStatValue(attacker, key);
  stat = applyRankBoost(stat, rank);

  // §4.4 攻撃側 特性/持ち物（ちからもち×2・ごりむちゅう×1.5・こだわり×1.5 等）
  stat = applyAttackStatMods(stat, attacker, move);

  return stat;
}

/**
 * §4 実効防御 D_eff。
 * 順序: 実数値 → ランク補正（急所はプラス無視）→ 天候の防御側補正。
 */
export function calcEffectiveDefense(defender: PokemonState, move: Move, conditions: Conditions): number {
  const key = move.category === 'physical' ? 'def' : 'spd';
  let rank = defender.ranks[key];
  // §4.2 急所: 防御側のプラスランクを無視（マイナスは通常通り）
  if (conditions.isCrit && rank > 0) rank = 0;

  let stat = getStatValue(defender, key);
  stat = applyRankBoost(stat, rank);

  // §4.3 天候による防御側補正（floor=pokeRound ×1.5）
  const types = defender.species.types;
  if (conditions.weather === 'sand' && key === 'spd' && types.includes('rock')) {
    stat = pokeRound(stat, MOD.X1_5); // 砂嵐: いわタイプの特防 ×1.5
  }
  if (conditions.weather === 'snow' && key === 'def' && types.includes('ice')) {
    stat = pokeRound(stat, MOD.X1_5); // 雪: こおりタイプの防御 ×1.5
  }

  // §4.4 防御側 特性/持ち物（ファーコート・くさのけがわ・とつげきチョッキ）
  stat = applyDefenseStatMods(stat, defender, move, conditions);

  return stat;
}
