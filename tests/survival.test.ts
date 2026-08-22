// ============================================================
// 耐久逆算 findSurvivalSP のテスト。
// 期待値のハードコードではなく「エンジン(calcDamage)との整合性」を検証する:
//   - already: 現在の振りで最大乱数 < HP のときだけ true
//   - candidates: 全候補が実際に確定耐えし、かつ 合計SP-1 では誰も耐えられない（最小性）
//   - possible=false: フル投資(32/32)でも最大乱数 >= HP
// ============================================================
import { describe, it, expect } from 'vitest';
import { calcDamage, getStatValue } from '../src/index';
import { findSurvivalSP } from '../src/web/survival';
import { EMBERON, NORMUX, PHANTUX, NEUTRAL, ATK_UP } from '../data/dummy';
import type { Move, PokemonState, Conditions } from '../src/types';

const ZERO_RANK = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

function attacker(sp: number): PokemonState {
  return {
    species: EMBERON,
    nature: ATK_UP,
    sp: { hp: 0, atk: sp, def: 0, spa: 0, spd: 0, spe: 0 },
    ranks: { ...ZERO_RANK },
    ability: 'none',
    item: 'none',
  };
}

function makeDefFor(species: typeof NORMUX) {
  return (hpSp: number, defSp: number): PokemonState => ({
    species,
    nature: NEUTRAL,
    sp: { hp: hpSp, atk: 0, def: defSp, spa: 0, spd: 0, spe: 0 },
    ranks: { ...ZERO_RANK },
    ability: 'none',
    item: 'none',
  });
}

function fireMove(power: number): Move {
  return { name: `TestFire${power}`, type: 'fire', category: 'physical', power, isContact: false };
}
const NORMAL_MOVE: Move = { name: 'TestNormal', type: 'normal', category: 'physical', power: 60, isContact: true };

const survives = (
  atk: PokemonState, def: PokemonState, move: Move, cond: Conditions,
): boolean => calcDamage(atk, def, move, cond).maxDamage < getStatValue(def, 'hp');

describe('findSurvivalSP', () => {
  it('現在の振りで耐えているなら already=true', () => {
    const atk = attacker(0);
    const makeDef = makeDefFor(NORMUX);
    const mv = fireMove(20); // 低威力: 無振りでも耐えるはず
    const cond: Conditions = {};
    expect(survives(atk, makeDef(0, 0), mv, cond)).toBe(true); // 前提の確認
    const r = findSurvivalSP(atk, mv, cond, makeDef, { hpSp: 0, defSp: 0 }, 'def');
    expect(r.already).toBe(true);
    expect(r.possible).toBe(true);
  });

  it('候補は全て確定耐えし、合計SP-1 では耐えられない（最小性）', () => {
    const atk = attacker(32);
    const makeDef = makeDefFor(NORMUX);
    const mv = fireMove(115);
    const cond: Conditions = {};
    // 前提: 無振りでは倒れ、フル投資なら耐える威力帯であること
    expect(survives(atk, makeDef(0, 0), mv, cond)).toBe(false);
    expect(survives(atk, makeDef(32, 32), mv, cond)).toBe(true);

    const r = findSurvivalSP(atk, mv, cond, makeDef, { hpSp: 0, defSp: 0 }, 'def');
    expect(r.already).toBe(false);
    expect(r.possible).toBe(true);
    expect(r.candidates.length).toBeGreaterThan(0);

    const total = r.candidates[0].total;
    for (const c of r.candidates) {
      expect(c.total).toBe(total); // 全候補が同じ最小合計
      expect(survives(atk, makeDef(c.hpSp, c.defSp), mv, cond)).toBe(true);
      expect(c.hp).toBe(getStatValue(makeDef(c.hpSp, c.defSp), 'hp'));
    }
    // 最小性: 合計 total-1 の全配分で耐えられないこと（全数検査）
    for (let hpSp = Math.max(0, total - 1 - 32); hpSp <= Math.min(32, total - 1); hpSp++) {
      const defSp = total - 1 - hpSp;
      expect(survives(atk, makeDef(hpSp, defSp), mv, cond)).toBe(false);
    }
  });

  it('フル投資でも耐えられない場合 possible=false', () => {
    const atk = attacker(32);
    const makeDef = makeDefFor(NORMUX);
    const mv = fireMove(250);
    const cond: Conditions = { isCrit: true };
    expect(survives(atk, makeDef(32, 32), mv, cond)).toBe(false); // 前提の確認
    const r = findSurvivalSP(atk, mv, cond, makeDef, { hpSp: 0, defSp: 0 }, 'def');
    expect(r.possible).toBe(false);
    expect(r.candidates).toHaveLength(0);
    expect(r.fullInvestMaxPercent).toBeGreaterThan(0);
  });

  it('無効タイプ（ダメージ0）は無振りで already=true', () => {
    const atk: PokemonState = { ...attacker(32), species: NORMUX }; // ノーマル技をゴーストへ
    const makeDef = makeDefFor(PHANTUX);
    const r = findSurvivalSP(atk, NORMAL_MOVE, {}, makeDef, { hpSp: 0, defSp: 0 }, 'def');
    expect(r.already).toBe(true);
  });
});
