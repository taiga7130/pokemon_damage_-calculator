// ============================================================
// UI表示用レジストリ: エンジンの AbilityId / ItemId ⇔ 日本語ラベル
// 実装済み（Tier1+2）の特性・持ち物のみ計算に反映される。
// ============================================================
import type { AbilityId, ItemId } from '../types';

/** 実装済み特性 → 日本語名。 */
export const ABILITY_JA: Record<Exclude<AbilityId, 'none'>, string> = {
  hugePower: 'ちからもち', purePower: 'ヨガパワー', gorillaTactics: 'ごりむちゅう',
  adaptability: 'てきおうりょく',
  hustle: 'はりきり', sheerForce: 'ちからずく', ironFist: 'てつのこぶし',
  toughClaws: 'かたいツメ', flameMane: 'ほのおのたてがみ',
  sharpness: 'きれあじ', steelySpirit: 'はがねのせいしん', punkRock: 'パンクロック',
  aerilate: 'スカイスキン', pixilate: 'フェアリースキン', refrigerate: 'フリーズスキン',
  galvanize: 'エレキスキン', dragonSkin: 'ドラゴンスキン',
  reckless: 'すてみ', technician: 'テクニシャン', sandForce: 'すなのちから',
  blaze: 'もうか', overgrow: 'しんりょく', torrent: 'げきりゅう', swarm: 'むしのしらせ',
  flashFire: 'もらいび', sniper: 'スナイパー', tintedLens: 'いろめがね',
  thickFat: 'あついしぼう', heatproof: 'たいねつ', iceScales: 'こおりのりんぷん',
  multiscale: 'マルチスケイル', shadowShield: 'ファントムガード',
  solidRock: 'ハードロック', filter: 'フィルター', prismArmor: 'プリズムアーマー',
  fluffy: 'もふもふ', drySkin: 'かんそうはだ', auraGuard: 'はどうのぼうご', furCoat: 'ファーコート',
  levitate: 'ふゆう', risingEel: 'うなぎのぼり', waterAbsorb: 'ちょすい', stormDrain: 'よびみず',
  voltAbsorb: 'ちくでん', lightningRod: 'ひらいしん', motorDrive: 'でんきエンジン',
  sapSipper: 'そうしょく', wellBakedBody: 'ねつぼうそう', earthEater: 'どしょく',
  wonderGuard: 'ふしぎなまもり', scrappy: 'きもったま', mindsEye: 'しんがん',
};

/** 日本語名 → AbilityId（実装済みのみ。未実装は 'none' 扱い）。 */
export const JA_TO_ABILITY: Record<string, AbilityId> = Object.fromEntries(
  (Object.entries(ABILITY_JA) as [AbilityId, string][]).map(([id, ja]) => [ja, id]),
);

/** 実装済み特性の日本語名リスト（手動選択用）。 */
export const IMPLEMENTED_ABILITY_JA: string[] = Object.values(ABILITY_JA);

/** 計算に反映される特性か（日本語名で判定）。 */
export function isEffectiveAbility(ja: string): boolean {
  return ja in JA_TO_ABILITY;
}

/** 持ち物 → 日本語名（グループ付き）。 */
interface ItemDef { id: ItemId; ja: string; group: string }
export const ITEMS: ItemDef[] = [
  { id: 'none', ja: '持ち物なし', group: '' },
  { id: 'lifeOrb', ja: 'いのちのたま', group: '汎用' },
  { id: 'choiceBand', ja: 'こだわりハチマキ', group: '汎用' },
  { id: 'choiceSpecs', ja: 'こだわりメガネ', group: '汎用' },
  { id: 'expertBelt', ja: 'たつじんのおび', group: '汎用' },
  { id: 'assaultVest', ja: 'とつげきチョッキ', group: '汎用' },
  { id: 'muscleBand', ja: 'ちからのハチマキ', group: '汎用' },
  { id: 'wiseGlasses', ja: 'ものしりメガネ', group: '汎用' },
  { id: 'normalGem', ja: 'ノーマルジュエル(無・1回)', group: '汎用' },
  // タイプ強化アイテム（×1.2）
  { id: 'charcoal', ja: 'もくたん(炎)', group: 'タイプ強化' },
  { id: 'mysticWater', ja: 'しんぴのしずく(水)', group: 'タイプ強化' },
  { id: 'magnet', ja: 'じしゃく(電)', group: 'タイプ強化' },
  { id: 'miracleSeed', ja: 'きせきのタネ(草)', group: 'タイプ強化' },
  { id: 'neverMeltIce', ja: 'とけないこおり(氷)', group: 'タイプ強化' },
  { id: 'blackBelt', ja: 'くろおび(闘)', group: 'タイプ強化' },
  { id: 'poisonBarb', ja: 'どくバリ(毒)', group: 'タイプ強化' },
  { id: 'softSand', ja: 'やわらかいすな(地)', group: 'タイプ強化' },
  { id: 'sharpBeak', ja: 'するどいくちばし(飛)', group: 'タイプ強化' },
  { id: 'twistedSpoon', ja: 'まがったスプーン(超)', group: 'タイプ強化' },
  { id: 'silverPowder', ja: 'ぎんのこな(虫)', group: 'タイプ強化' },
  { id: 'hardStone', ja: 'かたいいし(岩)', group: 'タイプ強化' },
  { id: 'spellTag', ja: 'のろいのおふだ(霊)', group: 'タイプ強化' },
  { id: 'dragonFang', ja: 'りゅうのキバ(竜)', group: 'タイプ強化' },
  { id: 'blackGlasses', ja: 'くろいメガネ(悪)', group: 'タイプ強化' },
  { id: 'metalCoat', ja: 'メタルコート(鋼)', group: 'タイプ強化' },
  { id: 'pixiePlate', ja: 'せいれいプレート(妖)', group: 'タイプ強化' },
  { id: 'silkScarf', ja: 'シルクのスカーフ(無)', group: 'タイプ強化' },
  // 半減実（効果抜群時 ×0.5）
  { id: 'occaBerry', ja: 'オッカのみ(炎半減)', group: '半減実' },
  { id: 'passhoBerry', ja: 'イトケのみ(水半減)', group: '半減実' },
  { id: 'wacanBerry', ja: 'ビアーのみ(電半減)', group: '半減実' },
  { id: 'rindoBerry', ja: 'リリバのみ(草半減)', group: '半減実' },
  { id: 'yacheBerry', ja: 'ヤチェのみ(氷半減)', group: '半減実' },
  { id: 'chopleBerry', ja: 'ヨプのみ(闘半減)', group: '半減実' },
  { id: 'kebiaBerry', ja: 'ビビリのみ(毒半減)', group: '半減実' },
  { id: 'shucaBerry', ja: 'シュカのみ(地半減)', group: '半減実' },
  { id: 'cobaBerry', ja: 'バコウのみ(飛半減)', group: '半減実' },
  { id: 'payapaBerry', ja: 'ウタンのみ(超半減)', group: '半減実' },
  { id: 'tangaBerry', ja: 'タンガのみ(虫半減)', group: '半減実' },
  { id: 'chartiBerry', ja: 'ソクノのみ(岩半減)', group: '半減実' },
  { id: 'kasibBerry', ja: 'カシブのみ(霊半減)', group: '半減実' },
  { id: 'habanBerry', ja: 'ハバンのみ(竜半減)', group: '半減実' },
  { id: 'colburBerry', ja: 'ナモのみ(悪半減)', group: '半減実' },
  { id: 'babiriBerry', ja: 'ホズのみ(鋼半減)', group: '半減実' },
  { id: 'roseliBerry', ja: 'ロゼルのみ(妖半減)', group: '半減実' },
  { id: 'chilanBerry', ja: 'いろいろのみ(無半減)', group: '半減実' },
];
