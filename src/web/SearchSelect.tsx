import { useMemo, useState } from 'react';

export interface Option {
  key: string;
  label: string;
  sub?: React.ReactNode; // タイプバッジ等
}

interface Props {
  placeholder: string;
  options: Option[];
  value: string | null;
  onChange: (key: string) => void;
}

/** モバイル向けの検索付きセレクタ。タップ→検索→候補タップで確定。 */
export function SearchSelect({ placeholder, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = options.find((o) => o.key === value) ?? null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
    return base.slice(0, 60);
  }, [q, options]);

  if (!open) {
    return (
      <button className="ss-trigger" onClick={() => { setOpen(true); setQ(''); }}>
        {selected ? (
          <span className="ss-selected">{selected.label}{selected.sub}</span>
        ) : (
          <span className="ss-placeholder">{placeholder}</span>
        )}
        <span className="ss-caret">▾</span>
      </button>
    );
  }

  return (
    <div className="ss-panel">
      <input
        className="ss-input"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`${placeholder}を検索…`}
      />
      <div className="ss-list">
        {filtered.map((o) => (
          <button
            key={o.key}
            className={`ss-opt ${o.key === value ? 'is-sel' : ''}`}
            onClick={() => { onChange(o.key); setOpen(false); }}
          >
            <span>{o.label}</span>
            {o.sub}
          </button>
        ))}
        {filtered.length === 0 && <div className="ss-empty">該当なし</div>}
      </div>
      <button className="ss-close" onClick={() => setOpen(false)}>閉じる</button>
    </div>
  );
}
