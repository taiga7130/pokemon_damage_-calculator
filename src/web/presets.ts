// ============================================================
// 構築（育成データ）の保存: localStorage に JSON で永続化。
// 共有URLと違い index 参照ではなく formKey / moveId の文字列で持ち、
// データ更新（ポケモン・技の追加）があっても壊れないようにする。
// ============================================================
import type { StatBlock } from '../types';
import { FORMS, MOVES } from './adapter';
import { ITEMS } from './registry';

type NatStat = 'atk' | 'spa' | 'def' | 'spd';
type NatureChoice = 'up' | 'neutral' | 'down';

/** App.tsx の Build と同形（循環 import を避けるためここで再定義）。 */
export interface StoredBuild {
  formKey: string | null;
  moveId: string | null;
  sp: StatBlock;
  nature: Record<NatStat, NatureChoice>;
  rank: Record<NatStat, number>;
  abilityJa: string;
  item: string;
}

export interface Preset {
  id: string;
  label: string;
  build: StoredBuild;
  savedAt: number; // epoch ms
}

const KEY = 'pchamp_presets_v1';

export function listPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(ps: Preset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ps));
  } catch {
    /* 容量超過・プライベートモード等は黙って無視（UIは戻り値のリストで再描画） */
  }
}

export function savePreset(label: string, build: StoredBuild): Preset[] {
  const ps = listPresets();
  const p: Preset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim() || '無題の構築',
    build,
    savedAt: Date.now(),
  };
  const next = [p, ...ps].slice(0, 50); // 上限50件（古いものから溢れる）
  write(next);
  return next;
}

export function deletePreset(id: string): Preset[] {
  const next = listPresets().filter((p) => p.id !== id);
  write(next);
  return next;
}

const clampSp = (n: unknown): number => Math.max(0, Math.min(32, Math.floor(Number(n) || 0)));
const clampRank = (n: unknown): number => Math.max(-6, Math.min(6, Math.floor(Number(n) || 0)));
const natOk = (v: unknown): NatureChoice => (v === 'up' || v === 'down' ? v : 'neutral');

/** 保存データを現行データセットに合わせて検証・補正して返す（壊れていても落ちない）。 */
export function sanitizeBuild(b: StoredBuild): StoredBuild {
  const formOk = b.formKey != null && FORMS.some((f) => f.key === b.formKey);
  const moveOk = b.moveId != null && MOVES.some((m) => m.moveId === b.moveId);
  const itemOk = ITEMS.some((i) => i.id === b.item);
  const sp = b.sp ?? ({} as StatBlock);
  const nature = b.nature ?? ({} as StoredBuild['nature']);
  const rank = b.rank ?? ({} as StoredBuild['rank']);
  return {
    formKey: formOk ? b.formKey : null,
    moveId: moveOk ? b.moveId : null,
    sp: { hp: clampSp(sp.hp), atk: clampSp(sp.atk), def: clampSp(sp.def), spa: clampSp(sp.spa), spd: clampSp(sp.spd), spe: clampSp(sp.spe) },
    nature: { atk: natOk(nature.atk), spa: natOk(nature.spa), def: natOk(nature.def), spd: natOk(nature.spd) },
    rank: { atk: clampRank(rank.atk), spa: clampRank(rank.spa), def: clampRank(rank.def), spd: clampRank(rank.spd) },
    abilityJa: typeof b.abilityJa === 'string' ? b.abilityJa : '',
    item: itemOk ? b.item : 'none',
  };
}
