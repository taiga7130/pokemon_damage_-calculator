import { describe, it, expect } from 'vitest';
import { calcKOProbability } from '../src/ko';

// シナリオA の 16ロール（damage.test.ts と同一）
const ROLLS = [62, 63, 63, 65, 65, 66, 66, 68, 68, 69, 69, 71, 71, 72, 72, 74];

describe('calcKOProbability (§7 確定数)', () => {
  it('確定1発: 最小ロールでも相手HP以上', () => {
    // HP=62。 全16ロール >= 62 → 16/16 = 確定
    const ko = calcKOProbability(ROLLS, 62);
    expect(ko.hits).toBe(1);
    expect(ko.guaranteed).toBe(true);
    expect(ko.label).toBe('確定1発');
  });

  it('乱数1発: 一部のロールのみ相手HP以上', () => {
    // HP=70。 70以上は {71,71,72,72,74} = 5通り。 5/16 = 0.3125 → 31.3%
    const ko = calcKOProbability(ROLLS, 70);
    expect(ko.hits).toBe(1);
    expect(ko.guaranteed).toBe(false);
    expect(ko.probability).toBeCloseTo(5 / 16, 10);
    expect(ko.label).toBe('乱数1発 (31.3%)');
  });

  it('確定2発: 1発では絶対落とせず、2発なら全組み合わせで落ちる', () => {
    // HP=120。 1発: max74 < 120 → 不可。
    // 2発: 最小合計 62+62=124 >= 120 → 256通り全てKO → 確定2発
    const ko = calcKOProbability(ROLLS, 120);
    expect(ko.hits).toBe(2);
    expect(ko.guaranteed).toBe(true);
    expect(ko.label).toBe('確定2発');
  });

  it('乱数2発: 2発で一部のみ落とせる', () => {
    // HP=130。 2発合計の範囲 124..148。 130以上になる組み合わせは一部のみ。
    const ko = calcKOProbability(ROLLS, 130);
    expect(ko.hits).toBe(2);
    expect(ko.guaranteed).toBe(false);
    expect(ko.label.startsWith('乱数2発')).toBe(true);
    // 組み合わせ総数ベース: 分母は 16^2 = 256
    expect(ko.probability).toBeGreaterThan(0);
    expect(ko.probability).toBeLessThan(1);
  });

  it('ダメージ無し（全ロール0=無効）', () => {
    const ko = calcKOProbability(new Array(16).fill(0), 100);
    expect(ko.label).toBe('ダメージなし');
  });
});
