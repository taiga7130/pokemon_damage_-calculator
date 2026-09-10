// ============================================================
// §5 ダメージ計算本体 / §7 乱数16通り
// ============================================================
import type { PokemonState, Move, Conditions, ModifierContext, Weather, PokemonType } from './types';
import { pokeRound, MOD } from './pokeRound';
import { calcEffectiveAttack, calcEffectiveDefense } from './effective';
import {
  computeEffectivePower, computeTypeEffectiveness, computeCritMod,
  computePostTypeMods, computeFinalMods, resolveMove,
} from './abilityItem';

/**
 * §5.1 基礎ダメージ（Lv50固定 → (2*Level/5+2)=22 定数）。
 *   base = floor(floor(22 * power * A / D) / 50) + 2
 * floor は「÷D の後」と「÷50 の後」の2箇所。
 */
export function calcBaseDamage(power: number, attack: number, defense: number): number {
  const inner = Math.floor(22 * power * attack / defense);
  return Math.floor(inner / 50) + 2;
}

/** §5.3 タイプ相性の適用（2のべき乗整数演算。pokeRound不使用）。 */
function applyTypeEff(dmg: number, eff: number): number {
  if (eff === 0) return 0;
  if (eff === 4) return dmg * 4;
  if (eff === 2) return dmg * 2;
  if (eff === 0.5) return Math.floor(dmg / 2);
  if (eff === 0.25) return Math.floor(dmg / 4);
  return dmg; // 等倍
}

/** §5.6 各ステップ後、1未満は1に繰り上げ（0倍の無効を除く）。 */
const clamp1 = (d: number): number => (d < 1 ? 1 : d);

/** §5.2-1 天候の威力補正（防御側補正ではない）。 */
function weatherDamageMod(weather: Weather, moveType: PokemonType): number | null {
  if (weather === 'sun') {
    if (moveType === 'fire') return MOD.X1_5;
    if (moveType === 'water') return MOD.X0_5;
  }
  if (weather === 'rain') {
    if (moveType === 'water') return MOD.X1_5;
    if (moveType === 'fire') return MOD.X0_5;
  }
  return null;
}

/**
 * §5.2 補正適用（乱数1通り分）。
 * 順序: 天候 → 急所 → 乱数(floor) → STAB → タイプ相性(べき乗) → やけど → 壁 → 持ち物。
 * 乱数・タイプ相性以外は pokeRound。
 *
 * @param base         §5.1 基礎ダメージ
 * @param randomFactor 85〜100 の整数
 */
export function applyModifiers(base: number, randomFactor: number, ctx: ModifierContext): number {
  let d = base;

  // 1) 天候
  if (ctx.weatherMod !== null) d = clamp1(pokeRound(d, ctx.weatherMod));
  // 2) 急所（×1.5 / スナイパー ×2.25）
  if (ctx.critMod !== null) d = clamp1(pokeRound(d, ctx.critMod));
  // 3) 乱数（単純 floor）
  d = clamp1(Math.floor(d * randomFactor / 100));
  // 4) タイプ一致 STAB
  if (ctx.stabMod !== null) d = clamp1(pokeRound(d, ctx.stabMod));
  // 5) タイプ相性（2のべき乗）
  d = applyTypeEff(d, ctx.typeEff);
  if (d === 0) return 0; // 無効は即時確定
  d = clamp1(d);
  // 5後) いろめがね 等
  for (const m of ctx.postTypeMods) d = clamp1(pokeRound(d, m));
  // 6) やけど（物理のみ ×0.5）
  if (ctx.burned && ctx.isPhysical) d = clamp1(pokeRound(d, MOD.X0_5));
  // 7) 壁 ×0.5
  if (ctx.wallActive) d = clamp1(pokeRound(d, MOD.X0_5));
  // 8) 最終乗算群（持ち物＋防御側特性＋半減実）
  for (const m of ctx.finalMods) d = clamp1(pokeRound(d, m));

  return d;
}

/**
 * ModifierContext を 1 度だけ構築。
 * 乱数に依存しない要素（A_eff/D_eff/base/STAB/相性/各フラグ）をここで確定する。
 */
function buildContext(
  attacker: PokemonState,
  defender: PokemonState,
  move: Move,
  conditions: Conditions,
): { base: number; ctx: ModifierContext; typeEff: number } {
  const A = calcEffectiveAttack(attacker, move, conditions);
  const D = calcEffectiveDefense(defender, move, conditions);
  // §4.4 威力側 特性（はりきり/てつのこぶし/ピンチ強化 等）を反映した実効威力
  const powerEff = computeEffectivePower(attacker, move, conditions, defender);
  const base = calcBaseDamage(powerEff, A, D);

  // §5.3 タイプ相性（特性の無効化・貫通を反映）
  const typeEff = computeTypeEffectiveness(attacker, defender, move);

  // §5.2-4 STAB: 技タイプ = 使用者タイプ。適応力は ×2、それ以外 ×1.5。
  const isStab = attacker.species.types.includes(move.type);
  const stabMod = isStab ? (attacker.ability === 'adaptability' ? MOD.X2_0 : MOD.X1_5) : null;

  const isPhysical = move.category === 'physical';

  // §5.5 壁: 物理=リフレク / 特殊=ひかりのかべ。急所時は無視。
  const wallActive =
    !conditions.isCrit &&
    ((isPhysical && !!conditions.reflect) || (!isPhysical && !!conditions.lightScreen));

  const ctx: ModifierContext = {
    weatherMod: weatherDamageMod(conditions.weather ?? 'none', move.type),
    critMod: computeCritMod(attacker, !!conditions.isCrit),
    stabMod,
    typeEff,
    isPhysical,
    postTypeMods: computePostTypeMods(attacker, typeEff),
    burned: !!conditions.attackerBurned,
    wallActive,
    finalMods: computeFinalMods(attacker, defender, move, conditions, typeEff),
  };
  return { base, ctx, typeEff };
}

/**
 * §7 乱数16通りのダメージ（昇順）。
 * 丸めが乱数factorに依存するため、補正チェーンを 85〜100 で 16回フル実行する。
 */
export function calcDamageRange(
  attacker: PokemonState,
  defender: PokemonState,
  move: Move,
  conditions: Conditions = {},
): number[] {
  // スキン系特性のタイプ変化を入口で 1 度だけ解決（STAB・相性・持ち物すべてに反映）
  move = resolveMove(attacker, move);
  const { base, ctx, typeEff } = buildContext(attacker, defender, move, conditions);
  if (typeEff === 0) return new Array(16).fill(0); // 無効

  const rolls: number[] = [];
  for (let r = 85; r <= 100; r++) rolls.push(applyModifiers(base, r, ctx));
  rolls.sort((a, b) => a - b);
  return rolls;
}
