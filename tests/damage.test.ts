import { describe, it, expect } from 'vitest';
import { calcBaseDamage, calcDamageRange } from '../src/damage';
import {
  makeState, EMBERON, NORMUX,
  FLAME_THROW, AQUA_SHOT,
} from '../data/dummy';

// ---- 共通シナリオ A（特殊・STAB・等倍）----
// 攻撃 EMBERON(ほのお) spa実数値=120 / FLAME_THROW(ほのお特殊 威力90)
// 防御 NORMUX(ノーマル) spd実数値=100 / HP=120
//   A_eff=120, D_eff=100, power=90
//   base = floor(floor(22*90*120/100)/50)+2
//        = floor(floor(237600/100)/50)+2 = floor(2376/50)+2 = floor(47.52)+2 = 47+2 = 49
//   STAB: ほのお技=ほのおタイプ使用者 → ×1.5（pokeRound）
//   タイプ相性: ほのお vs ノーマル = 1（等倍）
//
//   各乱数 r の値:  STAB( floor(49*r/100) )  ※pokeRound(_,6144)=round-half-up(1.5x)
//   r=85: floor(41.65)=41 → 62 | r=86,87:42 → 63,63 | r=88,89:43 → 65,65
//   r=90,91:44 → 66,66 | r=92,93:45 → 68,68 | r=94,95:46 → 69,69
//   r=96,97:47 → 71,71 | r=98,99:48 → 72,72 | r=100:49 → 74
const SCENARIO_A_ROLLS = [62, 63, 63, 65, 65, 66, 66, 68, 68, 69, 69, 71, 71, 72, 72, 74];

describe('calcBaseDamage (§5.1)', () => {
  it('特殊シナリオA: base=49', () => {
    expect(calcBaseDamage(90, 120, 100)).toBe(49);
  });

  it('物理シナリオ(威力80): base=44', () => {
    // floor(floor(22*80*120/100)/50)+2 = floor(2112/50)+2 = 42+2 = 44
    expect(calcBaseDamage(80, 120, 100)).toBe(44);
  });
});

describe('calcDamageRange (§5.2 / §7)', () => {
  const atk = makeState(EMBERON);
  const def = makeState(NORMUX);

  it('シナリオA: 16通りが手計算と一致', () => {
    expect(calcDamageRange(atk, def, FLAME_THROW, {})).toEqual(SCENARIO_A_ROLLS);
  });

  it('天候(晴): ほのお技 ×1.5 が最初に乗る', () => {
    // 天候: pokeRound(49,6144)=floor((49*6144+2048)/4096)=floor(74.0)=74
    // r=100: random floor(74)=74 → STAB pokeRound(74,6144)=floor(111.5)=111
    // r=85 : random floor(74*85/100)=floor(62.9)=62 → STAB pokeRound(62,6144)=floor(93.5)=93
    const rolls = calcDamageRange(atk, def, FLAME_THROW, { weather: 'sun' });
    expect(rolls[rolls.length - 1]).toBe(111);
    expect(rolls[0]).toBe(93);
  });

  it('適応力: STAB が ×2 になる', () => {
    // r=100: random floor(49)=49 → pokeRound(49,8192)=floor(98.5)=98
    const adapt = makeState(EMBERON, { ability: 'adaptability' });
    const rolls = calcDamageRange(adapt, def, FLAME_THROW, {});
    expect(rolls[rolls.length - 1]).toBe(98);
  });

  it('いのちのたま(×1.3): §5.2 順8で pokeRound が単純floorと食い違う', () => {
    // 通常ロール[62..74]に最終 pokeRound(_,5325) を適用:
    //   min: pokeRound(62,5325)=81（62*1.3=80.6 だが pokeRound は 81）
    //   max: pokeRound(74,5325)=96（74*1.3=96.2 → 96）
    const orb = makeState(EMBERON, { item: 'lifeOrb' });
    const rolls = calcDamageRange(orb, def, FLAME_THROW, {});
    expect(rolls[0]).toBe(81);
    expect(rolls[rolls.length - 1]).toBe(96);
  });

  it('やけど: 物理技は ×0.5（特殊技は影響なし）', () => {
    // 物理 AQUA_SHOT: 水技≠ほのお → STAB無し、水vsノーマル=等倍。 base=44。
    //   非やけど r=100: floor(44)=44
    //   やけど   r=100: pokeRound(44,2048)=floor((44*2048+2048)/4096)=floor(22.5)=22
    const noBurn = calcDamageRange(atk, def, AQUA_SHOT, {});
    const burn = calcDamageRange(atk, def, AQUA_SHOT, { attackerBurned: true });
    expect(noBurn[noBurn.length - 1]).toBe(44);
    expect(burn[burn.length - 1]).toBe(22);

    // 特殊技 FLAME_THROW はやけどの影響を受けない（配列が完全一致）
    const spNoBurn = calcDamageRange(atk, def, FLAME_THROW, {});
    const spBurn = calcDamageRange(atk, def, FLAME_THROW, { attackerBurned: true });
    expect(spBurn).toEqual(spNoBurn);
  });

  it('壁(リフレクター): 物理を ×0.5 / 急所では無視', () => {
    // 物理 base=44。 リフレク r=100: pokeRound(44,2048)=22
    const refl = calcDamageRange(atk, def, AQUA_SHOT, { reflect: true });
    expect(refl[refl.length - 1]).toBe(22);

    // ひかりのかべ(特殊用)は物理に無効 → 44のまま
    const ls = calcDamageRange(atk, def, AQUA_SHOT, { lightScreen: true });
    expect(ls[ls.length - 1]).toBe(44);
  });
});
