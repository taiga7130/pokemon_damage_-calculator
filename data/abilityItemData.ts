// ============================================================
// 特性・持ち物の「タイプ対応」データ（ロジックから分離）
// 倍率や適用位置のロジックは src/abilityItem.ts 側に持つ。
// タイプIDは pokemon_data.json / type_chart.json と同一の英語ID。
// ============================================================
import type { PokemonType, ItemId, AbilityId } from '../src/types';

/** タイプ強化アイテム（×1.2・攻撃側・最終乗算）: itemId → 強化するタイプ。 */
export const TYPE_BOOST_ITEMS: Partial<Record<ItemId, PokemonType>> = {
  charcoal: 'fire',
  mysticWater: 'water',
  magnet: 'electric',
  miracleSeed: 'grass',
  neverMeltIce: 'ice',
  blackBelt: 'fighting',
  poisonBarb: 'poison',
  softSand: 'ground',
  sharpBeak: 'flying',
  twistedSpoon: 'psychic',
  silverPowder: 'bug',
  hardStone: 'rock',
  spellTag: 'ghost',
  dragonFang: 'dragon',
  blackGlasses: 'dark',
  metalCoat: 'steel',
  pixiePlate: 'fairy',     // プレート類も同じ ×1.2 扱い
  silkScarf: 'normal',
};

/** 半減実（×0.5・防御側・効果抜群時のみ・1回・最終乗算）: itemId → 半減するタイプ。 */
export const HALF_BERRIES: Partial<Record<ItemId, PokemonType>> = {
  occaBerry: 'fire',
  passhoBerry: 'water',
  wacanBerry: 'electric',
  rindoBerry: 'grass',
  yacheBerry: 'ice',
  chopleBerry: 'fighting',
  kebiaBerry: 'poison',
  shucaBerry: 'ground',
  cobaBerry: 'flying',
  payapaBerry: 'psychic',
  tangaBerry: 'bug',
  chartiBerry: 'rock',
  kasibBerry: 'ghost',
  habanBerry: 'dragon',
  colburBerry: 'dark',
  babiriBerry: 'steel',
  roseliBerry: 'fairy',
  chilanBerry: 'normal',   // ノーマル技半減（要検証枠だが対応のみ保持）
};

/** タイプ無効化特性（被ダメ0・相性表より優先）: abilityId → 無効化するタイプ。 */
export const IMMUNITY_ABILITIES: Partial<Record<AbilityId, PokemonType>> = {
  levitate: 'ground',
  risingEel: 'ground',   // うなぎのぼり: ふゆうと同じ地面無効（撃破時の能力上昇はダメージ計算外）
  waterAbsorb: 'water',
  stormDrain: 'water',
  voltAbsorb: 'electric',
  lightningRod: 'electric',
  motorDrive: 'electric',
  flashFire: 'fire',
  sapSipper: 'grass',
  wellBakedBody: 'fire',
  earthEater: 'ground',
  // drySkin（みず無効）は炎被ダメ補正と複合のため src 側で個別判定
};

/** ピンチ強化特性（自HP1/3以下で該当タイプ技×1.5）: abilityId → 対象タイプ。 */
export const PINCH_ABILITIES: Partial<Record<AbilityId, PokemonType>> = {
  blaze: 'fire',
  overgrow: 'grass',
  torrent: 'water',
  swarm: 'bug',
};

/** すなのちから の対象タイプ（砂嵐時 ×1.3）。 */
export const SAND_FORCE_TYPES: ReadonlySet<PokemonType> = new Set(['rock', 'ground', 'steel']);
