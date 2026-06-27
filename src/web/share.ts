// ============================================================
// 設定の共有URL: 状態を URLハッシュに base64(JSON) でエンコード/デコード。
// 短く・状態が増えても破綻しないよう、短いキー＋インデックス参照で持つ。
// ============================================================

const b64encode = (s: string): string =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64decode = (s: string): string =>
  decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** 共有用の1ポケモン分（f=フォルムidx, m=技idx, sp=6, n=性格4, r=ランク4, a=特性JA, i=持ち物）。 */
export interface ShareBuild {
  f: number; m: number; sp: number[]; n: string[]; r: number[]; a: string; i: string;
}
export interface ShareState {
  v: 1;            // スキーマ版（将来の互換用）
  s: number;       // swapped
  w: string;       // weather
  l: number; c: number; b: number; // wall / crit / burn
  p: [ShareBuild, ShareBuild];
}

export function encodeShare(st: ShareState): string {
  return b64encode(JSON.stringify(st));
}

export function decodeShare(hash: string): ShareState | null {
  try {
    const obj = JSON.parse(b64decode(hash));
    if (obj && obj.v === 1 && Array.isArray(obj.p) && obj.p.length === 2) return obj as ShareState;
  } catch {
    /* 壊れたハッシュは無視 */
  }
  return null;
}
