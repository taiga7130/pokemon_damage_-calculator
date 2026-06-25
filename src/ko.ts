// ============================================================
// §7 確定数（乱数16通りの組み合わせ確率）
// ============================================================
import type { KOResult } from './types';

function makeLabel(n: number, probability: number, guaranteed: boolean): string {
  if (guaranteed) return `確定${n}発`;
  // % は小数第1位まで（damekei 照合を見据えた丸め桁）
  const pct = (Math.round(probability * 1000) / 10).toFixed(1);
  return `乱数${n}発 (${pct}%)`;
}

/**
 * §7 確定数の判定。
 *
 * n=1,2,3… と打数を増やし、「n発の合計が targetHP 以上になる確率 p」を
 * ロール組み合わせ総数ベース（16^n 通り）で算出する。
 *   - p>0 となる最小の n を採用。
 *   - 全組み合わせで KO（count===total）なら「確定n発」、それ以外は「乱数n発 (p%)」。
 *
 * @param rolls    16通りのダメージ（各々が等確率 1/16）
 * @param targetHP KO に必要なダメージ（相手の残りHP）
 */
export function calcKOProbability(rolls: number[], targetHP: number): KOResult {
  const maxRoll = rolls.length ? Math.max(...rolls) : 0;
  if (maxRoll <= 0 || targetHP <= 0) {
    return { hits: 0, probability: 0, guaranteed: false, label: 'ダメージなし' };
  }

  const N = rolls.length; // 16
  const SAFETY = 16;      // これを超えても落とせない＝事実上の極端ケース

  // n発のダメージ合計分布を畳み込みで構築（sum -> 組み合わせ数）。
  let dist = new Map<number, number>([[0, 1]]);
  for (let n = 1; n <= SAFETY; n++) {
    const next = new Map<number, number>();
    for (const [s, c] of dist) {
      for (const r of rolls) {
        const ns = s + r;
        next.set(ns, (next.get(ns) ?? 0) + c);
      }
    }
    dist = next;

    const total = Math.pow(N, n);
    let ko = 0;
    for (const [s, c] of dist) if (s >= targetHP) ko += c;

    if (ko > 0) {
      const probability = ko / total;
      const guaranteed = ko === total;
      return { hits: n, probability, guaranteed, label: makeLabel(n, probability, guaranteed) };
    }
  }

  return { hits: Infinity, probability: 0, guaranteed: false, label: '確定数なし' };
}
