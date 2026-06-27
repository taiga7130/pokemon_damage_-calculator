import { useEffect, useMemo, useState } from 'react';
import { calcDamage, computeTypeEffectiveness } from '../index';
import type { PokemonType, Weather, ItemId } from '../types';
import {
  FORMS, MOVES, toMove, buildAttacker, buildDefender, effectivenessLabel, siblingForms,
  TYPE_JA, TYPE_COLOR, type FormEntry, type MoveEntry, type NatureChoice,
} from './adapter';
import { SearchSelect, type Option } from './SearchSelect';
import { ITEMS, IMPLEMENTED_ABILITY_JA, isEffectiveAbility } from './registry';

function TypeBadges({ types }: { types: PokemonType[] }) {
  return (
    <span className="badges">
      {types.map((t) => (
        <span key={t} className="badge" style={{ background: TYPE_COLOR[t] }}>{TYPE_JA[t]}</span>
      ))}
    </span>
  );
}

const pokemonOptions: Option[] = FORMS.map((f) => ({
  key: f.key, label: f.formName, sub: <TypeBadges types={f.types} />,
}));
const moveOptions: Option[] = MOVES.map((m) => ({
  key: m.moveId, label: `${m.name}（威力${m.power}）`,
  sub: <span className="badge" style={{ background: TYPE_COLOR[m.type] }}>{m.category === 'physical' ? '物理' : '特殊'}</span>,
}));

function NatureToggle({ value, onChange, up, down }: {
  value: NatureChoice; onChange: (v: NatureChoice) => void; up: string; down: string;
}) {
  return (
    <div className="seg">
      <button className={value === 'up' ? 'on' : ''} onClick={() => onChange('up')}>{up}↑</button>
      <button className={value === 'neutral' ? 'on' : ''} onClick={() => onChange('neutral')}>無補正</button>
      <button className={value === 'down' ? 'on' : ''} onClick={() => onChange('down')}>{down}↓</button>
    </div>
  );
}

function SpField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="spf">
      <span className="spf-lbl">{label}</span>
      <input type="number" min={0} max={32} value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(32, Math.floor(Number(e.target.value) || 0))))} />
      <button className="spf-max" onClick={() => onChange(32)}>最大</button>
    </div>
  );
}

function AbilitySelect({ form, value, onChange }: { form: FormEntry; value: string; onChange: (v: string) => void }) {
  const extra = IMPLEMENTED_ABILITY_JA.filter((j) => !form.abilities.includes(j));
  return (
    <select className="sel" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">特性なし</option>
      {form.abilities.map((j) => (
        <option key={`c-${j}`} value={j}>{isEffectiveAbility(j) ? j : `${j}（影響なし）`}</option>
      ))}
      <optgroup label="実装済み特性から選ぶ">
        {extra.map((j) => <option key={`e-${j}`} value={j}>{j}</option>)}
      </optgroup>
    </select>
  );
}

function ItemSelect({ value, onChange }: { value: ItemId; onChange: (v: ItemId) => void }) {
  const groups = Array.from(new Set(ITEMS.map((i) => i.group)));
  return (
    <select className="sel" value={value} onChange={(e) => onChange(e.target.value as ItemId)}>
      {groups.map((g) => {
        const items = ITEMS.filter((i) => i.group === g);
        if (g === '') return items.map((i) => <option key={i.id} value={i.id}>{i.ja}</option>);
        return (
          <optgroup key={g} label={g}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.ja}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

function MegaChips({ form, onPick }: { form: FormEntry; onPick: (key: string) => void }) {
  const sibs = siblingForms(form);
  if (sibs.length <= 1) return null;
  return (
    <div className="chips">
      {sibs.map((s) => (
        <button key={s.key} className={`chip ${s.key === form.key ? 'on' : ''}`} onClick={() => onPick(s.key)}>
          {s.formType === 'base' ? '通常' : s.formName.replace(form.speciesName, '') || s.formName}
        </button>
      ))}
    </div>
  );
}

const RANKS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

export default function App() {
  const [atkKey, setAtkKey] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [defKey, setDefKey] = useState<string | null>(null);
  const [showRolls, setShowRolls] = useState(false);

  // 攻撃側入力
  const [atkSP, setAtkSP] = useState(0);
  const [atkNat, setAtkNat] = useState<NatureChoice>('up');
  const [atkAbil, setAtkAbil] = useState('');
  const [atkItem, setAtkItem] = useState<ItemId>('none');
  const [atkRank, setAtkRank] = useState(0);
  // 防御側入力
  const [defHpSP, setDefHpSP] = useState(0);
  const [defSP, setDefSP] = useState(0);
  const [defNat, setDefNat] = useState<NatureChoice>('neutral');
  const [defAbil, setDefAbil] = useState('');
  const [defItem, setDefItem] = useState<ItemId>('none');
  const [defRank, setDefRank] = useState(0);
  // 場の状態
  const [weather, setWeather] = useState<Weather>('none');
  const [wall, setWall] = useState(false);
  const [crit, setCrit] = useState(false);
  const [burn, setBurn] = useState(false);

  const atk = useMemo<FormEntry | null>(() => FORMS.find((f) => f.key === atkKey) ?? null, [atkKey]);
  const def = useMemo<FormEntry | null>(() => FORMS.find((f) => f.key === defKey) ?? null, [defKey]);
  const move = useMemo<MoveEntry | null>(() => MOVES.find((m) => m.moveId === moveId) ?? null, [moveId]);
  const isPhysical = move?.category === 'physical';

  // フォルム変更時に特性/持ち物をリセット（古い選択の持ち越し防止）
  useEffect(() => { setAtkAbil(''); setAtkItem('none'); }, [atkKey]);
  useEffect(() => { setDefAbil(''); setDefItem('none'); }, [defKey]);

  const result = useMemo(() => {
    if (!atk || !def || !move) return null;
    const a = buildAttacker({ form: atk, isPhysical: move.category === 'physical', sp: atkSP, nature: atkNat, abilityJa: atkAbil, item: atkItem, rank: atkRank });
    const d = buildDefender({ form: def, isPhysical: move.category === 'physical', hpSp: defHpSP, defSp: defSP, nature: defNat, abilityJa: defAbil, item: defItem, rank: defRank });
    const cond = {
      weather, isCrit: crit, attackerBurned: burn,
      reflect: wall && move.category === 'physical',
      lightScreen: wall && move.category === 'special',
    };
    const r = calcDamage(a, d, toMove(move), cond);
    const eff = computeTypeEffectiveness(a, d, toMove(move));
    return { r, eff };
  }, [atk, def, move, atkSP, atkNat, atkAbil, atkItem, atkRank, defHpSP, defSP, defNat, defAbil, defItem, defRank, weather, wall, crit, burn]);

  const offLabel = isPhysical ? '攻撃' : '特攻';
  const defLabel = isPhysical ? '防御' : '特防';

  return (
    <div className="app">
      <header className="hdr">
        <h1>ダメージ計算機</h1>
        <span className="hdr-sub">Lv50 / 6V 固定</span>
      </header>

      {/* 攻撃側 */}
      <section className="card">
        <label className="lbl">攻撃側</label>
        <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={atkKey} onChange={setAtkKey} />
        {atk && (
          <>
            <MegaChips form={atk} onPick={setAtkKey} />
            <div className="meta"><TypeBadges types={atk.types} />
              <span className="stats">H{atk.baseStats.hp} A{atk.baseStats.atk} B{atk.baseStats.def} C{atk.baseStats.spa} D{atk.baseStats.spd} S{atk.baseStats.spe}</span>
            </div>
            <details className="det" open>
              <summary>SP・性格・特性・持ち物・ランク</summary>
              <SpField label={`${offLabel} SP`} value={atkSP} onChange={setAtkSP} />
              <NatureToggle value={atkNat} onChange={setAtkNat} up={offLabel} down={offLabel} />
              <AbilitySelect form={atk} value={atkAbil} onChange={setAtkAbil} />
              <ItemSelect value={atkItem} onChange={setAtkItem} />
              <div className="rankrow"><span>{offLabel}ランク</span>
                <select className="sel sel-sm" value={atkRank} onChange={(e) => setAtkRank(Number(e.target.value))}>
                  {RANKS.map((r) => <option key={r} value={r}>{r > 0 ? `+${r}` : r}</option>)}
                </select>
              </div>
            </details>
          </>
        )}
      </section>

      {/* 技 */}
      <section className="card">
        <label className="lbl">技</label>
        <SearchSelect placeholder="技を選択" options={moveOptions} value={moveId} onChange={setMoveId} />
        {move && (
          <div className="meta">
            <span className="badge" style={{ background: TYPE_COLOR[move.type] }}>{TYPE_JA[move.type]}</span>
            <span>{move.category === 'physical' ? '物理' : '特殊'} / 威力{move.power}{move.isContact ? ' / 接触' : ''}</span>
          </div>
        )}
      </section>

      {/* 防御側 */}
      <section className="card">
        <label className="lbl">防御側</label>
        <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={defKey} onChange={setDefKey} />
        {def && (
          <>
            <MegaChips form={def} onPick={setDefKey} />
            <div className="meta"><TypeBadges types={def.types} />
              <span className="stats">H{def.baseStats.hp} A{def.baseStats.atk} B{def.baseStats.def} C{def.baseStats.spa} D{def.baseStats.spd} S{def.baseStats.spe}</span>
            </div>
            <details className="det" open>
              <summary>SP・性格・特性・持ち物・ランク</summary>
              <SpField label="HP SP" value={defHpSP} onChange={setDefHpSP} />
              <SpField label={`${defLabel} SP`} value={defSP} onChange={setDefSP} />
              <NatureToggle value={defNat} onChange={setDefNat} up={defLabel} down={defLabel} />
              <AbilitySelect form={def} value={defAbil} onChange={setDefAbil} />
              <ItemSelect value={defItem} onChange={setDefItem} />
              <div className="rankrow"><span>{defLabel}ランク</span>
                <select className="sel sel-sm" value={defRank} onChange={(e) => setDefRank(Number(e.target.value))}>
                  {RANKS.map((r) => <option key={r} value={r}>{r > 0 ? `+${r}` : r}</option>)}
                </select>
              </div>
            </details>
          </>
        )}
      </section>

      {/* 場の状態 */}
      <section className="card">
        <label className="lbl">場の状態</label>
        <div className="field">
          <div className="rankrow"><span>天候</span>
            <select className="sel sel-sm" value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
              <option value="none">なし</option><option value="sun">晴</option><option value="rain">雨</option>
              <option value="sand">砂</option><option value="snow">雪</option>
            </select>
          </div>
          <div className="toggles">
            <button className={wall ? 'tg on' : 'tg'} onClick={() => setWall((v) => !v)}>
              壁（{isPhysical === false ? 'ひかりのかべ' : 'リフレク'}）
            </button>
            <button className={crit ? 'tg on' : 'tg'} onClick={() => setCrit((v) => !v)}>急所</button>
            <button className={burn ? 'tg on' : 'tg'} onClick={() => setBurn((v) => !v)}>やけど</button>
          </div>
        </div>
      </section>

      {/* 結果 */}
      <section className={`result ${result ? '' : 'is-empty'}`}>
        {!result && <div className="result-hint">攻撃側・技・防御側を選ぶと確定数が出ます</div>}
        {result && (
          <>
            <div className="eff">{effectivenessLabel(result.eff)}</div>
            <div className={`ko ${result.r.isImmune ? 'ko-immune' : ''}`}>
              {result.r.isImmune ? 'ダメージなし' : result.r.ko.label}
            </div>
            {!result.r.isImmune && (
              <>
                <div className="dmg"><span className="dmg-num">{result.r.minDamage}〜{result.r.maxDamage}</span><span className="dmg-unit">ダメージ</span></div>
                <div className="pct">{result.r.minPercent}% 〜 {result.r.maxPercent}%</div>
                <button className="rolls-toggle" onClick={() => setShowRolls((v) => !v)}>{showRolls ? '16通りを隠す' : '16通りの内訳'}</button>
                {showRolls && <div className="rolls">{result.r.rolls.join(', ')}</div>}
              </>
            )}
          </>
        )}
      </section>

      <footer className="ftr">計算: エンジン calcDamage / データ: PChamp DB</footer>
    </div>
  );
}
