// ============================================================
// 耐久調整の逆算: 「この攻撃を確定耐えする最小SP配分(HP/防御)」を全探索。
// 探索空間は HP SP 0..32 × 防御SP 0..32 の最大1089通り × calcDamage で、
// エンジンは純関数・軽量なので即時に終わる。UIから独立した純関数（テスト対象）。
// ============================================================
import { calcDamage, getStatValue } from '../index';
import type { Move, PokemonState, Conditions } from '../types';

export interface SurvivalCandidate {
  hpSp: number;
  defSp: number;
  total: number;
  hp: number;        // 実HP
  defStat: number;   // 防御 or 特防の実数値
  maxPercent: number; // その配分での最大被ダメ%
}

export interface SurvivalResult {
  /** 現在の振りで既に確定耐えしている */
  already: boolean;
  /** 確定耐えに必要な最小合計SPの候補（同合計の別配分を最大3件） */
  candidates: SurvivalCandidate[];
  /** フル投資(32/32)でも耐えられない場合 false */
  possible: boolean;
  /** フル投資時の最大被ダメ%（possible=false の説明表示用） */
  fullInvestMaxPercent: number;
}

const MAX_SP = 32;

/** defStatKey: 実数値表示に使う防御側のステータスキー（物理=def / 特殊=spd）。 */
export function findSurvivalSP(
  attacker: PokemonState,
  move: Move,
  cond: Conditions,
  makeDefender: (hpSp: number, defSp: number) => PokemonState,
  current: { hpSp: number; defSp: number },
  defStatKey: 'def' | 'spd',
): SurvivalResult {
  const evalSpread = (hpSp: number, defSp: number) => {
    const d = makeDefender(hpSp, defSp);
    const r = calcDamage(attacker, d, move, cond);
    const hp = getStatValue(d, 'hp');
    return {
      survives: r.maxDamage < hp, // 最大乱数がHP未満 = 確定耐え
      hp,
      defStat: getStatValue(d, defStatKey),
      maxPercent: r.maxPercent,
    };
  };

  // 現在の振りで既に耐えているか
  const cur = evalSpread(current.hpSp, current.defSp);
  if (cur.survives) {
    return { already: true, candidates: [], possible: true, fullInvestMaxPercent: cur.maxPercent };
  }

  // フル投資でも無理なら早期終了
  const full = evalSpread(MAX_SP, MAX_SP);
  if (!full.survives) {
    return { already: false, candidates: [], possible: false, fullInvestMaxPercent: full.maxPercent };
  }

  // 合計SPの小さい順に走査し、最初に耐えられる合計での配分候補を集める
  for (let total = 0; total <= MAX_SP * 2; total++) {
    const found: SurvivalCandidate[] = [];
    const lo = Math.max(0, total - MAX_SP);
    const hi = Math.min(MAX_SP, total);
    for (let hpSp = lo; hpSp <= hi; hpSp++) {
      const defSp = total - hpSp;
      const e = evalSpread(hpSp, defSp);
      if (e.survives) {
        found.push({ hpSp, defSp, total, hp: e.hp, defStat: e.defStat, maxPercent: e.maxPercent });
      }
    }
    if (found.length > 0) {
      // 同合計の候補が多いときは 両端＋中央 の最大3件に絞る（配分の傾向が分かれば十分）
      const picks =
        found.length <= 3
          ? found
          : [found[0], found[Math.floor(found.length / 2)], found[found.length - 1]];
      return { already: false, candidates: picks, possible: true, fullInvestMaxPercent: full.maxPercent };
    }
  }

  // ここには来ないはず（full が survives なら total=64 で必ず見つかる）
  return { already: false, candidates: [], possible: false, fullInvestMaxPercent: full.maxPercent };
}
