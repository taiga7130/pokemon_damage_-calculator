// ============================================================
// 実データ（data/*.json）の整合性テスト
//   ポケモン: dexNo 重複なし / フォルム名 重複なし / BST 合計一致 / タイプ・種族値レンジ
//   技      : moveId 重複なし / 分類とタイプ / 技フラグの型
//   M-C 反映: 追加ポケモン・新メガ・Zメガ特性・新技・分類変更
// ============================================================
import { describe, it, expect } from 'vitest';
import pokemonData from '../data/pokemon_data.json';
import moveData from '../data/move_data.json';
import { ALL_TYPES } from '../src/typeChart';
import { JA_TO_ABILITY } from '../src/web/registry';

interface RawForm { formName: string; formType: string; types: string[]; abilities: string[] | null; baseStats: Record<string, number>; bst: number }
interface RawPokemon { dexNo: number; name: string; forms: RawForm[] }
interface RawMove { moveId: string; name: string; type: string; category: string; power: number | null; accuracy: number | null; contact: boolean | null; flags?: Record<string, boolean> }

const POKE = pokemonData as RawPokemon[];
const MOVES = moveData as RawMove[];
const VALID_FLAGS = new Set(['punch', 'sound', 'slicing', 'recoil', 'hasSecondary', 'grassyHalved']);
const find = (dex: number, form: string) => POKE.find((p) => p.dexNo === dex)?.forms.find((f) => f.formName === form);

describe('pokemon_data.json 整合性', () => {
  it('dexNo とフォルム名に重複がない', () => {
    const dex = POKE.map((p) => p.dexNo);
    expect(new Set(dex).size).toBe(dex.length);
    for (const p of POKE) {
      const names = p.forms.map((f) => f.formName);
      expect(new Set(names).size, `${p.name} のフォルム名重複`).toBe(names.length);
      expect(p.forms.filter((f) => f.formType === 'base').length, `${p.name} の base フォルム数`).toBe(1);
      expect(p.forms.find((f) => f.formType === 'base')?.formName).toBe(p.name);
    }
  });
  it('BST 合計・タイプ・種族値レンジ・特性が妥当', () => {
    for (const p of POKE) {
      for (const f of p.forms) {
        const sum = Object.values(f.baseStats).reduce((a, b) => a + b, 0);
        expect(sum, `${f.formName} BST`).toBe(f.bst);
        expect(f.types.length).toBeGreaterThanOrEqual(1);
        for (const t of f.types) expect(ALL_TYPES).toContain(t);
        for (const v of Object.values(f.baseStats)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(255); }
        expect(f.abilities === null || Array.isArray(f.abilities)).toBe(true);
      }
    }
  });
  it('dexNo 昇順で並んでいる', () => {
    for (let i = 1; i < POKE.length; i++) expect(POKE[i].dexNo).toBeGreaterThan(POKE[i - 1].dexNo);
  });
});

describe('move_data.json 整合性', () => {
  it('moveId に重複がなく、分類・タイプ・フラグが妥当', () => {
    const ids = MOVES.map((m) => m.moveId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MOVES) {
      expect(['physical', 'special', 'status']).toContain(m.category);
      expect(ALL_TYPES).toContain(m.type);
      if (m.category === 'status') expect(m.power).toBeNull();
      for (const [k, v] of Object.entries(m.flags ?? {})) {
        expect(VALID_FLAGS.has(k), `${m.moveId} の未知フラグ ${k}`).toBe(true);
        expect(v).toBe(true);
      }
    }
  });
  it('技フラグが主要技に付与されている（てつのこぶし/すてみ/ちからずく/きれあじ/パンクロック用）', () => {
    const by = Object.fromEntries(MOVES.map((m) => [m.moveId, m]));
    expect(by['thunder-punch'].flags?.punch).toBe(true);
    expect(by['brave-bird'].flags?.recoil).toBe(true);
    expect(by['high-jump-kick'].flags?.recoil).toBe(true);
    expect(by['sludge-bomb'].flags?.hasSecondary).toBe(true);
    expect(by['hyper-voice'].flags?.sound).toBe(true);
    expect(by['leaf-blade'].flags?.slicing).toBe(true);
    expect(by['earthquake'].flags).toEqual({ grassyHalved: true }); // 追加効果なし・グラスフィールドで半減
    expect(by['bulldoze'].flags?.grassyHalved).toBe(true);
    expect(MOVES.some((m) => Object.keys(m.flags ?? {}).length === 0)).toBe(true);
  });
});

describe('レギュレーション M-C の反映', () => {
  it('追加ポケモン（23種・フォルム含め 26体）が収録されている', () => {
    const expected: [number, string][] = [
      [40, 'プクリン'], [53, 'ペルシアン'], [53, 'ペルシアン(アローラのすがた)'], [83, 'カモネギ'], [122, 'バリヤード'],
      [317, 'マルノーム'], [373, 'ボーマンダ'], [673, 'ゴーゴート'], [768, 'グソクムシャ'], [812, 'ゴリランダー'],
      [815, 'エースバーン'], [818, 'インテレオン'], [828, 'フォクスライ'], [849, 'ストリンダー'], [849, 'ストリンダー(ローなすがた)'],
      [853, 'オトスパス'], [863, 'ニャイキング'], [865, 'ネギガナイト'], [871, 'バチンウニ'], [876, 'イエッサン'],
      [876, 'イエッサン(メスのすがた)'], [923, 'パーモット'], [930, 'オリーヴァ'], [931, 'イキリンコ'], [943, 'マフィティフ'], [998, 'セグレイブ'],
    ];
    for (const [dex, name] of expected) expect(find(dex, name), `${dex}:${name}`).toBeDefined();
    expect(find(998, 'セグレイブ')?.baseStats).toEqual({ hp: 115, atk: 145, def: 92, spa: 75, spd: 86, spe: 87 });
    expect(find(53, 'ペルシアン(アローラのすがた)')?.abilities).toEqual(['ファーコート', 'テクニシャン', 'びびり']);
  });
  it('新メガ 3体とメガシンカZ 3体の特性が入っている', () => {
    expect(find(373, 'メガボーマンダ')?.abilities).toEqual(['スカイスキン']);
    expect(find(373, 'メガボーマンダ')?.bst).toBe(700);
    expect(find(768, 'メガグソクムシャ')?.types).toEqual(['bug', 'steel']);
    expect(find(768, 'メガグソクムシャ')?.abilities).toEqual(['かたいツメ']);
    expect(find(998, 'メガセグレイブ')?.baseStats.atk).toBe(175);
    expect(find(359, 'メガアブソルZ')?.abilities).toEqual(['きれあじ']);
    expect(find(445, 'メガガブリアスZ')?.abilities).toEqual(['ふゆう']);
    expect(find(448, 'メガルカリオZ')?.abilities).toEqual(['はどうのぼうご']);
  });
  it('新メガ・Zメガの特性はすべてエンジン実装済み（UIで計算に反映される）', () => {
    for (const ja of ['スカイスキン', 'かたいツメ', 'ねつこうかん', 'きれあじ', 'ふゆう', 'はどうのぼうご', 'ファーコート', 'パンクロック', 'はがねのせいしん']) {
      if (ja === 'ねつこうかん') continue; // やけど無効のみ（ダメージ補正なし）
      expect(JA_TO_ABILITY[ja], ja).toBeDefined();
    }
  });
  it('新技（きりさく80/ねらいうち85/スターアサルト170）と でんこうそうげき のパンチ分類', () => {
    const by = Object.fromEntries(MOVES.map((m) => [m.moveId, m]));
    expect(by['slash']).toMatchObject({ name: 'きりさく', type: 'normal', category: 'physical', power: 80, contact: true, flags: { slicing: true } });
    expect(by['snipe-shot']).toMatchObject({ name: 'ねらいうち', type: 'water', category: 'special', power: 85 });
    expect(by['star-assault']).toMatchObject({ name: 'スターアサルト', type: 'fighting', category: 'physical', power: 170 });
    expect(by['double-shock'].flags?.punch).toBe(true);
  });
});
