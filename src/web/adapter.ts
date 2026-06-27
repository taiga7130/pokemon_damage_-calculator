// ============================================================
// データ(JSON) → 計算エンジンの型 への変換アダプタ。
// UIは計算ロジックを持たない。ここでエンジンが受け取る形に組み立てるだけ。
// ============================================================
import pokemonData from '../../data/pokemon_data.json';
import moveData from '../../data/move_data.json';
import type { Species, PokemonState, Move, PokemonType, StatBlock, MoveCategory } from '../types';

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
}

// ---- フォルム一覧（ポケモン選択の単位）----
export interface FormEntry {
  key: string;            // dexNo:formName
  dexNo: number;
  speciesName: string;    // ベース種名
  formName: string;       // 表示名（フォルム込み）
  formType: string;       // base / mega / regional / other
  types: PokemonType[];
  abilities: string[];    // 日本語特性候補（フェーズ1では表示のみ）
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
    abilities: f.abilities ?? [],
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
  }));

export function toMove(m: MoveEntry): Move {
  return { name: m.name, type: m.type, category: m.category, power: m.power, isContact: m.isContact };
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
