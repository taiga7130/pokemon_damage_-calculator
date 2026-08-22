// ============================================================
// 構築の保存/呼出バー: 各ポケモンカード内に置く。
// 保存 → 現在の Build を名前を付けて localStorage へ。
// 呼出 → 一覧パネルを開き、タップでそのカード側へ読み込み。
// ============================================================
import { useState } from 'react';
import { listPresets, savePreset, deletePreset, sanitizeBuild, type Preset, type StoredBuild } from './presets';

interface Props {
  /** 保存名の既定値（選択中ポケモン名）。未選択なら保存不可 */
  formName: string | null;
  build: StoredBuild;
  onLoad: (b: StoredBuild) => void;
}

export function PresetBar({ formName, build, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(() => listPresets());
  const [savedFlash, setSavedFlash] = useState(false);

  const refresh = () => setPresets(listPresets());

  const handleSave = () => {
    if (!formName) return;
    const label = window.prompt('構築名を入力', formName);
    if (label == null) return; // キャンセル
    setPresets(savePreset(label, build));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleLoad = (p: Preset) => {
    onLoad(sanitizeBuild(p.build));
    setOpen(false);
  };

  const handleDelete = (p: Preset) => {
    if (window.confirm(`「${p.label}」を削除しますか？`)) setPresets(deletePreset(p.id));
  };

  const fmtDate = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="pbar-wrap">
      <div className="pbar">
        <button className="pbtn" disabled={!formName} onClick={handleSave}>
          {savedFlash ? '保存しました ✓' : '★ 構築を保存'}
        </button>
        <button
          className="pbtn"
          onClick={() => {
            refresh();
            setOpen((v) => !v);
          }}
        >
          {open ? '閉じる' : `構築を呼び出す（${presets.length}）`}
        </button>
      </div>
      {open && (
        <div className="plist">
          {presets.length === 0 && <div className="plist-empty">保存された構築はまだありません</div>}
          {presets.map((p) => (
            <div key={p.id} className="plist-row">
              <button className="plist-load" onClick={() => handleLoad(p)}>
                <span className="plist-label">{p.label}</span>
                <span className="plist-date">{fmtDate(p.savedAt)}</span>
              </button>
              <button className="plist-del" onClick={() => handleDelete(p)} aria-label="削除">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
