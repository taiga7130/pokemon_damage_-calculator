import { describe, it, expect } from 'vitest';
import { calcEffectiveAttack, calcEffectiveDefense } from '../src/effective';
import {
  makeState, EMBERON, NORMUX, BOULDUCK,
  FLAME_THROW, AQUA_SHOT, ranks,
} from '../data/dummy';

// EMBERON: atk実数値=120 (種100,SP0,無補正) / spa実数値=120
// NORMUX : def実数値=100 / spd実数値=100

describe('calcEffectiveAttack (§4)', () => {
  it('ランク+1 で攻撃が 3/2 倍', () => {
    // 120 → floor(120*3/2)=180
    const atk = makeState(EMBERON, { ranks: ranks({ atk: 1 }) });
    expect(calcEffectiveAttack(atk, AQUA_SHOT, {})).toBe(180);
  });

  it('ランク-1 は分数2/3（80。表示0.7倍の84ではない）', () => {
    const atk = makeState(EMBERON, { ranks: ranks({ atk: -1 }) });
    expect(calcEffectiveAttack(atk, AQUA_SHOT, {})).toBe(80);
  });

  it('急所: 攻撃側のマイナスランクを無視', () => {
    // atk -2。通常: floor(120*2/4)=60。 急所時は -2 を無視 → 120
    const atk = makeState(EMBERON, { ranks: ranks({ atk: -2 }) });
    expect(calcEffectiveAttack(atk, AQUA_SHOT, {})).toBe(60);
    expect(calcEffectiveAttack(atk, AQUA_SHOT, { isCrit: true })).toBe(120);
  });

  it('急所でも攻撃側のプラスランクは適用される', () => {
    // atk +2。 急所でも 120→floor(120*4/2)=240 のまま
    const atk = makeState(EMBERON, { ranks: ranks({ atk: 2 }) });
    expect(calcEffectiveAttack(atk, AQUA_SHOT, { isCrit: true })).toBe(240);
  });

  it('ちからもち: 攻撃 ×2', () => {
    // 120 → pokeRound(120,8192)=240（正確に2倍）
    const atk = makeState(EMBERON, { ability: 'hugePower' });
    expect(calcEffectiveAttack(atk, AQUA_SHOT, {})).toBe(240);
  });

  it('特殊技は spa を参照', () => {
    const atk = makeState(EMBERON);
    expect(calcEffectiveAttack(atk, FLAME_THROW, {})).toBe(120); // spa=120
  });
});

describe('calcEffectiveDefense (§4)', () => {
  it('急所: 防御側のプラスランクを無視', () => {
    // def +2。通常: floor(100*4/2)=200。 急所時は無視 → 100
    const def = makeState(NORMUX, { ranks: ranks({ def: 2 }) });
    expect(calcEffectiveDefense(def, AQUA_SHOT, {})).toBe(200);
    expect(calcEffectiveDefense(def, AQUA_SHOT, { isCrit: true })).toBe(100);
  });

  it('急所でも防御側のマイナスランクは適用される', () => {
    // def -1。 急所でも floor(100*2/3)=66 のまま
    const def = makeState(NORMUX, { ranks: ranks({ def: -1 }) });
    expect(calcEffectiveDefense(def, AQUA_SHOT, { isCrit: true })).toBe(66);
  });

  it('砂嵐: いわタイプ防御側の特防 ×1.5（特殊技）', () => {
    // BOULDUCK spd実数値: 種80 → floor((80*2+31)*50/100)+5 = floor(191*50/100)+5=floor(95.5)+5=95+5=100
    // 砂嵐 → pokeRound(100,6144)=floor((100*6144+2048)/4096)=floor(150.5)=150
    const def = makeState(BOULDUCK); // いわ単
    expect(calcEffectiveDefense(def, FLAME_THROW, { weather: 'none' })).toBe(100);
    expect(calcEffectiveDefense(def, FLAME_THROW, { weather: 'sand' })).toBe(150);
  });

  it('砂嵐でも物理技（防御参照）には特防補正がかからない', () => {
    // BOULDUCK def実数値: 種100 → floor((100*2+31)*50/100)+5 = floor(115.5)+5 = 120
    // 砂嵐は特防のみ補正 → 物理(防御参照)は120のまま
    const def = makeState(BOULDUCK);
    expect(calcEffectiveDefense(def, AQUA_SHOT, { weather: 'sand' })).toBe(120);
  });
});
