import { useMemo, useState } from 'react';
import { calcDamage } from '../index';
import type { PokemonType } from '../types';
import { FORMS, MOVES, toState, toMove, TYPE_JA, TYPE_COLOR, type FormEntry, type MoveEntry } from './adapter';
import { SearchSelect, type Option } from './SearchSelect';

function TypeBadges({ types }: { types: PokemonType[] }) {
  return (
    <span className="badges">
      {types.map((t) => (
        <span key={t} className="badge" style={{ background: TYPE_COLOR[t] }}>{TYPE_JA[t]}</span>
      ))}
    </span>
  );
}

// 選択肢（メモ化のためモジュール外で生成しても良いが、件数が少ないので即時生成）
const pokemonOptions: Option[] = FORMS.map((f) => ({
  key: f.key,
  label: f.formName,
  sub: <TypeBadges types={f.types} />,
}));
const moveOptions: Option[] = MOVES.map((m) => ({
  key: m.moveId,
  label: `${m.name}（威力${m.power}）`,
  sub: <span className="badge" style={{ background: TYPE_COLOR[m.type] }}>{m.category === 'physical' ? '物理' : '特殊'}</span>,
}));

export default function App() {
  const [atkKey, setAtkKey] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [defKey, setDefKey] = useState<string | null>(null);
  const [showRolls, setShowRolls] = useState(false);

  const atk = useMemo<FormEntry | null>(() => FORMS.find((f) => f.key === atkKey) ?? null, [atkKey]);
  const def = useMemo<FormEntry | null>(() => FORMS.find((f) => f.key === defKey) ?? null, [defKey]);
  const move = useMemo<MoveEntry | null>(() => MOVES.find((m) => m.moveId === moveId) ?? null, [moveId]);

  const result = useMemo(() => {
    if (!atk || !def || !move) return null;
    return calcDamage(toState(atk), toState(def), toMove(move));
  }, [atk, def, move]);

  return (
    <div className="app">
      <header className="hdr">
        <h1>ダメージ計算機</h1>
        <span className="hdr-sub">Lv50 / 6V 固定・補正なし（フェーズ1）</span>
      </header>

      <section className="card">
        <label className="lbl">攻撃側</label>
        <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={atkKey} onChange={setAtkKey} />
        {atk && (
          <div className="meta">
            <TypeBadges types={atk.types} />
            <span className="stats">
              H{atk.baseStats.hp} A{atk.baseStats.atk} B{atk.baseStats.def} C{atk.baseStats.spa} D{atk.baseStats.spd} S{atk.baseStats.spe}
            </span>
          </div>
        )}
      </section>

      <section className="card">
        <label className="lbl">技</label>
        <SearchSelect placeholder="技を選択" options={moveOptions} value={moveId} onChange={setMoveId} />
        {move && (
          <div className="meta">
            <span className="badge" style={{ background: TYPE_COLOR[move.type] }}>{TYPE_JA[move.type]}</span>
            <span>{move.category === 'physical' ? '物理' : '特殊'} / 威力{move.power}</span>
          </div>
        )}
      </section>

      <section className="card">
        <label className="lbl">防御側</label>
        <SearchSelect placeholder="ポケモンを選択" options={pokemonOptions} value={defKey} onChange={setDefKey} />
        {def && (
          <div className="meta">
            <TypeBadges types={def.types} />
            <span className="stats">
              H{def.baseStats.hp} A{def.baseStats.atk} B{def.baseStats.def} C{def.baseStats.spa} D{def.baseStats.spd} S{def.baseStats.spe}
            </span>
          </div>
        )}
      </section>

      <section className={`result ${result ? '' : 'is-empty'}`}>
        {!result && <div className="result-hint">攻撃側・技・防御側を選ぶと確定数が出ます</div>}
        {result && (
          <>
            <div className={`ko ${result.isImmune ? 'ko-immune' : ''}`}>
              {result.isImmune ? '効果なし（無効）' : result.ko.label}
            </div>
            {!result.isImmune && (
              <>
                <div className="dmg">
                  <span className="dmg-num">{result.minDamage}〜{result.maxDamage}</span>
                  <span className="dmg-unit">ダメージ</span>
                </div>
                <div className="pct">{result.minPercent}% 〜 {result.maxPercent}%</div>
                <button className="rolls-toggle" onClick={() => setShowRolls((v) => !v)}>
                  {showRolls ? '16通りを隠す' : '16通りの内訳'}
                </button>
                {showRolls && (
                  <div className="rolls">{result.rolls.join(', ')}</div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <footer className="ftr">計算: エンジン calcDamage / データ: PChamp DB</footer>
    </div>
  );
}
