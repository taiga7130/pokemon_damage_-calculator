// ============================================================
// damekei照合用 検証スクリプト（実在ポケモン）
//   ガブリアス じだんだ → ドドゲザン
//   npx tsx scripts/verify_garchomp.ts
// エンジンのロジックは変更しない。実在の数値を流し込むだけ。
// ============================================================
import type { Species, Move } from '../src/types';
import { calcStat, calcHP, getStatValue } from '../src/stats';
import { calcEffectiveAttack, calcEffectiveDefense } from '../src/effective';
import { calcBaseDamage } from '../src/damage';
import { calcTypeEffectiveness } from '../src/typeChart';
import { pokeRound, MOD } from '../src/pokeRound';
import { calcDamage } from '../src/index';
import { makeState, ATK_UP, sp } from '../data/dummy';

// ---- 実在ポケモンのダミー差し替え ----
const GARCHOMP: Species = {
  name: 'ガブリアス',
  types: ['ground'], // じめん（ドラゴンは相性に無関係なので省略可。ここではタイプ一致判定に ground を使用）
  baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
};
const KINGAMBIT: Species = {
  name: 'ドドゲザン',
  types: ['dark', 'steel'], // あく/はがね
  baseStats: { hp: 100, atk: 135, def: 120, spa: 60, spd: 85, spe: 50 },
};
const STOMP: Move = { name: 'じだんだ', type: 'ground', category: 'physical', power: 70, isContact: true };

// いじっぱり=攻撃↑特攻↓ / 攻撃SP32 / いのちのたま
const attacker = makeState(GARCHOMP, { nature: ATK_UP, sp: sp({ atk: 32 }), item: 'lifeOrb' });
const defender = makeState(KINGAMBIT); // 無補正・無振り

console.log('========== 入力ステータスの確認 ==========');
const atkStat = getStatValue(attacker, 'atk');
const defHP = getStatValue(defender, 'hp');
const defStat = getStatValue(defender, 'def');
console.log(`攻撃 実数値: ${atkStat}  (想定200) = calcStat(130, 32, 1.1)=${calcStat(130, 32, 1.1)}`);
console.log(`防御HP 実数値: ${defHP}  (想定175) = calcHP(100, 0)=${calcHP(100, 0)}`);
console.log(`防御 実数値: ${defStat}  (想定140) = calcStat(120, 0, 1.0)=${calcStat(120, 0, 1.0)}`);

console.log('\n========== ステップ別の手追い ==========');
const A = calcEffectiveAttack(attacker, STOMP, {});
const D = calcEffectiveDefense(defender, STOMP, {});
const base = calcBaseDamage(STOMP.power, A, D);
const typeEff = calcTypeEffectiveness(STOMP.type, defender.species.types);
console.log(`A_eff=${A}, D_eff=${D}`);
console.log(`基礎ダメージ base = floor(floor(22*${STOMP.power}*${A}/${D})/50)+2 = ${base}`);
console.log(`タイプ相性 (じめん→あく/はがね) = ${typeEff}`);

console.log('\n  r | rand=floor(base*r/100) | STAB pokeRound×1.5 | 相性×2 | item pokeRound×1.3');
for (let r = 85; r <= 100; r++) {
  const s1 = Math.floor(base * r / 100);
  const s2 = pokeRound(s1, MOD.X1_5);
  const s3 = s2 * 2;
  const s4 = pokeRound(s3, MOD.X1_3);
  console.log(`  ${r} | ${s1} | ${s2} | ${s3} | ${s4}`);
}

console.log('\n========== エンジン出力（calcDamage） ==========');
const result = calcDamage(attacker, defender, STOMP, {});
console.log('16通り:', result.rolls.join(','));
console.log(`ダメージ: ${result.minDamage} 〜 ${result.maxDamage}`);
console.log(`割合    : ${result.minPercent}% 〜 ${result.maxPercent}%`);
console.log(`確定数  : ${result.ko.label}  (HP=${defHP}以上のロール数 = ${result.rolls.filter((d) => d >= defHP).length}/16)`);

console.log('\n========== 想定値との突き合わせ ==========');
const expected = [153, 155, 155, 157, 157, 161, 163, 163, 166, 168, 168, 172, 174, 174, 178, 179];
console.log('想定16通り:', expected.join(','));
console.log('一致       :', JSON.stringify(result.rolls) === JSON.stringify(expected));
const diffs = result.rolls.map((d, i) => (d === expected[i] ? null : `idx${i}: 実${d} vs 想定${expected[i]}`)).filter(Boolean);
console.log('差分       :', diffs.length ? diffs.join(' / ') : 'なし');
