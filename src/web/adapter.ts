// ============================================================
// データ(JSON) → 計算エンジンの型 への変換アダプタ。
// UIは計算ロジックを持たない。ここでエンジンが受け取る形に組み立てるだけ。
// ============================================================
import pokemonData from '../../data/pokemon_data.json';
import moveData from '../../data/move_data.json';
import type {
  Species, PokemonState, Move, PokemonType, StatBlock, MoveCategory, AbilityId, ItemId,
} from '../types';
import { JA_TO_ABILITY } from './registry';

// ---- 生データの型（JSONの形） ----
interface RawForm {
  formName: string;
  formType: string;
  types: string[];
  abilities: string[] | null;
  baseStats: StatBlock;
  bst: number;
  megaStone?: string | null;
}
interface RawPokemon { dexNo: number; name: string; forms: RawForm[] }
interface RawMove {
  moveId: string; name: string; type: string;
  category: string; power: number | null; accuracy: number | null; contact: boolean | null;
  /** 技フラグ（punch/sound/slicing/recoil/hasSecondary。true のもののみ） */
  flags?: Record<string, boolean>;
}

// ---- フォルム一覧（ポケモン選択の単位）----
export interface FormEntry {
  key: string;            // dexNo:formName
  dexNo: number;
  speciesName: string;    // ベース種名
  formName: string;       // 表示名（フォルム込み）
  formType: string;       // base / mega / regional / other
  types: PokemonType[];
  /** 日本語特性候補（通常→隠れ）。[] = 特性なしが正式仕様 / null = データ未収録 */
  abilities: string[] | null;
  baseStats: StatBlock;
  bst: number;
}

export const FORMS: FormEntry[] = (pokemonData as RawPokemon[]).flatMap((p) =>
  p.forms.map((f) => ({
    key: `${p.dexNo}:${f.formName}`,
    dexNo: p.dexNo,
    speciesName: p.name,
    formName: f.formName,
    formType: f.formType,
    types: f.types as PokemonType[],
    abilities: f.abilities,
    baseStats: f.baseStats,
    bst: f.bst,
  })),
);

const ZERO_SP: StatBlock = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const ZERO_RANK = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

export function toSpecies(e: FormEntry): Species {
  return { name: e.formName, types: e.types, baseStats: e.baseStats };
}

/** フェーズ1の既定状態: SP0 / 無補正 / 特性なし / 持ち物なし / ランク0。 */
export function toState(e: FormEntry): PokemonState {
  return {
    species: toSpecies(e),
    nature: { plus: null, minus: null },
    sp: { ...ZERO_SP },
    ranks: { ...ZERO_RANK },
    ability: 'none',
    item: 'none',
  };
}

// ---- 技一覧 ----
// エンジンの calcDamage は power(数値) と physical/special のみ計算可能。
// 変化技(status)・可変威力(power=null=特殊技フラグ)はフェーズ1では選択対象外。
export interface MoveEntry {
  moveId: string;
  name: string;
  type: PokemonType;
  category: 'physical' | 'special';
  power: number;
  isContact: boolean;
  flags: NonNullable<Move['flags']>;
}

export const MOVES: MoveEntry[] = (moveData as RawMove[])
  .filter((m) => (m.category === 'physical' || m.category === 'special') && m.power != null)
  .map((m) => ({
    moveId: m.moveId,
    name: m.name,
    type: m.type as PokemonType,
    category: m.category as MoveCategory as 'physical' | 'special',
    power: m.power as number,
    isContact: !!m.contact,
    flags: (m.flags ?? {}) as NonNullable<Move['flags']>,
  }));

export function toMove(m: MoveEntry): Move {
  return { name: m.name, type: m.type, category: m.category, power: m.power, isContact: m.isContact, flags: m.flags };
}

// ---- フェーズ2: UI入力から PokemonState を組み立てる ----
export type NatureChoice = 'up' | 'neutral' | 'down';
const zeroSP = (): StatBlock => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const zeroRank = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

function natureFor(stat: 'atk' | 'spa' | 'def' | 'spd', choice: NatureChoice) {
  if (choice === 'up') return { plus: stat, minus: null };
  if (choice === 'down') return { plus: null, minus: stat };
  return { plus: null, minus: null };
}

export interface AttackerInput {
  form: FormEntry; isPhysical: boolean;
  sp: number; nature: NatureChoice; abilityJa: string; item: ItemId; rank: number;
}
export function buildAttacker(a: AttackerInput): PokemonState {
  const key = a.isPhysical ? 'atk' : 'spa';
  return {
    species: toSpecies(a.form),
    nature: natureFor(key, a.nature),
    sp: { ...zeroSP(), [key]: a.sp },
    ranks: { ...zeroRank(), [key]: a.rank },
    ability: (JA_TO_ABILITY[a.abilityJa] ?? 'none') as AbilityId,
    item: a.item,
  };
}

export interface DefenderInput {
  form: FormEntry; isPhysical: boolean;
  hpSp: number; defSp: number; nature: NatureChoice; abilityJa: string; item: ItemId; rank: number;
  currentHP?: number;
}
export function buildDefender(d: DefenderInput): PokemonState {
  const key = d.isPhysical ? 'def' : 'spd';
  return {
    species: toSpecies(d.form),
    nature: natureFor(key, d.nature),
    sp: { ...zeroSP(), hp: d.hpSp, [key]: d.defSp },
    ranks: { ...zeroRank(), [key]: d.rank },
    ability: (JA_TO_ABILITY[d.abilityJa] ?? 'none') as AbilityId,
    item: d.item,
    currentHP: d.currentHP,
  };
}

/** 相性倍率 → 日本語ラベル。 */
export function effectivenessLabel(eff: number): string {
  if (eff === 0) return '効果なし（×0）';
  if (eff === 0.25) return 'かなりいまひとつ（×0.25）';
  if (eff === 0.5) return 'いまひとつ（×0.5）';
  if (eff === 2) return '効果抜群（×2）';
  if (eff === 4) return 'ちょうばつぐん（×4）';
  return '等倍（×1）';
}

/** 同一ポケモン(dexNo)の全フォルム（メガ/リージョン切替用）。 */
export function siblingForms(form: FormEntry): FormEntry[] {
  return FORMS.filter((f) => f.dexNo === form.dexNo);
}

// ---- タイプ表示（日本語ラベル）----
export const TYPE_JA: Record<PokemonType, string> = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき', grass: 'くさ',
  ice: 'こおり', fighting: 'かくとう', poison: 'どく', ground: 'じめん', flying: 'ひこう',
  psychic: 'エスパー', bug: 'むし', rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン',
  dark: 'あく', steel: 'はがね', fairy: 'フェアリー',
};

export const TYPE_COLOR: Record<PokemonType, string> = {
  normal: '#9099a1', fire: '#ff9d55', water: '#4d90d5', electric: '#f4d23c', grass: '#63bb5b',
  ice: '#73cec0', fighting: '#ce4069', poison: '#ab6ac8', ground: '#d97746', flying: '#8fa9de',
  psychic: '#f97176', bug: '#90c12c', rock: '#c7b78b', ghost: '#5269ac', dragon: '#0a6dc4',
  dark: '#5a5366', steel: '#5a8ea1', fairy: '#ec8fe6',
};
