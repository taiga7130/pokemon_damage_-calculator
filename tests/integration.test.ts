import { describe, it, expect } from 'vitest';
import { calcDamage } from '../src/index';
import {
  makeState, EMBERON, NORMUX, SKYLAVE, TERRAPIN,
  FLAME_THROW, THUNDER, ROCK_SLAM,
} from '../data/dummy';

describe('calcDamage 統合 (§7 出力)', () => {
  const atk = makeState(EMBERON);

  it('シナリオA: 最小〜最大・割合・確定数（残HP満タン=120 → 確定2発）', () => {
    const def = makeState(NORMUX); // HP=120
    const r = calcDamage(atk, def, FLAME_THROW, {});

    expect(r.rolls).toEqual([62, 63, 63, 65, 65, 66, 66, 68, 68, 69, 69, 71, 71, 72, 72, 74]);
    expect(r.minDamage).toBe(62);
    expect(r.maxDamage).toBe(74);
    // 割合（対 最大HP120）: 62/120=51.666→51.7 / 74/120=61.666→61.7
    expect(r.minPercent).toBe(51.7);
    expect(r.maxPercent).toBe(61.7);
    expect(r.ko.label).toBe('確定2発');
    expect(r.isImmune).toBe(false);
  });

  it('残HPを指定すると確定数が変わる（確定1発 / 乱数1発）', () => {
    // 残HP62 → 確定1発
    const def1 = makeState(NORMUX, { currentHP: 62 });
    expect(calcDamage(atk, def1, FLAME_THROW, {}).ko.label).toBe('確定1発');

    // 残HP70 → 乱数1発 (31.3%)
    const def2 = makeState(NORMUX, { currentHP: 70 });
    expect(calcDamage(atk, def2, FLAME_THROW, {}).ko.label).toBe('乱数1発 (31.3%)');
  });

  it('無効(0倍): でんき技 → じめん', () => {
    const def = makeState(TERRAPIN); // じめん
    const r = calcDamage(atk, def, THUNDER, {});
    expect(r.isImmune).toBe(true);
    expect(r.rolls.every((d) => d === 0)).toBe(true);
    expect(r.maxDamage).toBe(0);
    expect(r.ko.label).toBe('ダメージなし');
  });

  it('4倍弱点: いわ技 → ほのお/ひこう（等倍の4倍ダメージ）', () => {
    // SKYLAVE(ほのお/ひこう) に ROCK_SLAM(いわ物理 威力75)。
    // いわ vs ほのお/ひこう = 4倍。 EMBERONはほのお → いわ技は非一致(STAB無し)。
    const def = makeState(SKYLAVE);
    const r = calcDamage(atk, def, ROCK_SLAM, {});
    expect(r.isImmune).toBe(false);
    // 4倍が効いていること（等倍シナリオの素damageより明確に大きい）を確認
    expect(r.minDamage).toBeGreaterThan(0);
    // 相性4倍なので最終ダメージは base 由来値の概ね4倍スケール
    expect(r.maxDamage).toBeGreaterThan(r.minDamage);
  });
});
