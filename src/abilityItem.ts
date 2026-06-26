// ============================================================
// 特性・持ち物の補正ロジック（適用位置ごとに分離）
//   - ステータス側  : A_eff / D_eff（effective.ts から利用）
//   - 威力側        : power_eff（damage.ts buildContext から利用）
//   - 急所段 / 相性後 / 最終乗算 / タイプ無効化（damage.ts から利用）
// 倍率の丸めは pokeRound（§2.2）。タイプ無効化(×0)のみ例外。
// ============================================================
import type { PokemonState, Move, Conditions, PokemonType } from './types';
import { pokeRound, MOD } from './pokeRound';
import { getStatValue } from './stats';
import { TYPE_CHART } from './typeChart';
import {
  TYPE_BOOST_ITEMS, HALF_BERRIES, IMMUNITY_ABILITIES, PINCH_ABILITIES, SAND_FORCE_TYPES,
} from '../data/abilityItemData';

const isPhysical = (m: Move) => m.category === 'physical';

/** 単体タイプ相性値（chart に無ければ 1）。 */
function chartValue(moveType: PokemonType, defType: PokemonType): number {
  const v = TYPE_CHART[moveType][defType];
  return v === undefined ? 1 : v;
}

/** 攻撃側がHP1/3以下か（ピンチ強化特性の発動条件）。 */
function attackerInPinch(attacker: PokemonState): boolean {
  const maxHP = getStatValue(attacker, 'hp');
  const cur = attacker.currentHP ?? maxHP;
  return cur * 3 <= maxHP; // cur ≤ maxHP/3
}

/** 防御側がHP満タンか（マルチスケイル等）。 */
function defenderAtFull(defender: PokemonState): boolean {
  const maxHP = getStatValue(defender, 'hp');
  return (defender.currentHP ?? maxHP) === maxHP;
}

// ------------------------------------------------------------
// [ステータス側] A_eff の特性/持ち物補正（ランク補正の後に適用）
// ------------------------------------------------------------
export function applyAttackStatMods(stat: number, attacker: PokemonState, move: Move): number {
  const phys = isPhysical(move);
  // ちからもち / ヨガパワー: 物理攻撃 ×2
  if (phys && (attacker.ability === 'hugePower' || attacker.ability === 'purePower')) {
    stat = pokeRound(stat, MOD.X2_0);
  }
  // ごりむちゅう: 物理攻撃 ×1.5
  if (phys && attacker.ability === 'gorillaTactics') {
    stat = pokeRound(stat, MOD.X1_5);
  }
  // こだわりハチマキ（物理）/ こだわりメガネ（特殊）: ×1.5
  if (phys && attacker.item === 'choiceBand') stat = pokeRound(stat, MOD.X1_5);
  if (!phys && attacker.item === 'choiceSpecs') stat = pokeRound(stat, MOD.X1_5);
  return stat;
}

// ------------------------------------------------------------
// [ステータス側] D_eff の持ち物補正（ランク・天候補正の後に適用）
// ------------------------------------------------------------
export function applyDefenseStatMods(stat: number, defender: PokemonState, move: Move): number {
  // とつげきチョッキ: 特殊技被弾時に特防 ×1.5
  if (!isPhysical(move) && defender.item === 'assaultVest') {
    stat = pokeRound(stat, MOD.X1_5);
  }
  return stat;
}

// ------------------------------------------------------------
// [威力側] power_eff（基礎ダメージ計算前）
// ------------------------------------------------------------
export function computeEffectivePower(attacker: PokemonState, move: Move, conditions: Conditions): number {
  let p = move.power;
  const ab = attacker.ability;
  const phys = isPhysical(move);
  const f = move.flags ?? {};

  if (ab === 'hustle' && phys) p = pokeRound(p, MOD.X1_5);          // はりきり
  if (ab === 'ironFist' && f.punch) p = pokeRound(p, MOD.X1_2);     // てつのこぶし
  if (ab === 'reckless' && f.recoil) p = pokeRound(p, MOD.X1_2);    // すてみ
  if (ab === 'sheerForce' && f.hasSecondary) p = pokeRound(p, MOD.X1_3); // ちからずく
  if (ab === 'technician' && move.power <= 60) p = pokeRound(p, MOD.X1_5); // テクニシャン（基礎威力60以下）
  if (ab === 'sandForce' && conditions.weather === 'sand' && SAND_FORCE_TYPES.has(move.type)) {
    p = pokeRound(p, MOD.X1_3); // すなのちから
  }
  // ピンチ強化（自HP1/3以下 かつ 対象タイプ）
  const pinchType = PINCH_ABILITIES[ab as keyof typeof PINCH_ABILITIES];
  if (pinchType && move.type === pinchType && attackerInPinch(attacker)) {
    p = pokeRound(p, MOD.X1_5);
  }
  // もらいび発動後: 自分の炎技 ×1.5
  if (ab === 'flashFire' && conditions.flashFireActive && move.type === 'fire') {
    p = pokeRound(p, MOD.X1_5);
  }
  return p;
}

// ------------------------------------------------------------
// [タイプ無効化 / 相性] 特性を反映した総合相性倍率
// ------------------------------------------------------------
export function computeTypeEffectiveness(
  attacker: PokemonState, defender: PokemonState, move: Move,
): number {
  // きもったま / しんがん: ノーマル・かくとう技がゴーストの無効を貫通
  const scrappy =
    (attacker.ability === 'scrappy' || attacker.ability === 'mindsEye') &&
    (move.type === 'normal' || move.type === 'fighting');

  let eff = 1;
  for (const t of defender.species.types) {
    let m = chartValue(move.type, t);
    if (scrappy && t === 'ghost' && m === 0) m = 1; // ゴースト無効を貫通
    eff *= m;
  }

  // 防御側のタイプ無効化特性（相性表より優先）
  const immune = IMMUNITY_ABILITIES[defender.ability as keyof typeof IMMUNITY_ABILITIES];
  if (immune === move.type) eff = 0;
  if (defender.ability === 'drySkin' && move.type === 'water') eff = 0; // かんそうはだ: みず無効
  // ふしぎなまもり: 効果抜群(≥2)以外は全て無効
  if (defender.ability === 'wonderGuard' && eff < 2) eff = 0;

  return eff;
}

// ------------------------------------------------------------
// [急所段] スナイパーは ×1.5 の代わりに ×2.25
// ------------------------------------------------------------
export function computeCritMod(attacker: PokemonState, isCrit: boolean): number | null {
  if (!isCrit) return null;
  return attacker.ability === 'sniper' ? MOD.X2_25 : MOD.X1_5;
}

// ------------------------------------------------------------
// [相性後] いろめがね: いまひとつ(≤0.5)で ×2
// ------------------------------------------------------------
export function computePostTypeMods(attacker: PokemonState, typeEff: number): number[] {
  const mods: number[] = [];
  if (attacker.ability === 'tintedLens' && typeEff > 0 && typeEff <= 0.5) {
    mods.push(MOD.X2_0);
  }
  return mods;
}

// ------------------------------------------------------------
// [最終乗算] 持ち物（攻撃側）＋ 防御側特性 ＋ 半減実
//   群内順は本編慣例に倣う暫定（複数併用の確定数は damekei で要裏取り）。
// ------------------------------------------------------------
export function computeFinalMods(
  attacker: PokemonState, defender: PokemonState, move: Move,
  conditions: Conditions, typeEff: number,
): number[] {
  const mods: number[] = [];
  const phys = isPhysical(move);
  const superEff = typeEff >= 2;

  // --- 攻撃側 持ち物 ---
  if (TYPE_BOOST_ITEMS[attacker.item as keyof typeof TYPE_BOOST_ITEMS] === move.type) {
    mods.push(MOD.X1_2); // タイプ強化アイテム
  }
  if (attacker.item === 'muscleBand' && phys) mods.push(MOD.X1_1); // ちからのハチマキ
  if (attacker.item === 'wiseGlasses' && !phys) mods.push(MOD.X1_1); // ものしりメガネ
  if (attacker.item === 'expertBelt' && superEff) mods.push(MOD.X1_2); // たつじんのおび
  if (attacker.item === 'lifeOrb') mods.push(MOD.X1_3); // いのちのたま

  // --- 防御側 特性 ---
  const dab = defender.ability;
  if (dab === 'thickFat' && (move.type === 'fire' || move.type === 'ice')) mods.push(MOD.X0_5);
  if (dab === 'heatproof' && move.type === 'fire') mods.push(MOD.X0_5);
  if (dab === 'drySkin' && move.type === 'fire') mods.push(MOD.X1_25); // 炎被ダメ ×1.25
  if (dab === 'iceScales' && !phys) mods.push(MOD.X0_5);
  if ((dab === 'multiscale' || dab === 'shadowShield') && defenderAtFull(defender)) mods.push(MOD.X0_5);
  if ((dab === 'solidRock' || dab === 'filter' || dab === 'prismArmor') && superEff) mods.push(MOD.X0_75);
  if (dab === 'fluffy') {
    if (move.isContact) mods.push(MOD.X0_5); // 接触 半減
    if (move.type === 'fire') mods.push(MOD.X2_0); // 炎 2倍（接触炎は相殺）
  }

  // --- 防御側 半減実（効果抜群時のみ・1回） ---
  const berryType = HALF_BERRIES[defender.item as keyof typeof HALF_BERRIES];
  const berryOn = conditions.berryActive !== false; // 既定 true
  if (berryType === move.type && superEff && berryOn) mods.push(MOD.X0_5);

  return mods;
}
