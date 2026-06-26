// ============================================================
// テスト用ダミーデータ（本物のデータは使わない・§9 は対象外）
// 計算ロジックから分離。手計算の都合で「綺麗な数値」になる種族値を採用。
// ============================================================
import type { Species, Move, Nature, PokemonState, StatBlock, RankBlock } from '../src/types';

// ---- 性格 ----
export const NEUTRAL: Nature = { plus: null, minus: null };
export const ATK_UP: Nature = { plus: 'atk', minus: 'spa' };   // いじっぱり相当（攻撃↑特攻↓）
export const SPA_UP: Nature = { plus: 'spa', minus: 'atk' };   // ひかえめ相当（特攻↑攻撃↓）

const NO_SP: StatBlock = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const NO_RANK: RankBlock = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

// ---- 種族（ダミー）----
// Emberon: ほのお単タイプ。攻撃側。atk/spa 種族値100 → 実数値が綺麗に出る。
export const EMBERON: Species = {
  name: 'Emberon',
  types: ['fire'],
  baseStats: { hp: 100, atk: 100, def: 80, spa: 100, spd: 80, spe: 90 },
};

// Normux: ノーマル単タイプ。防御側（相性を等倍に固定して手計算しやすく）。
//   hp種族値45 → 実HP120 / def・spd種族値80 → 実数値100。
export const NORMUX: Species = {
  name: 'Normux',
  types: ['normal'],
  baseStats: { hp: 45, atk: 70, def: 80, spa: 70, spd: 80, spe: 60 },
};

// Skylave: ほのお/ひこう 複合タイプ（複合タイプ要件）。
//   いわ技で4倍、くさ技で1/4 を作るための定番防御側。
export const SKYLAVE: Species = {
  name: 'Skylave',
  types: ['fire', 'flying'],
  baseStats: { hp: 80, atk: 90, def: 80, spa: 90, spd: 80, spe: 110 },
};

// Terrapin: じめん単タイプ。でんき無効・みず2倍弱点の確認用。
export const TERRAPIN: Species = {
  name: 'Terrapin',
  types: ['ground'],
  baseStats: { hp: 90, atk: 100, def: 100, spa: 60, spd: 70, spe: 50 },
};

// Boulduck: いわ単タイプ。砂嵐の特防×1.5 確認用。
export const BOULDUCK: Species = {
  name: 'Boulduck',
  types: ['rock'],
  baseStats: { hp: 80, atk: 90, def: 100, spa: 70, spd: 80, spe: 40 },
};

// Phantux: ゴースト単タイプ。きもったま/ふしぎなまもり 確認用。
//   def・spd種族値80 → 実数値100、hp種族値45 → 実HP120（NORMUXと同条件）。
export const PHANTUX: Species = {
  name: 'Phantux',
  types: ['ghost'],
  baseStats: { hp: 45, atk: 70, def: 80, spa: 70, spd: 80, spe: 60 },
};

// ---- 技（ダミー）----
export const FLAME_THROW: Move = { name: 'flameThrow', type: 'fire', category: 'special', power: 90, isContact: false };
export const AQUA_SHOT: Move = { name: 'aquaShot', type: 'water', category: 'physical', power: 80, isContact: true };
export const ROCK_SLAM: Move = { name: 'rockSlam', type: 'rock', category: 'physical', power: 75, isContact: false };
export const THUNDER: Move = { name: 'thunder', type: 'electric', category: 'special', power: 90, isContact: false };
export const LEAF_CUT: Move = { name: 'leafCut', type: 'grass', category: 'special', power: 80, isContact: false };
export const TACKLE: Move = { name: 'tackle', type: 'normal', category: 'physical', power: 50, isContact: true };
// 特性条件テスト用の追加技
export const ICE_BEAM: Move = { name: 'iceBeam', type: 'ice', category: 'special', power: 90, isContact: false };
export const THUNDER_PUNCH: Move = { name: 'thunderPunch', type: 'electric', category: 'physical', power: 75, isContact: true, flags: { punch: true } };
export const TAKE_DOWN: Move = { name: 'takeDown', type: 'normal', category: 'physical', power: 90, isContact: true, flags: { recoil: true } };
export const SLUDGE_BOMB: Move = { name: 'sludgeBomb', type: 'poison', category: 'special', power: 90, isContact: false, flags: { hasSecondary: true } };
export const QUAKE: Move = { name: 'quake', type: 'ground', category: 'physical', power: 100, isContact: false };
export const KARATE_CHOP: Move = { name: 'karateChop', type: 'fighting', category: 'physical', power: 75, isContact: true };

// ---- PokemonState を組み立てるヘルパー ----
export function makeState(
  species: Species,
  opts: Partial<Omit<PokemonState, 'species'>> = {},
): PokemonState {
  return {
    species,
    nature: opts.nature ?? NEUTRAL,
    sp: opts.sp ?? NO_SP,
    ranks: opts.ranks ?? NO_RANK,
    ability: opts.ability ?? 'none',
    item: opts.item ?? 'none',
    currentHP: opts.currentHP,
  };
}

export function sp(partial: Partial<StatBlock>): StatBlock {
  return { ...NO_SP, ...partial };
}

export function ranks(partial: Partial<RankBlock>): RankBlock {
  return { ...NO_RANK, ...partial };
}
