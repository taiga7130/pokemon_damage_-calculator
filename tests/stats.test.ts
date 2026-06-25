import { describe, it, expect } from 'vitest';
import { calcHP, calcStat, applyRankBoost, getStatValue } from '../src/stats';
import { makeState, EMBERON, ATK_UP, sp } from '../data/dummy';

describe('calcHP (§3.1)', () => {
  it('種族値100 / SP0', () => {
    // floor((100*2+31)*50/100)+50+10+0
    // = floor(231*50/100)+60 = floor(11550/100)=floor(115.5)=115 → 115+60 = 175
    expect(calcHP(100, 0)).toBe(175);
  });

  it('SP は素直に +SP（種族値100 / SP20）', () => {
    // 115 + 60 + 20 = 195
    expect(calcHP(100, 20)).toBe(195);
  });

  it('防御側ダミー Normux の HP=120（種族値45）', () => {
    // floor((45*2+31)*50/100)+60 = floor(121*50/100)+60 = floor(60.5)+60 = 60+60 = 120
    expect(calcHP(45, 0)).toBe(120);
  });
});

describe('calcStat (§3.2 SPは性格補正の内側)', () => {
  it('無補正・SP0', () => {
    // floor((floor((100*2+31)*50/100)+5+0)*1.0) = floor((115+5))=120
    expect(calcStat(100, 0, 1.0)).toBe(120);
  });

  it('上昇補正・SP0', () => {
    // floor((115+5)*1.1) = floor(120*1.1) = floor(132.0) = 132
    expect(calcStat(100, 0, 1.1)).toBe(132);
  });

  it('SPが性格補正の内側に入る（上昇補正・SP20）', () => {
    // 正: floor((115+5+20)*1.1) = floor(140*1.1) = floor(154.0) = 154
    // 誤（SPを外側に足すと）: floor(120*1.1)+20 = 132+20 = 152
    // → 154 になれば SP は補正の内側で加算されている
    expect(calcStat(100, 20, 1.1)).toBe(154);
    expect(calcStat(100, 0, 1.1) + 20).toBe(152); // 誤った計算順の値を明示
  });

  it('getStatValue 経由でも一致（攻撃↑性格 + atk SP20）', () => {
    // EMBERON.atk=100, ATK_UP は atk↑(×1.1)。 SP atk=20 → 154
    const s = makeState(EMBERON, { nature: ATK_UP, sp: sp({ atk: 20 }) });
    expect(getStatValue(s, 'atk')).toBe(154);
  });
});

describe('applyRankBoost (§4.1 内部分数)', () => {
  it('+1 は 3/2', () => {
    // floor(120 * 3 / 2) = 180
    expect(applyRankBoost(120, 1)).toBe(180);
  });

  it('-1 は 2/3（0.7倍の表示値ではない）', () => {
    // floor(120 * 2 / 3) = floor(80.0) = 80
    // 表示値0.7なら 120*0.7=84 になるが、内部分数では 80
    expect(applyRankBoost(120, -1)).toBe(80);
    expect(Math.floor(120 * 0.7)).toBe(84); // 表示値で計算した場合の誤った値
  });

  it('+2 / -2', () => {
    expect(applyRankBoost(120, 2)).toBe(240); // floor(120*4/2)=240
    expect(applyRankBoost(120, -2)).toBe(60); // floor(120*2/4)=60
  });

  it('0 は恒等', () => {
    expect(applyRankBoost(120, 0)).toBe(120);
  });
});
