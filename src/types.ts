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
  /**
   * 技フラグ（特性条件の判定用）。move_data に無いものは必要技のみ補完する想定。
   *   punch       : パンチ技（てつのこぶし）
   *   recoil      : 反動技（すてみ）
   *   hasSecondary: 追加効果を持つ技（ちからずく）
   *   sound/slicing: Tier3 用（パンクロック/きれあじ）。今回未使用だが型は用意。
   */
  flags?: { punch?: boolean; recoil?: boolean; hasSecondary?: boolean; sound?: boolean; slicing?: boolean };
}

// ---- 個体の状態（計算入力）----
export interface Nature {
  /** ×1.1 になるステータス（無補正性格なら null） */
  plus: BattleStatKey | null;
  /** ×0.9 になるステータス（plus===minus は無補正扱い） */
  minus: BattleStatKey | null;
}

// ダメージに効く特性（確定リスト方式・§4.4）。Tier1+Tier2 を実装。
// Tier3（トランジスタ等・倍率要検証）は未実装。
export type AbilityId =
  | 'none'
  // ステータス側
  | 'hugePower' | 'purePower'      // ちからもち / ヨガパワー（物理攻撃×2）
  | 'gorillaTactics'              // ごりむちゅう（物理攻撃×1.5）
  // STAB
  | 'adaptability'                // てきおうりょく（STAB×2）
  // 威力側
  | 'hustle' | 'sheerForce' | 'ironFist' | 'reckless' | 'technician'
  | 'sandForce'                   // すなのちから
  | 'blaze' | 'overgrow' | 'torrent' | 'swarm'   // ピンチ強化
  | 'flashFire'                   // もらいび（炎無効＋発動後 自炎技×1.5）
  // 急所段
  | 'sniper'                      // スナイパー（急所×2.25）
  // 相性後
  | 'tintedLens'                  // いろめがね（いまひとつ×2）
  // 最終乗算（防御側）
  | 'thickFat' | 'heatproof' | 'iceScales'
  | 'multiscale' | 'shadowShield'
  | 'solidRock' | 'filter' | 'prismArmor'
  | 'fluffy' | 'drySkin'
  // タイプ無効化（防御側）
  | 'levitate' | 'waterAbsorb' | 'stormDrain' | 'voltAbsorb' | 'lightningRod'
  | 'motorDrive' | 'sapSipper' | 'wellBakedBody' | 'earthEater'
  | 'wonderGuard'
  // タイプ無効化の貫通（攻撃側）
  | 'scrappy' | 'mindsEye';

// ダメージに効く持ち物（確定リスト方式・§4.4 / §3）。Tier1+Tier2 を実装。
// 汎用タイプ強化アイテム/半減実は data/abilityItemData.ts でタイプにマップ。
export type ItemId =
  | 'none' | 'lifeOrb'
  | 'choiceBand' | 'choiceSpecs' | 'expertBelt' | 'assaultVest'
  | 'muscleBand' | 'wiseGlasses'
  // タイプ強化アイテム（×1.2・攻撃側・最終乗算）
  | 'charcoal' | 'mysticWater' | 'magnet' | 'miracleSeed' | 'neverMeltIce'
  | 'blackBelt' | 'poisonBarb' | 'softSand' | 'sharpBeak' | 'twistedSpoon'
  | 'silverPowder' | 'hardStone' | 'spellTag' | 'dragonFang' | 'blackGlasses'
  | 'metalCoat' | 'pixiePlate' | 'silkScarf'
  // 半減実（×0.5・防御側・効果抜群時・最終乗算）
  | 'occaBerry' | 'passhoBerry' | 'wacanBerry' | 'rindoBerry' | 'yacheBerry'
  | 'chopleBerry' | 'kebiaBerry' | 'shucaBerry' | 'cobaBerry' | 'payapaBerry'
  | 'tangaBerry' | 'chartiBerry' | 'kasibBerry' | 'habanBerry' | 'colburBerry'
  | 'babiriBerry' | 'roseliBerry' | 'chilanBerry';

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
  /** もらいび発動後の状態（攻撃側の炎技 ×1.5）。既定 false */
  flashFireActive?: boolean;
  /** 半減実を発動扱いにするか（計算機ではユーザー選択）。既定 true（持っていれば発動） */
  berryActive?: boolean;
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
  /** §5.2-2 急所の補正（6144=×1.5 / 9216=スナイパー×2.25）。急所でなければ null */
  critMod: number | null;
  /** §5.2-4 STAB（6144=×1.5 / 8192=適応力×2）。一致しなければ null */
  stabMod: number | null;
  /** §5.2-5 タイプ相性 0 / .25 / .5 / 1 / 2 / 4（特性無効化・貫通を反映済み） */
  typeEff: number;
  isPhysical: boolean;
  /** §5.2-5後 相性適用直後の補正（いろめがね ×2 等）。順に pokeRound 適用 */
  postTypeMods: number[];
  /** §5.2-6 やけど（物理のみ適用） */
  burned: boolean;
  /** §5.2-7 壁が有効か（急所時は無効化済み） */
  wallActive: boolean;
  /**
   * §5.2-8 最終乗算群（持ち物＋防御側特性）。順に pokeRound 適用。
   * 注: 群内の適用順は本編慣例に倣う暫定。複数併用時の確定数は damekei で要裏取り。
   */
  finalMods: number[];
}
