import { useMemo, useState } from 'react';
import { calcDamage, computeTypeEffectiveness } from '../index';
import type { PokemonType, Weather, ItemId, StatBlock } from '../types';
import {
  FORMS, MOVES, toMove, buildAttacker, buildDefender, effectivenessLabel, siblingForms,
  TYPE_JA, TYPE_COLOR, type FormEntry, type NatureChoice,
} from './adapter';
import { SearchSelect, type Option } from './SearchSelect';
import { ITEMS, IMPLEMENTED_ABILITY_JA, isEffectiveAbility } from './registry';

// ============================================================
// データモデル: 各ポケモンは役割に依存しない「育成データ(Build)」を保持。
// 攻守入替は2つのBuildのどちらを攻撃側にするかを切り替えるだけ。
// SP/性格/ランクは6ステ分（攻防両用）を内部保持し、役割に応じて表示を出し分ける。
// ============================================================
type OffStat = 'atk' | 'spa';
type DefStat = 'def' | 'spd';
type NatStat = OffStat | DefStat;

interface Build {
  formKey: string | null;
  moveId: string | null;            // 技は攻撃側に紐づく
  sp: StatBlock;                    // 6ステ分
  nature: Record<NatStat, NatureChoice>;
  rank: Record<NatStat, number>;
  abilityJa: string;
  item: ItemId;
}

function newBuild(): Build {
  return {
    formKey: null, moveId: null,
    sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: { atk: 'up', spa: 'up', def: 'neutral', spd: 'neutral' }, // 攻撃ステは↑が既定
    rank: { atk: 0, spa: 0, def: 0, spd: 0 },
    abilityJa: '', item: 'none',
  };
}

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

function NatureToggle({ value, onChange, label }: { value: NatureChoice; onChange: (v: NatureChoice) => void; label: string }) {
  return (
    <div className="seg">
      <button className={value === 'up' ? 'on' : ''} onClick={() => onChange('up')}>{label}↑</button>
      <button className={value === 'neutral' ? 'on' : ''} onClick={() => onChange('neutral')}>無補正</button>
      <button className={value === 'down' ? 'on' : ''} onClick={() => onChange('down')}>{label}↓</button>
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
      {form.abilities.map((j) => <option key={`c-${j}`} value={j}>{isEffectiveAbility(j) ? j : `${j}（影響なし）`}</option>)}
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
        return <optgroup key={g} label={g}>{items.map((i) => <option key={i.id} value={i.id}>{i.ja}</option>)}</optgroup>;
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
const formOf = (key: string | null) => (key ? FORMS.find((f) => f.key === key) ?? null : null);

export default function App() {
  const [builds, setBuilds] = useState<[Build, Build]>([newBuild(), newBuild()]);
  const [swapped, setSwapped] = useState(false);
  const [showRolls, setShowRolls] = useState(false);
  const [weather, setWeather] = useState<Weather>('none');
  const [wall, setWall] = useState(false);
  const [crit, setCrit] = useState(false);
  const [burn, setBurn] = useState(false);

  const atkIdx = swapped ? 1 : 0;
  const defIdx = swapped ? 0 : 1;
  const atkBuild = builds[atkIdx];
  const defBuild = builds[defIdx];

  const updateBuild = (idx: number, fn: (b: Build) => Build) =>
    setBuilds((prev) => prev.map((b, i) => (i === idx ? fn(b) : b)) as [Build, Build]);

  const atk = formOf(atkBuild.formKey);
  const def = formOf(defBuild.formKey);
  const move = atkBuild.moveId ? MOVES.find((m) => m.moveId === atkBuild.moveId) ?? null : null;

  const isPhysical = move ? move.category === 'physical' : true;
  const offKey: OffStat = isPhysical ? 'atk' : 'spa';   // 攻撃側が使うステ
  const defKey: DefStat = isPhysical ? 'def' : 'spd';   // 防御側が受けるステ（技分類に追従）
  const offLabel = isPhysical ? '攻撃' : '特攻';
  const defLabel = isPhysical ? '防御' : '特防';

  const result = useMemo(() => {
    if (!atk || !def || !move) return null;
    const phys = move.category === 'physical';
    const a = buildAttacker({ form: atk, isPhysical: phys, sp: atkBuild.sp[offKey], nature: atkBuild.nature[offKey], abilityJa: atkBuild.abilityJa, item: atkBuild.item, rank: atkBuild.rank[offKey] });
    const d = buildDefender({ form: def, isPhysical: phys, hpSp: defBuild.sp.hp, defSp: defBuild.sp[defKey], nature: defBuild.nature[defKey], abilityJa: defBuild.abilityJa, item: defBuild.item, rank: defBuild.rank[defKey] });
    const cond = { weather, isCrit: crit, attackerBurned: burn, reflect: wall && phys, lightScreen: wall && !phys };
    return { r: calcDamage(a, d, toMove(move), cond), eff: computeTypeEffectiveness(a, d, toMove(move)) };
  }, [atk, def, move, atkBuild, defBuild, offKey, defKey, weather, wall, crit, burn]);

  // ---- 攻撃側カード ----
  const renderAttacker = () => (
    <section className="card">
      <label className="lbl">攻撃側</label>
      <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={atkBuild.formKey}
        onChange={(k) => updateBuild(atkIdx, (b) => ({ ...b, formKey: k, abilityJa: '', item: 'none' }))} />
      {atk && (
        <>
          <MegaChips form={atk} onPick={(k) => updateBuild(atkIdx, (b) => ({ ...b, formKey: k }))} />
          <div className="meta"><TypeBadges types={atk.types} />
            <span className="stats">H{atk.baseStats.hp} A{atk.baseStats.atk} B{atk.baseStats.def} C{atk.baseStats.spa} D{atk.baseStats.spd} S{atk.baseStats.spe}</span>
          </div>
          <details className="det" open>
            <summary>SP・性格・特性・持ち物・ランク</summary>
            <SpField label={`${offLabel} SP`} value={atkBuild.sp[offKey]} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, sp: { ...b.sp, [offKey]: v } }))} />
            <NatureToggle label={offLabel} value={atkBuild.nature[offKey]} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, nature: { ...b.nature, [offKey]: v } }))} />
            <AbilitySelect form={atk} value={atkBuild.abilityJa} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, abilityJa: v }))} />
            <ItemSelect value={atkBuild.item} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, item: v }))} />
            <div className="rankrow"><span>{offLabel}ランク</span>
              <select className="sel sel-sm" value={atkBuild.rank[offKey]} onChange={(e) => updateBuild(atkIdx, (b) => ({ ...b, rank: { ...b.rank, [offKey]: Number(e.target.value) } }))}>
                {RANKS.map((r) => <option key={r} value={r}>{r > 0 ? `+${r}` : r}</option>)}
              </select>
            </div>
          </details>
        </>
      )}
    </section>
  );

  // ---- 防御側カード ----
  const renderDefender = () => (
    <section className="card">
      <label className="lbl">防御側</label>
      <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={defBuild.formKey}
        onChange={(k) => updateBuild(defIdx, (b) => ({ ...b, formKey: k, abilityJa: '', item: 'none' }))} />
      {def && (
        <>
          <MegaChips form={def} onPick={(k) => updateBuild(defIdx, (b) => ({ ...b, formKey: k }))} />
          <div className="meta"><TypeBadges types={def.types} />
            <span className="stats">H{def.baseStats.hp} A{def.baseStats.atk} B{def.baseStats.def} C{def.baseStats.spa} D{def.baseStats.spd} S{def.baseStats.spe}</span>
          </div>
          <details className="det" open>
            <summary>SP・性格・特性・持ち物・ランク</summary>
            <SpField label="HP SP" value={defBuild.sp.hp} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, sp: { ...b.sp, hp: v } }))} />
            <SpField label={`${defLabel} SP`} value={defBuild.sp[defKey]} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, sp: { ...b.sp, [defKey]: v } }))} />
            <NatureToggle label={defLabel} value={defBuild.nature[defKey]} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, nature: { ...b.nature, [defKey]: v } }))} />
            <AbilitySelect form={def} value={defBuild.abilityJa} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, abilityJa: v }))} />
            <ItemSelect value={defBuild.item} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, item: v }))} />
            <div className="rankrow"><span>{defLabel}ランク</span>
              <select className="sel sel-sm" value={defBuild.rank[defKey]} onChange={(e) => updateBuild(defIdx, (b) => ({ ...b, rank: { ...b.rank, [defKey]: Number(e.target.value) } }))}>
                {RANKS.map((r) => <option key={r} value={r}>{r > 0 ? `+${r}` : r}</option>)}
              </select>
            </div>
          </details>
        </>
      )}
    </section>
  );

  return (
    <div className="app">
      <header className="hdr">
        <h1>ダメージ計算機</h1>
        <span className="hdr-sub">Lv50 / 6V 固定</span>
      </header>

      {renderAttacker()}

      <section className="card">
        <label className="lbl">技（攻撃側）</label>
        <SearchSelect placeholder="技を選択" options={moveOptions} value={atkBuild.moveId}
          onChange={(k) => updateBuild(atkIdx, (b) => ({ ...b, moveId: k }))} />
        {move && (
          <div className="meta">
            <span className="badge" style={{ background: TYPE_COLOR[move.type] }}>{TYPE_JA[move.type]}</span>
            <span>{move.category === 'physical' ? '物理' : '特殊'} / 威力{move.power}{move.isContact ? ' / 接触' : ''}</span>
          </div>
        )}
      </section>

      <div className="swapbar">
        <button className="swap" onClick={() => setSwapped((s) => !s)}>⇅ 攻守入替</button>
      </div>

      {renderDefender()}

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
            <button className={wall ? 'tg on' : 'tg'} onClick={() => setWall((v) => !v)}>壁（{isPhysical ? 'リフレク' : 'ひかりのかべ'}）</button>
            <button className={crit ? 'tg on' : 'tg'} onClick={() => setCrit((v) => !v)}>急所</button>
            <button className={burn ? 'tg on' : 'tg'} onClick={() => setBurn((v) => !v)}>やけど</button>
          </div>
        </div>
      </section>

      <section className={`result ${result ? '' : 'is-empty'}`}>
        {!result && <div className="result-hint">攻撃側・技・防御側を選ぶと確定数が出ます</div>}
        {result && (
          <>
            <div className="eff">{effectivenessLabel(result.eff)}</div>
            <div className={`ko ${result.r.isImmune ? 'ko-immune' : ''}`}>{result.r.isImmune ? 'ダメージなし' : result.r.ko.label}</div>
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
