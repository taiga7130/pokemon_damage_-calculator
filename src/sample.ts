// ============================================================
// サンプル実行（§10 検証用の入力例を1つ出力する）
//   npm run sample
// ============================================================
import { calcDamage } from './index';
import { makeState, EMBERON, NORMUX, FLAME_THROW } from '../data/dummy';

const attacker = makeState(EMBERON); // ほのお / spa実数値120 / 無補正・SP0
const defender = makeState(NORMUX);  // ノーマル / spd実数値100 / HP120

const result = calcDamage(attacker, defender, FLAME_THROW, {});

console.log('=== 入力 ===');
console.log('攻撃: Emberon(ほのお) spa=120  技: flameThrow(ほのお/特殊/威力90)');
console.log('防御: Normux(ノーマル) spd=100  HP=120');
console.log('条件: 天候なし・急所なし・やけどなし・壁なし・持ち物なし');
console.log('');
console.log('=== 出力 ===');
console.log('16通り :', result.rolls.join(', '));
console.log(`ダメージ: ${result.minDamage} 〜 ${result.maxDamage}`);
console.log(`割合    : ${result.minPercent}% 〜 ${result.maxPercent}%`);
console.log(`確定数  : ${result.ko.label}`);
