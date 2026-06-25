import { describe, it, expect } from 'vitest';
import { calcTypeEffectiveness } from '../src/typeChart';

describe('calcTypeEffectiveness (§5.3 6パターン)', () => {
  it('無効(0): でんき → じめん', () => {
    // electric vs ground = 0
    expect(calcTypeEffectiveness('electric', ['ground'])).toBe(0);
  });

  it('1/4: くさ → ほのお/ひこう', () => {
    // grass vs fire(0.5) * flying(0.5) = 0.25
    expect(calcTypeEffectiveness('grass', ['fire', 'flying'])).toBe(0.25);
  });

  it('1/2: ほのお → みず', () => {
    // fire vs water = 0.5
    expect(calcTypeEffectiveness('fire', ['water'])).toBe(0.5);
  });

  it('等倍(1): ノーマル → みず', () => {
    // normal vs water = 1（表に無い → 1）
    expect(calcTypeEffectiveness('normal', ['water'])).toBe(1);
  });

  it('2倍: みず → じめん', () => {
    // water vs ground = 2
    expect(calcTypeEffectiveness('water', ['ground'])).toBe(2);
  });

  it('4倍: いわ → ほのお/ひこう', () => {
    // rock vs fire(2) * flying(2) = 4
    expect(calcTypeEffectiveness('rock', ['fire', 'flying'])).toBe(4);
  });
});
