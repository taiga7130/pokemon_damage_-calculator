// ============================================================
// レギュレーション M-C で追加された特性・持ち物のテスト
//   きれあじ / スキン系（スカイスキン等） / はどうのぼうご / ファーコート /
//   はがねのせいしん / パンクロック / ノーマルジュエル
// 期待値はすべて手計算（根拠をコメントに記載）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { calcDamageRange } from '../src/damage';
import { computeEffectivePower, computeTypeEffectiveness, resolveMove } from '../src/abilityItem';
import { calcEffectiveDefense } from '../src/effective';
import { makeState, EMBERON, NORMUX, SKYLAVE } from '../data/dummy';
import type { PokemonState, Move, Conditions, Species } from '../src/types';

// くさ単タイプ（ノーマル 等倍 / ひこう 2倍 → タイプ変化の検出用）
const GRASSLING: Species = { name: 'Grassling', types: ['grass'], baseStats: { hp: 60, atk: 60, def: 80, spa: 60, spd: 80, spe: 60 } };

// 基準: Emberon(ほのお) atk=spa=120 / Normux(ノーマル) def=spd=100, HP=120
//   威力80・等倍・STAB無・r=100 → base = floor(floor(22*80*120/100)/50)+2 = 42+2 = 44
const E = (o: Partial<PokemonState> = {}) => makeState(EMBERON, o);
const N = (o: Partial<PokemonState> = {}) => makeState(NORMUX, o);
const max = (a: PokemonState, d: PokemonState, m: Move, c: Conditions = {}) => {
  const r = calcDamageRange(a, d, m, c);
  return r[r.length - 1];
};

// テスト用の技（フラグの有無で比較する）
const SLASH80: Move = { name: 'slash', type: 'normal', category: 'physical', power: 80, isContact: true, flags: { slicing: true } };
const CONTACT80: Move = { name: 'contact', type: 'normal', category: 'physical', power: 80, isContact: true };
const NORMAL80: Move = { name: 'normal', type: 'normal', category: 'physical', power: 80, isContact: false };
const NORMAL_SP80: Move = { name: 'normalSp', type: 'normal', category: 'special', power: 80, isContact: false };
const FLY80: Move = { name: 'fly', type: 'flying', category: 'physical', power: 80, isContact: false };
const STEEL80: Move = { name: 'steel', type: 'steel', category: 'physical', power: 80, isContact: false };
const VOICE80: Move = { name: 'voice', type: 'normal', category: 'special', power: 80, isContact: false, flags: { sound: true } };

describe('きれあじ（切る技 ×1.5・威力側）', () => {
  it('切る技の威力 80 → pokeRound(80, 6144) = 120', () => {
    expect(computeEffectivePower(E({ ability: 'sharpness' }), SLASH80, {})).toBe(120);
    // 威力120 → base = floor(floor(22*120*120/100)/50)+2 = floor(3168/50)+2 = 65
    expect(max(E({ ability: 'sharpness' }), N(), SLASH80)).toBe(65);
    expect(max(E(), N(), SLASH80)).toBe(44);
  });
  it('切る技でなければ補正なし', () => {
    expect(computeEffectivePower(E({ ability: 'sharpness' }), CONTACT80, {})).toBe(80);
  });
});

describe('スキン系（ノーマル技 → 該当タイプ・威力 ×1.2）', () => {
  it('resolveMove: スカイスキンでノーマル技がひこうタイプになる（ひこう技はそのまま）', () => {
    expect(resolveMove(E({ ability: 'aerilate' }), NORMAL80).type).toBe('flying');
    expect(resolveMove(E({ ability: 'aerilate' }), FLY80).type).toBe('flying');
    expect(resolveMove(E({ ability: 'aerilate' }), FLY80).flags?.skinBoosted).toBeUndefined();
    expect(resolveMove(E(), NORMAL80).type).toBe('normal');
  });
  it('タイプ変化後の相性で判定（ひこう→くさ ×2。ノーマルのままなら等倍）', () => {
    expect(computeTypeEffectiveness(E({ ability: 'aerilate' }), makeState(GRASSLING), NORMAL80)).toBe(2);
    expect(computeTypeEffectiveness(E(), makeState(GRASSLING), NORMAL80)).toBe(1);
  });
  it('威力 ×1.2 は変化した技のみ: 80 → pokeRound(80, 4915) = 96。元からひこうの技は 80 のまま', () => {
    const a = E({ ability: 'aerilate' });
    expect(computeEffectivePower(a, resolveMove(a, NORMAL80), {})).toBe(96);
    expect(computeEffectivePower(a, resolveMove(a, FLY80), {})).toBe(80);
  });
  it('変化後タイプで STAB が乗る（Skylave ほのお/ひこう + スカイスキン + ノーマル技）', () => {
    // Skylave atk種族値90 → 実数値 floor((180+31)/2)+5 = 110
    // 威力96 → base = floor(floor(22*96*110/100)/50)+2 = floor(2323/50)+2 = 48
    // r=100 → 48 → STAB pokeRound(48, 6144) = floor((294912+2048)/4096) = 72 → ひこう vs ノーマル 等倍
    expect(max(makeState(SKYLAVE, { ability: 'aerilate' }), N(), NORMAL80)).toBe(72);
    // スキン無し: 威力80 → base = floor(floor(22*80*110/100)/50)+2 = floor(1936/50)+2 = 40、STAB無
    expect(max(makeState(SKYLAVE), N(), NORMAL80)).toBe(40);
  });
  it('フェアリースキン / フリーズスキン / エレキスキン / ドラゴンスキン も同じ機構', () => {
    expect(resolveMove(E({ ability: 'pixilate' }), NORMAL80).type).toBe('fairy');
    expect(resolveMove(E({ ability: 'refrigerate' }), NORMAL80).type).toBe('ice');
    expect(resolveMove(E({ ability: 'galvanize' }), NORMAL80).type).toBe('electric');
    expect(resolveMove(E({ ability: 'dragonSkin' }), NORMAL80).type).toBe('dragon');
  });
});

describe('はどうのぼうご（接触技の被ダメ ×0.5・最終乗算）', () => {
  it('接触技: 44 → pokeRound(44, 2048) = floor((90112+2048)/4096) = 22', () => {
    expect(max(E(), N({ ability: 'auraGuard' }), CONTACT80)).toBe(22);
  });
  it('非接触技は補正なし', () => {
    expect(max(E(), N({ ability: 'auraGuard' }), NORMAL80)).toBe(44);
  });
});

describe('ファーコート（物理技に対し防御 ×2・ステータス側）', () => {
  it('D_eff = pokeRound(100, 8192) = 200', () => {
    expect(calcEffectiveDefense(N({ ability: 'furCoat' }), NORMAL80, {})).toBe(200);
    // base = floor(floor(22*80*120/200)/50)+2 = floor(1056/50)+2 = 23
    expect(max(E(), N({ ability: 'furCoat' }), NORMAL80)).toBe(23);
  });
  it('特殊技には無効', () => {
    expect(calcEffectiveDefense(N({ ability: 'furCoat' }), NORMAL_SP80, {})).toBe(100);
    expect(max(E(), N({ ability: 'furCoat' }), NORMAL_SP80)).toBe(44);
  });
});

describe('はがねのせいしん（はがね技 ×1.5・威力側）', () => {
  it('はがね技 80 → 120 → base 65。他タイプは補正なし', () => {
    expect(computeEffectivePower(E({ ability: 'steelySpirit' }), STEEL80, {})).toBe(120);
    expect(max(E({ ability: 'steelySpirit' }), N(), STEEL80)).toBe(65);
    expect(computeEffectivePower(E({ ability: 'steelySpirit' }), NORMAL80, {})).toBe(80);
  });
});

describe('パンクロック（音技 ×1.3 / 被弾 音技 ×0.5）', () => {
  it('攻撃側: 80 → pokeRound(80, 5325) = floor((426000+2048)/4096) = 104', () => {
    expect(computeEffectivePower(E({ ability: 'punkRock' }), VOICE80, {})).toBe(104);
    // base = floor(floor(22*104*120/100)/50)+2 = floor(2745/50)+2 = 56
    expect(max(E({ ability: 'punkRock' }), N(), VOICE80)).toBe(56);
    expect(computeEffectivePower(E({ ability: 'punkRock' }), NORMAL_SP80, {})).toBe(80);
  });
  it('防御側: 音技 44 → 22。音技以外は補正なし', () => {
    expect(max(E(), N({ ability: 'punkRock' }), VOICE80)).toBe(22);
    expect(max(E(), N({ ability: 'punkRock' }), NORMAL_SP80)).toBe(44);
  });
});

describe('ノーマルジュエル（ノーマル技 ×1.3・威力側・発動扱い）', () => {
  it('ノーマル技 80 → 104 → base 56。他タイプは補正なし', () => {
    expect(computeEffectivePower(E({ item: 'normalGem' }), NORMAL80, {})).toBe(104);
    expect(max(E({ item: 'normalGem' }), N(), NORMAL80)).toBe(56);
    expect(computeEffectivePower(E({ item: 'normalGem' }), STEEL80, {})).toBe(80);
  });
});
