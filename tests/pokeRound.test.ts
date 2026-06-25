import { describe, it, expect } from 'vitest';
import { pokeRound, MOD } from '../src/pokeRound';

describe('pokeRound (§2 4096基準固定小数点)', () => {
  // pokeRound(v, m) = floor((v*m + 2048)/4096) = round-half-up(v * m/4096)

  it('×1.0 は恒等', () => {
    // floor((100*4096+2048)/4096) = floor(100.5) = 100
    expect(pokeRound(100, MOD.X1_0)).toBe(100);
  });

  it('×1.5: 単純floorと食い違うケース (v=3)', () => {
    // 3*1.5 = 4.5。 単純floor → 4。
    // pokeRound = floor((3*6144+2048)/4096) = floor((18432+2048)/4096)
    //           = floor(20480/4096) = floor(5.0) = 5   ← 4 と異なる
    expect(pokeRound(3, MOD.X1_5)).toBe(5);
    expect(Math.floor(3 * 1.5)).toBe(4); // 念のため差分を明示
  });

  it('×0.5: 単純floorと食い違うケース (v=3)', () => {
    // 3*0.5 = 1.5。 単純floor → 1。
    // pokeRound = floor((3*2048+2048)/4096) = floor(8192/4096) = floor(2.0) = 2 ← 1 と異なる
    expect(pokeRound(3, MOD.X0_5)).toBe(2);
    expect(Math.floor(3 * 0.5)).toBe(1);
  });

  it('×1.3: 端数倍率で単純floorと食い違うケース (v=3)', () => {
    // 3*1.3 = 3.9。 単純floor → 3。
    // pokeRound = floor((3*5325+2048)/4096) = floor((15975+2048)/4096)
    //           = floor(18023/4096) = floor(4.40) = 4   ← 3 と異なる
    expect(pokeRound(3, MOD.X1_3)).toBe(4);
    expect(Math.floor(3 * 1.3)).toBe(3);
  });

  it('×1.3: v=62 でも pokeRound と単純floor が異なる（いのちのたま検証の根拠）', () => {
    // 62*1.3 = 80.6。 単純floor → 80。
    // pokeRound = floor((62*5325+2048)/4096) = floor((330150+2048)/4096)
    //           = floor(332198/4096) = floor(81.10) = 81  ← 80 と異なる
    expect(pokeRound(62, MOD.X1_3)).toBe(81);
    expect(Math.floor(62 * 1.3)).toBe(80);
  });

  it('×2.0 は正確に2倍（端数なし）', () => {
    // floor((50*8192+2048)/4096) = floor((409600+2048)/4096) = floor(100.5) = 100
    expect(pokeRound(50, MOD.X2_0)).toBe(100);
  });
});
