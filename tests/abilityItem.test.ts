import { describe, it, expect } from 'vitest';
import { calcDamageRange } from '../src/damage';
import { calcDamage } from '../src/index';
import { calcEffectiveAttack } from '../src/effective';
import { computeEffectivePower, computeCritMod, computePostTypeMods } from '../src/abilityItem';
import { MOD } from '../src/pokeRound';
import {
  makeState, EMBERON, NORMUX, SKYLAVE, PHANTUX,
  AQUA_SHOT, THUNDER, FLAME_THROW, ROCK_SLAM, TACKLE,
  THUNDER_PUNCH, TAKE_DOWN, SLUDGE_BOMB, QUAKE, KARATE_CHOP, ICE_BEAM,
} from '../data/dummy';
import type { PokemonState, Move, Conditions } from '../src/types';

// 基準: Emberon(ほのお) atk=spa=120 / Normux(ノーマル) def=spd=100, HP=120
// Skylave(ほのお/ひこう) def=100, HP=155 / Phantux(ゴースト) def=spd=100
const E = (o: Partial<PokemonState> = {}) => makeState(EMBERON, o);
const N = (o: Partial<PokemonState> = {}) => makeState(NORMUX, o);
const SKY = (o: Partial<PokemonState> = {}) => makeState(SKYLAVE, o);
const max = (a: PokemonState, d: PokemonState, m: Move, c: Conditions = {}) => {
  const r = calcDamageRange(a, d, m, c);
  return r[r.length - 1];
};

// ============================================================
// [ステータス側] A_eff / D_eff を変える補正（基礎ダメージから変わる）
// ============================================================
describe('ステータス側補正（こだわり系・とつげきチョッキ）', () => {
  it('こだわりハチマキ: 物理攻撃×1.5 を「ステータス側」で適用（最終乗算と結果が異なる）', () => {
    // AQUA_SHOT(水・物理80) vs Normux。STAB無・等倍。素のbase=44。
    // ステータス側: A=pokeRound(120,6144)=180 → base=floor(floor(22*80*180/100)/50)+2
    //   =floor(3168/50)+2=63+2=65。 r=100で他補正無し→65。
    // もし同じ×1.5を「最終乗算」で掛けたら pokeRound(44,6144)=66 になり 65 とは異なる。
    expect(max(E({ item: 'choiceBand' }), N(), AQUA_SHOT)).toBe(65);
    expect(max(E(), N(), AQUA_SHOT)).toBe(44); // 持ち物なし
    // 位置の違いの明示: 最終×1.5なら66
    expect(Math.floor((44 * 6144 + 2048) / 4096)).toBe(66);
  });

  it('こだわりメガネ: 特殊攻撃×1.5（THUNDER 電・特殊90 vs Normux）', () => {
    // A=180 → base=floor(floor(22*90*180/100)/50)+2=floor(3564/50)+2=71+2=73
    expect(max(E({ item: 'choiceSpecs' }), N(), THUNDER)).toBe(73);
    expect(max(E(), N(), THUNDER)).toBe(49);
  });

  it('ごりむちゅう: 物理攻撃×1.5（こだわりハチマキと同一処理）', () => {
    expect(max(E({ ability: 'gorillaTactics' }), N(), AQUA_SHOT)).toBe(65);
  });

  it('ちからもち/ヨガパワー: 物理攻撃×2（A_eff=240）', () => {
    expect(calcEffectiveAttack(E({ ability: 'hugePower' }), AQUA_SHOT, {})).toBe(240);
    expect(calcEffectiveAttack(E({ ability: 'purePower' }), AQUA_SHOT, {})).toBe(240);
  });

  it('とつげきチョッキ: 特殊技に対し特防×1.5（D_eff側）', () => {
    // D=spd100→pokeRound(100,6144)=150。base=floor(floor(22*90*120/150)/50)+2
    //   =floor(1584/50)+2=31+2=33
    expect(max(E(), N({ item: 'assaultVest' }), THUNDER)).toBe(33);
    expect(max(E(), N(), THUNDER)).toBe(49);
  });
});

// ============================================================
// [威力側] power_eff を変える補正
// ============================================================
describe('威力側補正', () => {
  it('てつのこぶし: パンチ技のみ威力×1.2', () => {
    // THUNDER_PUNCH(電・物理75・punch): pow=pokeRound(75,4915)=90 → base=49（none=41）
    expect(max(E({ ability: 'ironFist' }), N(), THUNDER_PUNCH)).toBe(49);
    expect(max(E(), N(), THUNDER_PUNCH)).toBe(41);
    // 非パンチ技には無効果
    expect(max(E({ ability: 'ironFist' }), N(), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT));
  });

  it('かたいツメ: 接触技のみ威力×1.3', () => {
    // AQUA_SHOT(水・物理80・接触): pokeRound(80, 5325) = floor(80*5325/4096 + 0.5) = 104
    expect(computeEffectivePower(E({ ability: 'toughClaws' }), AQUA_SHOT, {})).toBe(104);
    // 非接触技(ROCK_SLAM/QUAKE)には無効果
    expect(computeEffectivePower(E({ ability: 'toughClaws' }), ROCK_SLAM, {})).toBe(ROCK_SLAM.power);
    expect(computeEffectivePower(E({ ability: 'toughClaws' }), QUAKE, {})).toBe(QUAKE.power);
    // 特殊でも接触なら乗る（判定は接触フラグのみ。エンジンは分類で分岐しない）
    expect(max(E({ ability: 'toughClaws' }), N(), AQUA_SHOT)).toBeGreaterThan(max(E(), N(), AQUA_SHOT));
  });

  it('ほのおのたてがみ: ほのお技×1.5（ピンチ条件なし・他タイプは不変）', () => {
    // FLAME_THROW(炎90): pokeRound(90, 6144) = 135。満タンHPでも発動する点が もうか との違い。
    expect(computeEffectivePower(E({ ability: 'flameMane' }), FLAME_THROW, {})).toBe(135);
    expect(computeEffectivePower(E({ ability: 'blaze' }), FLAME_THROW, {})).toBe(90); // もうかは満タンでは不発
    // 炎以外には無効果
    expect(computeEffectivePower(E({ ability: 'flameMane' }), AQUA_SHOT, {})).toBe(AQUA_SHOT.power);
  });

  it('うなぎのぼり: ふゆうと同じくじめん技を無効化', () => {
    // QUAKE(じめん) vs Normux。risingEel を持つと全ロール0（無効）。
    expect(calcDamage(E(), N({ ability: 'risingEel' }), QUAKE).isImmune).toBe(true);
    expect(calcDamage(E(), N({ ability: 'levitate' }), QUAKE).isImmune).toBe(true);
    expect(calcDamage(E(), N(), QUAKE).isImmune).toBe(false);
    // じめん以外は通常通り通る
    expect(calcDamage(E(), N({ ability: 'risingEel' }), AQUA_SHOT).isImmune).toBe(false);
  });

  it('テクニシャン: 基礎威力60以下のみ×1.5', () => {
    // TACKLE(50): pow=pokeRound(50,6144)=75 → base=41（none=28）
    expect(max(E({ ability: 'technician' }), N(), TACKLE)).toBe(41);
    expect(max(E(), N(), TACKLE)).toBe(28);
    // 威力80(AQUA_SHOT)には無効果
    expect(max(E({ ability: 'technician' }), N(), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT));
  });

  it('はりきり: 物理技威力×1.5（特殊技は不変）', () => {
    expect(computeEffectivePower(E({ ability: 'hustle' }), AQUA_SHOT, {})).toBe(120); // pokeRound(80,6144)
    expect(computeEffectivePower(E({ ability: 'hustle' }), THUNDER, {})).toBe(90); // 特殊→不変
  });

  it('すてみ: 反動技×1.2 / ちからずく: 追加効果技×1.3', () => {
    expect(computeEffectivePower(E({ ability: 'reckless' }), TAKE_DOWN, {})).toBe(108); // pokeRound(90,4915)
    expect(computeEffectivePower(E({ ability: 'sheerForce' }), SLUDGE_BOMB, {})).toBe(117); // pokeRound(90,5325)
  });

  it('ピンチ強化(もうか等): 自HP1/3以下 かつ 該当タイプのみ×1.5', () => {
    // Emberon maxHP=175。currentHP=58 → 58*3=174≤175 で発動。FLAME_THROW(炎)→135
    expect(computeEffectivePower(E({ ability: 'blaze', currentHP: 58 }), FLAME_THROW, {})).toBe(135);
    // HP満タンでは非発動
    expect(computeEffectivePower(E({ ability: 'blaze' }), FLAME_THROW, {})).toBe(90);
    // HP1/3以下でも非該当タイプ(水)は不変
    expect(computeEffectivePower(E({ ability: 'blaze', currentHP: 58 }), AQUA_SHOT, {})).toBe(80);
  });

  it('すなのちから: 砂嵐かつ岩/地/鋼技のみ×1.3', () => {
    expect(computeEffectivePower(E({ ability: 'sandForce' }), QUAKE, { weather: 'sand' })).toBe(130); // pokeRound(100,5325)
    expect(computeEffectivePower(E({ ability: 'sandForce' }), QUAKE, { weather: 'none' })).toBe(100);
  });
});

// ============================================================
// [タイプ無効化] 相性表より優先（被ダメ0で即確定）
// ============================================================
describe('タイプ無効化特性（相性より優先）', () => {
  it('ふゆう: じめん技を無効化（他補正に関わらず0）', () => {
    const r = calcDamage(E({ item: 'lifeOrb' }), N({ ability: 'levitate' }), QUAKE);
    expect(r.isImmune).toBe(true);
    expect(r.maxDamage).toBe(0);
    expect(r.rolls.every((d) => d === 0)).toBe(true);
  });

  it('ちくでん/もらいび等: 各タイプを無効化', () => {
    expect(max(E(), N({ ability: 'voltAbsorb' }), THUNDER)).toBe(0); // 電気
    expect(max(E(), N({ ability: 'flashFire' }), FLAME_THROW)).toBe(0); // 炎
    expect(max(E(), N({ ability: 'drySkin' }), AQUA_SHOT)).toBe(0); // かんそうはだ: 水無効
  });

  it('ふしぎなまもり: 効果抜群(≥2)以外は無効', () => {
    expect(max(E(), N({ ability: 'wonderGuard' }), TACKLE)).toBe(0); // 等倍→無効
    expect(max(E(), SKY({ ability: 'wonderGuard' }), ROCK_SLAM)).toBe(164); // 岩→4倍→通る
  });

  it('きもったま/しんがん: ゴーストへのノーマル・かくとう技の無効を貫通', () => {
    // 通常 fighting vs ghost = 0（無効）
    expect(max(E(), makeState(PHANTUX), KARATE_CHOP)).toBe(0);
    // きもったまで等倍に（貫通）→ ダメージ発生
    expect(max(E({ ability: 'scrappy' }), makeState(PHANTUX), KARATE_CHOP)).toBeGreaterThan(0);
  });
});

// ============================================================
// [急所段 / 相性後]
// ============================================================
describe('急所段・相性後の特殊補正', () => {
  it('スナイパー: 急所が×1.5の代わりに×2.25', () => {
    expect(computeCritMod(E({ ability: 'sniper' }), true)).toBe(MOD.X2_25);
    expect(computeCritMod(E(), true)).toBe(MOD.X1_5);
    expect(computeCritMod(E({ ability: 'sniper' }), false)).toBe(null);
  });

  it('いろめがね: いまひとつ(≤0.5)で×2、それ以外は無効', () => {
    expect(computePostTypeMods(E({ ability: 'tintedLens' }), 0.5)).toEqual([MOD.X2_0]);
    expect(computePostTypeMods(E({ ability: 'tintedLens' }), 0.25)).toEqual([MOD.X2_0]);
    expect(computePostTypeMods(E({ ability: 'tintedLens' }), 1)).toEqual([]); // 等倍では無効
    expect(computePostTypeMods(E({ ability: 'tintedLens' }), 2)).toEqual([]); // 抜群では無効
  });
});

// ============================================================
// [最終乗算] 持ち物 + 防御側特性 + 半減実
// ============================================================
describe('最終乗算群', () => {
  it('たつじんのおび: 効果抜群時のみ×1.2', () => {
    // ROCK_SLAM vs Skylave(4倍)。none=164 → expertBelt=197（pokeRound(164,4915)）
    expect(max(E({ item: 'expertBelt' }), SKY(), ROCK_SLAM)).toBe(197);
    expect(max(E(), SKY(), ROCK_SLAM)).toBe(164);
    // 等倍では非発動
    expect(max(E({ item: 'expertBelt' }), N(), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT));
  });

  it('あついしぼう: 炎・氷被ダメ半減（他タイプは不変）', () => {
    // FLAME_THROW vs Normux: none=74 → thickFat=37
    expect(max(E(), N({ ability: 'thickFat' }), FLAME_THROW)).toBe(37);
    expect(max(E(), N({ ability: 'thickFat' }), ICE_BEAM)).toBeLessThan(max(E(), N(), ICE_BEAM));
    expect(max(E(), N({ ability: 'thickFat' }), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT)); // 水は不変
  });

  it('マルチスケイル: 満タン時のみ被ダメ半減', () => {
    expect(max(E(), N({ ability: 'multiscale' }), FLAME_THROW)).toBe(37); // 満タン→半減
    expect(max(E(), N({ ability: 'multiscale', currentHP: 60 }), FLAME_THROW)).toBe(74); // 非満タン→等倍
  });

  it('ハードロック/フィルター: 効果抜群被ダメ×0.75（抜群時のみ）', () => {
    // ROCK_SLAM vs Skylave(4倍) none=164 → solidRock=pokeRound(164,3072)=123
    expect(max(E(), SKY({ ability: 'solidRock' }), ROCK_SLAM)).toBe(123);
    expect(max(E(), N({ ability: 'solidRock' }), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT)); // 等倍は不変
  });

  it('こおりのりんぷん: 特殊被ダメ半減（物理は不変）', () => {
    expect(max(E(), N({ ability: 'iceScales' }), THUNDER)).toBeLessThan(max(E(), N(), THUNDER));
    expect(max(E(), N({ ability: 'iceScales' }), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT));
  });

  it('もふもふ: 接触×0.5 / 炎×2（炎接触は相殺）', () => {
    expect(max(E(), N({ ability: 'fluffy' }), AQUA_SHOT)).toBe(22); // 接触水: none44 → 22
    expect(max(E(), N({ ability: 'fluffy' }), FLAME_THROW)).toBe(148); // 非接触炎: none74 → 148
  });

  it('たつじんのおび×1.2 等は最終乗算（タイプ強化アイテム×1.2 も）', () => {
    // もくたん(charcoal): 炎技×1.2。FLAME_THROW none=74 → pokeRound(74,4915)=89
    expect(max(E({ item: 'charcoal' }), N(), FLAME_THROW)).toBe(89);
    // 非該当タイプ技には無効果
    expect(max(E({ item: 'charcoal' }), N(), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT));
  });

  it('ちからのハチマキ/ものしりメガネ: 物理/特殊×1.1（最終乗算）', () => {
    expect(max(E({ item: 'muscleBand' }), N(), AQUA_SHOT)).toBe(48); // pokeRound(44,4506)
    expect(max(E({ item: 'wiseGlasses' }), N(), THUNDER)).toBe(54); // pokeRound(49,4506)
  });

  it('半減実: 効果抜群時のみ×0.5（防御側・該当タイプ）', () => {
    // chartiBerry(岩半減) vs ROCK_SLAM(4倍) none=164 → 82
    expect(max(E(), SKY({ item: 'chartiBerry' }), ROCK_SLAM)).toBe(82);
    // 等倍では非発動
    expect(max(E(), N({ item: 'passhoBerry' }), AQUA_SHOT)).toBe(max(E(), N(), AQUA_SHOT));
    // berryActive=false で無効化
    expect(max(E(), SKY({ item: 'chartiBerry' }), ROCK_SLAM, { berryActive: false })).toBe(164);
  });
});

// ============================================================
// 複数補正の併用・回帰
// ============================================================
describe('複数補正の併用 / 回帰', () => {
  it('いのちのたま + 効果抜群(4倍) + 防御ハードロック が補正順どおり全適用', () => {
    // ROCK_SLAM vs Skylave(4倍): base41 → 乱数 → 4倍=164
    //   最終群: いのちのたま pokeRound(164,5325)=213 → ハードロック pokeRound(213,3072)=160
    expect(max(E({ item: 'lifeOrb' }), SKY({ ability: 'solidRock' }), ROCK_SLAM)).toBe(160);
  });

  it('特性・持ち物なしのケースは不変（回帰: ガブリアス検証相当の素の計算）', () => {
    // FLAME_THROW vs Normux（STAB炎・等倍）の素の出力が従来通り 62〜74
    const rolls = calcDamageRange(E(), N(), FLAME_THROW);
    expect(rolls[0]).toBe(62);
    expect(rolls[rolls.length - 1]).toBe(74);
  });
});
