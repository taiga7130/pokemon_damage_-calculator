// ============================================================
// 型定義（計算エンジン・コア）
// 仕様書 champions_damage_spec.md を正典とする。
// ============================================================

// ---- 基本 ----
export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
/** ランク補正・性格補正の対象（HP を除く） */
export type BattleStatKey = Exclude<StatKey, 'hp'>;

export type StatBlock = Record<StatKey, number>;          // 種族値 / 実数値 / SP
export type RankBlock = Record<BattleStatKey, number>;    // -6〜+6

// ---- データ（種族・技）: 計算ロジックから分離 ----
export interface Species {
  name: string;
  /** 単タイプは [t]、複合は [t1, t2] */
  types: PokemonType[];
  baseStats: StatBlock;
}

export type MoveCategory = 'physical' | 'special';

export interface Move {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number;
  isContact?: boolean;
  /** 将来の特性/持ち物用（今回コアでは未使用） */
  flags?: { punch?: boolean };
}

// ---- 個体の状態（計算入力）----
export interface Nature {
  /** ×1.1 になるステータス（無補正性格なら null） */
  plus: BattleStatKey | null;
  /** ×0.9 になるステータス（plus===minus は無補正扱い） */
  minus: BattleStatKey | null;
}

// 今回コアで効くものだけ。網羅せず確定リスト方式（§4.4）。
//   hugePower   : ちからもち / ヨガパワー（攻撃 ×2）
//   adaptability: 適応力（STAB ×2）
export type AbilityId = 'none' | 'hugePower' | 'adaptability';

// 最終乗算アイテム。今回コアは いのちのたま(×1.3) のみ実体実装。
export type ItemId = 'none' | 'lifeOrb';

export interface PokemonState {
  species: Species;
  nature: Nature;
  /** 1 SP = 実数値 +1（上限: 1ステ32 / 合計66。検証は validateSP、計算では強制しない） */
  sp: StatBlock;
  ranks: RankBlock;
  ability?: AbilityId; // 既定 'none'
  item?: ItemId;       // 既定 'none'
  /** HP依存技や残りHPからの確定数用。既定 = 最大HP */
  currentHP?: number;
}

// ---- 戦況条件 ----
export type Weather = 'none' | 'sun' | 'rain' | 'sand' | 'snow';

export interface Conditions {
  weather?: Weather;        // 既定 'none'
  isCrit?: boolean;         // 急所
  attackerBurned?: boolean; // やけど（物理のみ ×0.5）
  reflect?: boolean;        // リフレクター（物理を半減）
  lightScreen?: boolean;    // ひかりのかべ（特殊を半減）
}

// ---- 出力 ----
export interface KOResult {
  /** KO に要する打数（確定 or 乱数の n） */
  hits: number;
  /**
   * その打数で KO できる確率 0..1。
   * 多発はロール組み合わせ総数ベースで算出する。
   * 例) 2発なら 16×16=256 通り中、合計が targetHP 以上になる組み合わせ数 ÷ 256。
   */
  probability: number;
  /** probability === 1（全組み合わせで KO） */
  guaranteed: boolean;
  /**
   * 表示ラベル。% は小数第1位まで（damekei 照合を見据えた丸め桁）。
   * 例) "確定1発" / "乱数1発 (31.3%)" / "確定2発"
   */
  label: string;
}

export interface DamageResult {
  /** 16通りのダメージ（昇順） */
  rolls: number[];
  minDamage: number;
  maxDamage: number;
  /** 対 最大HP %（小数第1位まで） */
  minPercent: number;
  maxPercent: number;
  ko: KOResult;
  /** タイプ相性 0倍 */
  isImmune: boolean;
}

/**
 * applyModifiers 内部用の中間型。
 * calcDamageRange が 1 度だけ構築し、乱数16通りループで使い回す。
 */
export interface ModifierContext {
  /** §5.2-1 天候の威力補正（4096基準 modifier）。無ければ null */
  weatherMod: number | null;
  /** §5.2-2 急所 ×1.5 */
  isCrit: boolean;
  /** §5.2-4 STAB（6144=×1.5 / 8192=適応力×2）。一致しなければ null */
  stabMod: number | null;
  /** §5.2-5 タイプ相性 0 / .25 / .5 / 1 / 2 / 4 */
  typeEff: number;
  isPhysical: boolean;
  /** §5.2-6 やけど（物理のみ適用） */
  burned: boolean;
  /** §5.2-7 壁が有効か（急所時は無効化済み） */
  wallActive: boolean;
  /** §5.2-8 持ち物（5325=いのちのたま×1.3）。無ければ null */
  itemMod: number | null;
}
