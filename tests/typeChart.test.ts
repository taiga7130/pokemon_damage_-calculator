import { describe, it, expect } from 'vitest';
import { calcTypeEffectiveness, TYPE_CHART, ALL_TYPES } from '../src/typeChart';
import type { PokemonType } from '../src/types';

describe('calcTypeEffectiveness (§5.3 単体6パターン)', () => {
  it('無効(0): でんき → じめん', () => {
    expect(calcTypeEffectiveness('electric', ['ground'])).toBe(0);
  });
  it('1/4: くさ → ほのお/ひこう', () => {
    expect(calcTypeEffectiveness('grass', ['fire', 'flying'])).toBe(0.25);
  });
  it('1/2: ほのお → みず', () => {
    expect(calcTypeEffectiveness('fire', ['water'])).toBe(0.5);
  });
  it('等倍(1): ノーマル → みず', () => {
    expect(calcTypeEffectiveness('normal', ['water'])).toBe(1);
  });
  it('2倍: みず → じめん', () => {
    expect(calcTypeEffectiveness('water', ['ground'])).toBe(2);
  });
  it('4倍: いわ → ほのお/ひこう', () => {
    expect(calcTypeEffectiveness('rock', ['fire', 'flying'])).toBe(4);
  });
});

describe('無効(0倍) 既知ケース（検算済み期待値）', () => {
  const cases: Array<[PokemonType, PokemonType]> = [
    ['electric', 'ground'],  // でんき→じめん
    ['ground', 'flying'],    // じめん→ひこう
    ['normal', 'ghost'],     // ノーマル→ゴースト
    ['ghost', 'normal'],     // ゴースト→ノーマル
    ['psychic', 'dark'],     // エスパー→あく
    ['dragon', 'fairy'],     // ドラゴン→フェアリー
    ['fighting', 'ghost'],   // かくとう→ゴースト
    ['poison', 'steel'],     // どく→はがね
  ];
  it.each(cases)('%s → %s = 0', (atk, def) => {
    expect(calcTypeEffectiveness(atk, [def])).toBe(0);
  });
});

describe('第6世代以降の変更点（ゴースト/あく → はがね は等倍）', () => {
  it('ghost → steel = 1', () => {
    expect(calcTypeEffectiveness('ghost', ['steel'])).toBe(1);
  });
  it('dark → steel = 1', () => {
    expect(calcTypeEffectiveness('dark', ['steel'])).toBe(1);
  });
});

describe('複合タイプ 既知ケース（検算済み期待値）', () => {
  it('ground → [dark, steel] = 2  (1 × 2)', () => {
    // じめん vs あく=1, はがね=2 → 2
    expect(calcTypeEffectiveness('ground', ['dark', 'steel'])).toBe(2);
  });
  it('fairy → [dragon, dark] = 4  (2 × 2)', () => {
    expect(calcTypeEffectiveness('fairy', ['dragon', 'dark'])).toBe(4);
  });
  it('fire → [grass, ice] = 4  (2 × 2)', () => {
    expect(calcTypeEffectiveness('fire', ['grass', 'ice'])).toBe(4);
  });
  it('electric → [ground, flying] = 0  (0 × 2、0が優先)', () => {
    expect(calcTypeEffectiveness('electric', ['ground', 'flying'])).toBe(0);
  });
  it('grass → [grass, poison] = 0.25  (0.5 × 0.5)', () => {
    expect(calcTypeEffectiveness('grass', ['grass', 'poison'])).toBe(0.25);
  });
});

describe('表の網羅性・値域（全18×18=324セル）', () => {
  it('全攻撃タイプ行が存在する（18行）', () => {
    expect(ALL_TYPES.length).toBe(18);
    for (const t of ALL_TYPES) {
      expect(TYPE_CHART[t]).toBeDefined();
    }
  });

  it('324セルすべてが 0/0.5/1/2 のいずれかで定義される', () => {
    let count = 0;
    const allowed = new Set([0, 0.5, 1, 2]);
    for (const atk of ALL_TYPES) {
      for (const def of ALL_TYPES) {
        const eff = calcTypeEffectiveness(atk, [def]); // 単体相性
        expect(allowed.has(eff)).toBe(true);
        count++;
      }
    }
    expect(count).toBe(324);
  });

  it('表に記載されたキーがすべて有効な18タイプID（表記一致）', () => {
    const valid = new Set<string>(ALL_TYPES);
    for (const atk of Object.keys(TYPE_CHART)) {
      expect(valid.has(atk)).toBe(true);
      for (const def of Object.keys(TYPE_CHART[atk as PokemonType])) {
        expect(valid.has(def)).toBe(true);
      }
    }
  });

  it('単体相性に 0.25 や 4 は存在しない（複合の掛け算でのみ発生）', () => {
    for (const atk of ALL_TYPES) {
      for (const def of ALL_TYPES) {
        const eff = calcTypeEffectiveness(atk, [def]);
        expect(eff === 0.25 || eff === 4).toBe(false);
      }
    }
  });
});
