import { useEffect, useMemo, useState } from 'react';
import { calcDamage, computeTypeEffectiveness, calcHP, calcStat } from '../index';
import type { PokemonType, Weather, ItemId, StatBlock } from '../types';
import {
  FORMS, MOVES, toMove, buildAttacker, buildDefender, effectivenessLabel, siblingForms,
  TYPE_JA, TYPE_COLOR, type FormEntry, type NatureChoice,
} from './adapter';
import { SearchSelect, type Option } from './SearchSelect';
import { ITEMS, IMPLEMENTED_ABILITY_JA, isEffectiveAbility } from './registry';
import { encodeShare, decodeShare, type ShareBuild, type ShareState } from './share';
import { PresetBar } from './PresetBar';
import type { StoredBuild } from './presets';
import { findSurvivalSP } from './survival';

// ============================================================
// データモデル: 役割に依存しない育成データ(Build)×2 + 攻撃側フラグ。
// ============================================================
type OffStat = 'atk' | 'spa';
type DefStat = 'def' | 'spd';
type NatStat = OffStat | DefStat;

interface Build {
  formKey: string | null;
  moveId: string | null;
  sp: StatBlock;
  nature: Record<NatStat, NatureChoice>;
  rank: Record<NatStat, number>;
  abilityJa: string;
  item: ItemId;
}
function newBuild(): Build {
  return {
    formKey: null, moveId: null,
    sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: { atk: 'up', spa: 'up', def: 'neutral', spd: 'neutral' },
    rank: { atk: 0, spa: 0, def: 0, spd: 0 },
    abilityJa: '', item: 'none',
  };
}

// ---- 共有URL 変換 ----
const NAT_ENC: Record<NatureChoice, string> = { up: 'u', neutral: 'n', down: 'd' };
const NAT_DEC: Record<string, NatureChoice> = { u: 'up', n: 'neutral', d: 'down' };
function buildToShare(b: Build): ShareBuild {
  return {
    f: b.formKey ? FORMS.findIndex((f) => f.key === b.formKey) : -1,
    m: b.moveId ? MOVES.findIndex((m) => m.moveId === b.moveId) : -1,
    sp: [b.sp.hp, b.sp.atk, b.sp.def, b.sp.spa, b.sp.spd, b.sp.spe],
    n: [NAT_ENC[b.nature.atk], NAT_ENC[b.nature.spa], NAT_ENC[b.nature.def], NAT_ENC[b.nature.spd]],
    r: [b.rank.atk, b.rank.spa, b.rank.def, b.rank.spd],
    a: b.abilityJa, i: b.item,
  };
}
function shareToBuild(s: ShareBuild): Build {
  const fOk = s.f >= 0 && s.f < FORMS.length;
  const mOk = s.m >= 0 && s.m < MOVES.length;
  return {
    formKey: fOk ? FORMS[s.f].key : null,
    moveId: mOk ? MOVES[s.m].moveId : null,
    sp: { hp: s.sp[0], atk: s.sp[1], def: s.sp[2], spa: s.sp[3], spd: s.sp[4], spe: s.sp[5] },
    nature: { atk: NAT_DEC[s.n[0]] ?? 'neutral', spa: NAT_DEC[s.n[1]] ?? 'neutral', def: NAT_DEC[s.n[2]] ?? 'neutral', spd: NAT_DEC[s.n[3]] ?? 'neutral' },
    rank: { atk: s.r[0], spa: s.r[1], def: s.r[2], spd: s.r[3] },
    abilityJa: s.a, item: s.i as ItemId,
  };
}

function TypeBadges({ types }: { types: PokemonType[] }) {
  return <span className="badges">{types.map((t) => <span key={t} className="badge" style={{ background: TYPE_COLOR[t] }}>{TYPE_JA[t]}</span>)}</span>;
}
const pokemonOptions: Option[] = FORMS.map((f) => ({ key: f.key, label: f.formName, sub: <TypeBadges types={f.types} /> }));

function NatureToggle({ value, onChange, label }: { value: NatureChoice; onChange: (v: NatureChoice) => void; label: string }) {
  return (
    <div className="seg">
      <button className={value === 'up' ? 'on' : ''} onClick={() => onChange('up')}>{label}↑</button>
      <button className={value === 'neutral' ? 'on' : ''} onClick={() => onChange('neutral')}>無補正</button>
      <button className={value === 'down' ? 'on' : ''} onClick={() => onChange('down')}>{label}↓</button>
    </div>
  );
}
function SpField({ label, value, onChange, real }: { label: string; value: number; onChange: (n: number) => void; real?: number }) {
  return (
    <div className="spf">
      <span className="spf-lbl">{label}</span>
      <input type="number" min={0} max={32} value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(32, Math.floor(Number(e.target.value) || 0))))} />
      <button className="spf-max" onClick={() => onChange(32)}>最大</button>
      {real != null && <span className="spf-real">実数値 {real}</span>}
    </div>
  );
}
function AbilitySelect({ form, value, onChange }: { form: FormEntry; value: string; onChange: (v: string) => void }) {
  // 特性はそのポケモン（フォルム）の候補に紐づける。
  //   [] = 特性なしが正式仕様（Z系メガ）→「特性なし」のみ
  //   null = データ未収録 → 実装済みリストからの手動選択にフォールバック
  const bound = form.abilities;
  return (
    <select className="sel" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">特性なし</option>
      {bound !== null
        ? bound.map((j) => <option key={`c-${j}`} value={j}>{isEffectiveAbility(j) ? j : `${j}（ダメージ影響なし）`}</option>)
        : (
          <optgroup label="この形態の特性データ未収録（実装済みから選択）">
            {IMPLEMENTED_ABILITY_JA.map((j) => <option key={`e-${j}`} value={j}>{j}</option>)}
          </optgroup>
        )}
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
const STAT_LABEL: Record<NatStat, string> = { atk: '攻撃', spa: '特攻', def: '防御', spd: '特防' };

/** 攻撃/特攻・防御/特防 の編集対象切替。計算に使われている側に「使用中」を付ける。 */
function StatPicker<K extends NatStat>({ keys, value, used, onChange, hasMove }: {
  keys: [K, K]; value: K; used: K; onChange: (k: K) => void; hasMove: boolean;
}) {
  return (
    <div className="seg statseg">
      {keys.map((k) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {STAT_LABEL[k]}{hasMove && used === k && <span className="used">使用中</span>}
        </button>
      ))}
    </div>
  );
}
const TYPE_LIST = Object.keys(TYPE_JA) as PokemonType[];
const formOf = (key: string | null) => (key ? FORMS.find((f) => f.key === key) ?? null : null);

// ---- 実数値・SP合計の表示ヘルパー ----
const NATURE_MOD: Record<NatureChoice, 1.1 | 1.0 | 0.9> = { up: 1.1, neutral: 1.0, down: 0.9 };
const realOf = (form: FormEntry, key: NatStat, b: Build) =>
  calcStat(form.baseStats[key], b.sp[key], NATURE_MOD[b.nature[key]]);
const spTotal = (b: Build) => b.sp.hp + b.sp.atk + b.sp.def + b.sp.spa + b.sp.spd + b.sp.spe;

function SpTotal({ build }: { build: Build }) {
  const t = spTotal(build);
  return <div className={`sptotal ${t > 66 ? 'over' : ''}`}>SP合計 {t}/66{t > 66 ? '（上限超過）' : ''}</div>;
}

// 共有ハッシュからの初期復元
function initialFromHash(): ShareState | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace(/^#/, '');
  return h ? decodeShare(h) : null;
}

export default function App() {
  const init = initialFromHash();
  const [builds, setBuilds] = useState<[Build, Build]>(
    init ? [shareToBuild(init.p[0]), shareToBuild(init.p[1])] : [newBuild(), newBuild()],
  );
  const [swapped, setSwapped] = useState(init ? !!init.s : false);
  const [weather, setWeather] = useState<Weather>(init ? (init.w as Weather) : 'none');
  const [wall, setWall] = useState(init ? !!init.l : false);
  const [crit, setCrit] = useState(init ? !!init.c : false);
  const [burn, setBurn] = useState(init ? !!init.b : false);
  const [showRolls, setShowRolls] = useState(false);
  const [copied, setCopied] = useState(false);
  // 技フィルタ
  const [mType, setMType] = useState<PokemonType | 'all'>('all');
  const [mCat, setMCat] = useState<'all' | 'physical' | 'special'>('all');
  // 全技一括計算 / 耐久逆算 パネル
  const [bulkOpen, setBulkOpen] = useState(false);
  const [survOpen, setSurvOpen] = useState(false);

  const atkIdx = swapped ? 1 : 0;
  const defIdx = swapped ? 0 : 1;
  const atkBuild = builds[atkIdx];
  const defBuild = builds[defIdx];
  const updateBuild = (idx: number, fn: (b: Build) => Build) =>
    setBuilds((prev) => prev.map((b, i) => (i === idx ? fn(b) : b)) as [Build, Build]);

  const atk = formOf(atkBuild.formKey);
  const def = formOf(defBuild.formKey);
  const move = atkBuild.moveId ? MOVES.find((m) => m.moveId === atkBuild.moveId) ?? null : null;

  // 計算に使うステータスは技の分類で決まる（物理=攻撃/防御・特殊=特攻/特防）
  const isPhysical = move ? move.category === 'physical' : true;
  const offKey: OffStat = isPhysical ? 'atk' : 'spa';
  const defKey: DefStat = isPhysical ? 'def' : 'spd';
  const defLabel = isPhysical ? '防御' : '特防';

  // 編集対象のステータスは手動で切替可能（null = 技の分類に追従）。技を変えると追従に戻す。
  const [offPick, setOffPick] = useState<OffStat | null>(null);
  const [defPick, setDefPick] = useState<DefStat | null>(null);
  useEffect(() => { setOffPick(null); setDefPick(null); }, [move?.category]);
  const offEdit: OffStat = offPick ?? offKey;
  const defEdit: DefStat = defPick ?? defKey;
  const offEditLabel = STAT_LABEL[offEdit];
  const defEditLabel = STAT_LABEL[defEdit];

  // 共有URLを現在状態に同期
  const shareState = (): ShareState => ({ v: 1, s: swapped ? 1 : 0, w: weather, l: wall ? 1 : 0, c: crit ? 1 : 0, b: burn ? 1 : 0, p: [buildToShare(builds[0]), buildToShare(builds[1])] });
  useEffect(() => {
    window.history.replaceState(null, '', '#' + encodeShare(shareState()));
  }, [builds, swapped, weather, wall, crit, burn]);

  const copyUrl = async () => {
    const url = window.location.origin + window.location.pathname + '#' + encodeShare(shareState());
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  // 技フィルタの適用結果（選択肢と一括計算で共用）
  const filteredMoves = useMemo(
    () => MOVES.filter((m) => (mCat === 'all' || m.category === mCat) && (mType === 'all' || m.type === mType)),
    [mCat, mType],
  );

  // 技選択肢: タイプ/分類フィルタ＋タイプ一致(STAB)を上位＆★
  const moveOptions = useMemo<Option[]>(() => {
    const atkTypes = atk?.types ?? [];
    const sorted = [...filteredMoves].sort((a, b) => (atkTypes.includes(a.type) ? 0 : 1) - (atkTypes.includes(b.type) ? 0 : 1));
    return sorted.map((m) => ({
      key: m.moveId,
      label: `${atkTypes.includes(m.type) ? '★' : ''}${m.name}（威力${m.power}）`,
      sub: <span className="badge" style={{ background: TYPE_COLOR[m.type] }}>{m.category === 'physical' ? '物理' : '特殊'}</span>,
    }));
  }, [atk, filteredMoves]);

  // 通常時・急所時 両方を計算
  const result = useMemo(() => {
    if (!atk || !def || !move) return null;
    const phys = move.category === 'physical';
    const a = buildAttacker({ form: atk, isPhysical: phys, sp: atkBuild.sp[offKey], nature: atkBuild.nature[offKey], abilityJa: atkBuild.abilityJa, item: atkBuild.item, rank: atkBuild.rank[offKey] });
    const d = buildDefender({ form: def, isPhysical: phys, hpSp: defBuild.sp.hp, defSp: defBuild.sp[defKey], nature: defBuild.nature[defKey], abilityJa: defBuild.abilityJa, item: defBuild.item, rank: defBuild.rank[defKey] });
    const mv = toMove(move);
    const baseCond = { weather, attackerBurned: burn, reflect: wall && phys, lightScreen: wall && !phys };
    return {
      normal: calcDamage(a, d, mv, { ...baseCond, isCrit: false }),
      crit: calcDamage(a, d, mv, { ...baseCond, isCrit: true }),
      eff: computeTypeEffectiveness(a, d, mv),
    };
  }, [atk, def, move, atkBuild, defBuild, offKey, defKey, weather, wall, crit, burn]);

  const primary = result ? (crit ? result.crit : result.normal) : null;
  const secondary = result ? (crit ? result.normal : result.crit) : null;
  const secondaryLabel = crit ? '通常時' : '急所時';

  // 全技一括計算: フィルタ中の技すべてを現在の攻守設定で計算し、最大ダメージ順に並べる
  const bulk = useMemo(() => {
    if (!bulkOpen || !atk || !def) return null;
    const rows = filteredMoves.map((m) => {
      const phys = m.category === 'physical';
      const oKey: OffStat = phys ? 'atk' : 'spa';
      const dKey: DefStat = phys ? 'def' : 'spd';
      const a = buildAttacker({ form: atk, isPhysical: phys, sp: atkBuild.sp[oKey], nature: atkBuild.nature[oKey], abilityJa: atkBuild.abilityJa, item: atkBuild.item, rank: atkBuild.rank[oKey] });
      const d = buildDefender({ form: def, isPhysical: phys, hpSp: defBuild.sp.hp, defSp: defBuild.sp[dKey], nature: defBuild.nature[dKey], abilityJa: defBuild.abilityJa, item: defBuild.item, rank: defBuild.rank[dKey] });
      const r = calcDamage(a, d, toMove(m), { weather, attackerBurned: burn, reflect: wall && phys, lightScreen: wall && !phys, isCrit: crit });
      return { m, r };
    });
    rows.sort((x, y) => y.r.maxPercent - x.r.maxPercent);
    return rows.slice(0, 60);
  }, [bulkOpen, atk, def, atkBuild, defBuild, filteredMoves, weather, wall, crit, burn]);

  // 耐久逆算: 現在の攻撃を確定耐えする最小SP配分（防御側の性格・持ち物・ランクは現状のまま）
  const surv = useMemo(() => {
    if (!survOpen || !atk || !def || !move) return null;
    const phys = move.category === 'physical';
    const a = buildAttacker({ form: atk, isPhysical: phys, sp: atkBuild.sp[offKey], nature: atkBuild.nature[offKey], abilityJa: atkBuild.abilityJa, item: atkBuild.item, rank: atkBuild.rank[offKey] });
    const cond = { weather, attackerBurned: burn, reflect: wall && phys, lightScreen: wall && !phys, isCrit: crit };
    return findSurvivalSP(
      a, toMove(move), cond,
      (hpSp, defSp) => buildDefender({ form: def, isPhysical: phys, hpSp, defSp, nature: defBuild.nature[defKey], abilityJa: defBuild.abilityJa, item: defBuild.item, rank: defBuild.rank[defKey] }),
      { hpSp: defBuild.sp.hp, defSp: defBuild.sp[defKey] },
      defKey,
    );
  }, [survOpen, atk, def, move, atkBuild, defBuild, offKey, defKey, weather, wall, crit, burn]);

  const renderAttacker = () => (
    <section className="card">
      <label className="lbl">攻撃側</label>
      <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={atkBuild.formKey}
        onChange={(k) => updateBuild(atkIdx, (b) => ({ ...b, formKey: k, abilityJa: '', item: 'none' }))} />
      <PresetBar formName={atk?.formName ?? null} build={atkBuild}
        onLoad={(b: StoredBuild) => updateBuild(atkIdx, () => ({ ...b, item: b.item as ItemId }))} />
      {atk && (
        <>
          <MegaChips form={atk} onPick={(k) => updateBuild(atkIdx, (b) => ({ ...b, formKey: k, abilityJa: '' }))} />
          <div className="meta"><TypeBadges types={atk.types} /><span className="stats">H{atk.baseStats.hp} A{atk.baseStats.atk} B{atk.baseStats.def} C{atk.baseStats.spa} D{atk.baseStats.spd} S{atk.baseStats.spe}</span></div>
          <details className="det" open>
            <summary>SP・性格・特性・持ち物・ランク</summary>
            <StatPicker keys={['atk', 'spa']} value={offEdit} used={offKey} hasMove={!!move} onChange={setOffPick} />
            <div className="statsum">
              <span className={offKey === 'atk' && move ? 'on' : ''}>攻撃 {realOf(atk, 'atk', atkBuild)}</span>
              <span className={offKey === 'spa' && move ? 'on' : ''}>特攻 {realOf(atk, 'spa', atkBuild)}</span>
              {move && offEdit !== offKey && <span className="hint">選択中の技は{isPhysical ? '物理' : '特殊'}技（{STAT_LABEL[offKey]}で計算）</span>}
            </div>
            <SpField label={`${offEditLabel} SP`} value={atkBuild.sp[offEdit]} real={realOf(atk, offEdit, atkBuild)}
              onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, sp: { ...b.sp, [offEdit]: v } }))} />
            <NatureToggle label={offEditLabel} value={atkBuild.nature[offEdit]} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, nature: { ...b.nature, [offEdit]: v } }))} />
            <AbilitySelect form={atk} value={atkBuild.abilityJa} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, abilityJa: v }))} />
            <ItemSelect value={atkBuild.item} onChange={(v) => updateBuild(atkIdx, (b) => ({ ...b, item: v }))} />
            <div className="rankrow"><span>{offEditLabel}ランク</span>
              <select className="sel sel-sm" value={atkBuild.rank[offEdit]} onChange={(e) => updateBuild(atkIdx, (b) => ({ ...b, rank: { ...b.rank, [offEdit]: Number(e.target.value) } }))}>
                {RANKS.map((r) => <option key={r} value={r}>{r > 0 ? `+${r}` : r}</option>)}
              </select>
            </div>
            <SpTotal build={atkBuild} />
          </details>
        </>
      )}
    </section>
  );

  const renderDefender = () => (
    <section className="card">
      <label className="lbl">防御側</label>
      <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={defBuild.formKey}
        onChange={(k) => updateBuild(defIdx, (b) => ({ ...b, formKey: k, abilityJa: '', item: 'none' }))} />
      <PresetBar formName={def?.formName ?? null} build={defBuild}
        onLoad={(b: StoredBuild) => updateBuild(defIdx, () => ({ ...b, item: b.item as ItemId }))} />
      {def && (
        <>
          <MegaChips form={def} onPick={(k) => updateBuild(defIdx, (b) => ({ ...b, formKey: k, abilityJa: '' }))} />
          <div className="meta"><TypeBadges types={def.types} /><span className="stats">H{def.baseStats.hp} A{def.baseStats.atk} B{def.baseStats.def} C{def.baseStats.spa} D{def.baseStats.spd} S{def.baseStats.spe}</span></div>
          <details className="det" open>
            <summary>SP・性格・特性・持ち物・ランク</summary>
            <StatPicker keys={['def', 'spd']} value={defEdit} used={defKey} hasMove={!!move} onChange={setDefPick} />
            <div className="statsum">
              <span>HP {calcHP(def.baseStats.hp, defBuild.sp.hp)}</span>
              <span className={defKey === 'def' && move ? 'on' : ''}>防御 {realOf(def, 'def', defBuild)}</span>
              <span className={defKey === 'spd' && move ? 'on' : ''}>特防 {realOf(def, 'spd', defBuild)}</span>
              {move && defEdit !== defKey && <span className="hint">選択中の技は{isPhysical ? '物理' : '特殊'}技（{STAT_LABEL[defKey]}で計算）</span>}
            </div>
            <SpField label="HP SP" value={defBuild.sp.hp} real={calcHP(def.baseStats.hp, defBuild.sp.hp)}
              onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, sp: { ...b.sp, hp: v } }))} />
            <SpField label={`${defEditLabel} SP`} value={defBuild.sp[defEdit]} real={realOf(def, defEdit, defBuild)}
              onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, sp: { ...b.sp, [defEdit]: v } }))} />
            <NatureToggle label={defEditLabel} value={defBuild.nature[defEdit]} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, nature: { ...b.nature, [defEdit]: v } }))} />
            <AbilitySelect form={def} value={defBuild.abilityJa} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, abilityJa: v }))} />
            <ItemSelect value={defBuild.item} onChange={(v) => updateBuild(defIdx, (b) => ({ ...b, item: v }))} />
            <div className="rankrow"><span>{defEditLabel}ランク</span>
              <select className="sel sel-sm" value={defBuild.rank[defEdit]} onChange={(e) => updateBuild(defIdx, (b) => ({ ...b, rank: { ...b.rank, [defEdit]: Number(e.target.value) } }))}>
                {RANKS.map((r) => <option key={r} value={r}>{r > 0 ? `+${r}` : r}</option>)}
              </select>
            </div>
            <SpTotal build={defBuild} />
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
        <button className="copy" onClick={copyUrl}>{copied ? 'コピー済' : '共有URL'}</button>
      </header>

      {renderAttacker()}

      <section className="card">
        <label className="lbl">技（攻撃側）</label>
        <div className="filter">
          <div className="seg seg-sm">
            <button className={mCat === 'all' ? 'on' : ''} onClick={() => setMCat('all')}>全</button>
            <button className={mCat === 'physical' ? 'on' : ''} onClick={() => setMCat('physical')}>物理</button>
            <button className={mCat === 'special' ? 'on' : ''} onClick={() => setMCat('special')}>特殊</button>
          </div>
          <select className="sel sel-sm" value={mType} onChange={(e) => setMType(e.target.value as PokemonType | 'all')}>
            <option value="all">全タイプ</option>
            {TYPE_LIST.map((t) => <option key={t} value={t}>{TYPE_JA[t]}</option>)}
          </select>
        </div>
        <SearchSelect placeholder="技を選択（★=タイプ一致）" options={moveOptions} value={atkBuild.moveId}
          onChange={(k) => updateBuild(atkIdx, (b) => ({ ...b, moveId: k }))} />
        {move && (
          <div className="meta"><span className="badge" style={{ background: TYPE_COLOR[move.type] }}>{TYPE_JA[move.type]}</span>
            <span>{move.category === 'physical' ? '物理' : '特殊'} / 威力{move.power}{move.isContact ? ' / 接触' : ''}</span></div>
        )}
        <button className="bulkbtn" disabled={!atk || !def} onClick={() => setBulkOpen((v) => !v)}>
          {bulkOpen ? '一覧を閉じる' : '⚡ 全技を一括計算'}
        </button>
        {bulkOpen && bulk && (
          <div className="bulk">
            {bulk.map(({ m, r }) => (
              <button key={m.moveId} className={`bulk-row ${m.moveId === atkBuild.moveId ? 'on' : ''}`}
                onClick={() => updateBuild(atkIdx, (b) => ({ ...b, moveId: m.moveId }))}>
                <span className="bulk-name"><span className="dot" style={{ background: TYPE_COLOR[m.type] }} />{m.name}</span>
                <span className="bulk-num">{r.isImmune ? '—' : `${r.maxPercent}%`}</span>
                <span className="bulk-ko">{r.isImmune ? '無効' : r.ko.label}</span>
              </button>
            ))}
            {filteredMoves.length > 60 && <div className="bulk-note">ダメージ上位60件のみ表示（フィルタで絞り込めます）</div>}
          </div>
        )}
      </section>

      <div className="swapbar"><button className="swap" onClick={() => setSwapped((s) => !s)}>⇅ 攻守入替</button></div>

      {renderDefender()}

      <section className="card">
        <label className="lbl">場の状態</label>
        <div className="field">
          <div className="rankrow"><span>天候</span>
            <select className="sel sel-sm" value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
              <option value="none">なし</option><option value="sun">晴</option><option value="rain">雨</option><option value="sand">砂</option><option value="snow">雪</option>
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
        {result && primary && secondary && (
          <>
            <div className="eff">{effectivenessLabel(result.eff)}{crit ? '・急所' : ''}</div>
            <div className={`ko ${primary.isImmune ? 'ko-immune' : ''}`}>{primary.isImmune ? 'ダメージなし' : primary.ko.label}</div>
            {!primary.isImmune && (
              <>
                <div className="dmg"><span className="dmg-num">{primary.minDamage}〜{primary.maxDamage}</span><span className="dmg-unit">ダメージ</span></div>
                <div className="pct">{primary.minPercent}% 〜 {primary.maxPercent}%</div>
                <div className="sub">{secondaryLabel}: {secondary.isImmune ? 'ダメージなし' : `${secondary.ko.label} / ${secondary.minDamage}〜${secondary.maxDamage}`}</div>
                <button className="rolls-toggle" onClick={() => setShowRolls((v) => !v)}>{showRolls ? '16通りを隠す' : '16通りの内訳'}</button>
                {showRolls && <div className="rolls">{primary.rolls.join(', ')}</div>}
              </>
            )}
          </>
        )}
      </section>

      {result && primary && !primary.isImmune && (
        <section className="card">
          <label className="lbl">耐久調整（逆算）</label>
          <button className="bulkbtn" onClick={() => setSurvOpen((v) => !v)}>
            {survOpen ? '閉じる' : `🛡 この攻撃を確定耐えするSPを逆算${crit ? '（急所込み）' : ''}`}
          </button>
          {survOpen && surv && (
            <div className="surv">
              {surv.already && <div className="surv-ok">✓ 現在の振りで既に確定耐えしています</div>}
              {!surv.already && !surv.possible && (
                <div className="surv-ng">HP32 / {defLabel}32 のフル投資でも確定耐えできません（最大被ダメ {surv.fullInvestMaxPercent}%）</div>
              )}
              {!surv.already && surv.possible && (
                <>
                  {surv.candidates.map((c) => (
                    <div key={`${c.hpSp}-${c.defSp}`} className="surv-row">
                      <span className="surv-spec">HP {c.hpSp} / {defLabel} {c.defSp}
                        <span className="surv-real">実数値 {c.hp}-{c.defStat}</span></span>
                      <span className="surv-pct">最大 {c.maxPercent}%</span>
                      <button className="surv-apply"
                        onClick={() => updateBuild(defIdx, (b) => ({ ...b, sp: { ...b.sp, hp: c.hpSp, [defKey]: c.defSp } }))}>適用</button>
                    </div>
                  ))}
                  <div className="surv-note">合計SPが最小になる配分（同合計の候補は最大3件表示）</div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <footer className="ftr">計算: エンジン calcDamage / データ: PChamp DB</footer>
    </div>
  );
}
