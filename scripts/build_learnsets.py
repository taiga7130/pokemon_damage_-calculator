#!/usr/bin/env python3
"""
data/learnsets.json（ポケモンごとに覚える技一覧）を生成する。

正典ソース: PChamp DB 個別ページ https://app.gamepedia.jp/pokemon-champions/pokemon/{dexNo}?lang=ja
  - ページ内に「覚える技」セクションが2箇所ある:
      1) <div class="cm-group">...</div> ＝ トップ寄りに出る「使用率上位の技」抜粋（件数は全体の一部）。
         これは習得技の全量ではないため使わない。
      2) <h2 class="section-title">覚える技 (N)</h2> の直後にある
         <table class="detail-table move-table"> ＝ <td class="mv-name"><a href="/pokemon-champions/moves/{moveId}?lang=ja">
         これが N件そろった「覚える技」の全量。本スクリプトはこちらだけを採用する。
  - フォルム別に技が分かれているかはページごとに確認した（ガブリアス dexNo445・ロトム dexNo479・
    アーボック dexNo24（単一フォルム）で確認）。いずれも「覚える技 (N)」セクションは1つしか無く、
    メガ/リージョン/その他フォルムを含む同一 dexNo 全フォルムで共通の技表として掲載されている。
    → 本スクリプトは dexNo 単位で1回だけ取得し、同 dexNo の全フォルムに同じ技リストを割り当てる。

PChamp DB 未収録（2026-09-21 時点で M-A までしか更新されておらず、M-B/M-C 追加分が中心）:
  - 個別ページが存在しない（404） … カモネギ(83) バリヤード(122) クチート(303) ムシャーナ(518)
    ペンドラー(545) バルジーナ(689) グソクムシャ(768) フォクスライ(828) オトスパス(853) ネギガナイト(865) など
  - ページはあるが「覚える技 (0)」 … プクリン(40) ラフレシア(45) ペルシアン(53) ジュカイン(254) 等
    M-B/M-C 追加分の大半、および理由不明で ミルホッグ(505) の計46 dexNo（76フォルム）。
  これらは Game8 と GameWith の両方から個別に習得技を取得し、一致した技のみ採用する
  （片方にしか無い技は data/learnsets_disputed.json に出して不採用。捏造・推測はしない）。

  Game8: https://game8.jp/api/tool_structural_mappings/390.json?options={"name":"<キャラクター名>"}
    - ページ https://game8.jp/pokemon-champions/{id}（〇〇の弱点と種族値・特性）の
      「覚える技」セクションは React (data-react-props) 描画で、実体はこの API から601キャラクター分を
      一括取得している（name オプションはクライアント側フィルタ用でサーバは無視し全件返す）。
      Referer ヘッダ必須（無いと403）。character.move.baseMoveArraySchema.baseMove[].name が技名。
      levelMove/technicalMachineMove/eggMove は本タイトルでは常に空。
    - フォルムは character 単位（例: "ペルシアン" と "アローラペルシアン" は別キャラクター）。

  GameWith: https://gamewith.jp/pokemon-champions/546414（ポケモン一覧）
    - ページ埋め込みの検索用JSオブジェクト（各ポケモン: n:'名前', mvs:'技ID,技ID,...'）に、
      その場で人間可読な技名テーブルが無い技ID配列が入っている。
    - 技ID→技名は https://gamewith.jp/pokemon-champions/546417（技一覧）の
      <li data-id="ID" data-name="技名" ...> から対応表を作れる（510技分）。
    - 個別ポケモンページの「覚える技」セクション自体はJS描画で静的取得できないため、
      一覧ページの mvs 配列 + 技一覧ページの id/name 対応表を使う。

  両ソースの検証: ガブリアス(既にPChampで93件判明)を GameWith の mvs でデコードしたところ
  59件中58件がPChampの93件に含まれ(1件のみ差異=あばれる)、ジュカインは Game8/GameWith 双方とも
  78件で完全一致した。両ソースとも信頼できる抽出方法と判断した。

  フォルム名の表記ゆれ（当データセットの formName ↔ 各サイトの表記）は FORM_NAME_OVERRIDES で
  明示的に対応付ける（性別/色違いフォルムで技構成が同一とみなした箇所はコメントに明記）。

出力:
  data/learnsets.json          {"<dexNo>:<formName>": ["moveId", ...] | null}  393フォルム全キー
  data/learnsets_meta.json     {"<dexNo>:<formName>": "pchamp" | "game8+gamewith" | null}
  data/learnsets_disputed.json 取得はできたが Game8/GameWith で不一致だったため不採用にした技（フォルム別）
  data/learnsets_unmapped.json 技名を data/move_data.json の moveId に変換できなかったもの

使い方:
    python3 scripts/build_learnsets.py            # .cache_pchamp/ のキャッシュを使用（無ければ取得）
"""
import json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache_pchamp")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

PCHAMP_MOVE_RE = re.compile(
    r'<td class="mv-name">\s*<a href="/pokemon-champions/moves/([a-z0-9-]+)\?lang=ja">'
)
PCHAMP_SECTION_HEADER_RE = re.compile(r'覚える技 \((\d+)\)</h2>')
SECTION_TITLE_RE = re.compile(r'<h2 class="section-title">')

GW_LIST_URL = "https://gamewith.jp/pokemon-champions/546414"
GW_MOVES_URL = "https://gamewith.jp/pokemon-champions/546417"
GAME8_API_URL = "https://game8.jp/api/tool_structural_mappings/390.json?updatedAt=1&options=%7B%7D"
GAME8_REFERER = "https://game8.jp/pokemon-champions/792977"

# PChamp DB に個別ページが無い/覚える技0件の dexNo（M-A時点で未収録。build_pchamp_learnsets() で確定した46件と一致）
FALLBACK_DEXNOS = {
    40, 45, 53, 83, 122, 211, 254, 257, 260, 303, 317, 373, 376, 398, 505, 518, 545, 560,
    604, 668, 673, 687, 689, 691, 768, 812, 815, 818, 828, 849, 853, 861, 863, 865, 870,
    871, 876, 904, 923, 930, 931, 943, 972, 979, 998, 1000,
}

# formName（本データセット）→ (Game8 character名, GameWith n名) の明示対応（表記ゆれのみ）。
# 未掲載の formName は「そのまま」または「半角()→全角（）」で両サイトとも一致する。
FORM_NAME_OVERRIDES = {
    (53, "ペルシアン(アローラのすがた)"): ("アローラペルシアン", "アローラペルシアン"),
    # カエンジシ(通常)は本データセットでは性別フォルムを分けていない。
    # Game8はベース"カエンジシ"がそのまま存在。GameWithはベース単体が無いためオスのすがた
    # を代表として採用する（Pyroarは性別で技構成が変わらないため代表化して問題ない）。
    (668, "カエンジシ"): ("カエンジシ", "カエンジシ(オスのすがた)"),
    # ストリンダー: 本データセットの base=ハイなすがた（add_mc_pokemon.pyのコメントに明記）。
    (849, "ストリンダー"): ("ストリンダー（ハイなすがた）", "ストリンダー(ハイ)"),
    (849, "ストリンダー(ローなすがた)"): ("ストリンダー（ローなすがた）", "ストリンダー(ロー)"),
    (876, "イエッサン"): ("イエッサン（オスのすがた）", "イエッサン(オス)"),
    (876, "イエッサン(メスのすがた)"): ("イエッサン（メスのすがた）", "イエッサン(メス)"),
    # イキリンコ: Game8は色違いフォルムを別キャラクターとして持たず、ベース"イキリンコ"のみ
    # （色フォルムは技構成が同一のため代表流用）。GameWithはベースが無くグリーンフェザーが規定色。
    (931, "イキリンコ"): ("イキリンコ", "イキリンコ(グリーンフェザー)"),
    (931, "イキリンコ(ブルーフェザー)"): ("イキリンコ", "イキリンコ(ブルーフェザー)"),
    (931, "イキリンコ(イエローフェザー)"): ("イキリンコ", "イキリンコ(イエローフェザー)"),
    (931, "イキリンコ(ホワイトフェザー)"): ("イキリンコ", "イキリンコ(ホワイトフェザー)"),
}


def fetch(url, referer=None):
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def load_pokemon_data():
    with open(os.path.join(DATA, "pokemon_data.json"), encoding="utf-8") as f:
        return json.load(f)


def load_move_data():
    with open(os.path.join(DATA, "move_data.json"), encoding="utf-8") as f:
        return json.load(f)


_FW_DIGITS = str.maketrans("0123456789", "０１２３４５６７８９")


def norm_move_name(n):
    """技名の全角/半角数字ゆれを吸収する（move_data.jsonは１０まんボルト等を全角数字で保持）。"""
    return n.translate(_FW_DIGITS)


# ---------- 1) PChamp DB ----------
def fetch_pchamp_cache(dexnos):
    os.makedirs(CACHE, exist_ok=True)
    for i, dex in enumerate(dexnos):
        path = os.path.join(CACHE, f"{dex}.html")
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            continue
        url = f"https://app.gamepedia.jp/pokemon-champions/pokemon/{dex}?lang=ja"
        try:
            html = fetch(url)
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"[pchamp {i+1}/{len(dexnos)}] OK {dex}", file=sys.stderr)
        except Exception as e:
            print(f"[pchamp {i+1}/{len(dexnos)}] FAIL {dex}: {e}", file=sys.stderr)
        time.sleep(0.4)


def parse_pchamp_learnset(dex):
    """dexNo の PChamp 個別ページから覚える技(全量テーブル)のmoveIdリストを返す。取得不可/0件はNone。"""
    path = os.path.join(CACHE, f"{dex}.html")
    if not os.path.exists(path):
        return None
    html = open(path, encoding="utf-8").read()
    m = PCHAMP_SECTION_HEADER_RE.search(html)
    if not m or int(m.group(1)) == 0:
        return None
    start = m.end()
    nxt = SECTION_TITLE_RE.search(html, start)
    section = html[start: nxt.start() if nxt else len(html)]
    ids = PCHAMP_MOVE_RE.findall(section)
    if not ids or len(ids) != int(m.group(1)):
        print(f"警告: dexNo {dex} 技件数不一致 header={m.group(1)} parsed={len(ids)}", file=sys.stderr)
    return sorted(set(ids))


# ---------- 2) GameWith ----------
def fetch_gamewith():
    list_path = os.path.join(CACHE, "_gw_list.html")
    moves_path = os.path.join(CACHE, "_gw_moves.html")
    if not os.path.exists(list_path):
        open(list_path, "w", encoding="utf-8").write(fetch(GW_LIST_URL))
    if not os.path.exists(moves_path):
        open(moves_path, "w", encoding="utf-8").write(fetch(GW_MOVES_URL))
    return open(list_path, encoding="utf-8").read(), open(moves_path, encoding="utf-8").read()


def build_gamewith_index():
    list_html, moves_html = fetch_gamewith()
    idmap = {}
    for i, n in re.findall(r'data-id="(\d+)" data-name="([^"]+)"', moves_html):
        idmap.setdefault(i, n)
    pattern = re.compile(
        r"n:'([^']*)'.{0,15}?i:'[^']*'.{0,15}?i2:'[^']*'.{0,10}?t1:'[^']*'.{0,10}?t2:'[^']*'.{0,10}?mvs:'([0-9,]*)'"
    )
    by_name = {}
    for name, mvs in pattern.findall(list_html):
        ids = [x for x in mvs.split(",") if x]
        names = [idmap[i] for i in ids if i in idmap]
        by_name.setdefault(name, set(names))
    return by_name


# ---------- 3) Game8 ----------
def fetch_game8_api():
    path = os.path.join(CACHE, "_game8_moves.json")
    if not os.path.exists(path):
        raw = fetch(GAME8_API_URL, referer=GAME8_REFERER)
        open(path, "w", encoding="utf-8").write(raw)
    return json.loads(open(path, encoding="utf-8").read())


def build_game8_index():
    data = fetch_game8_api()
    chars = data["characterArraySchema"]["characters"]
    by_name = {}
    for c in chars:
        bm = c.get("move", {}).get("baseMoveArraySchema", {}).get("baseMove", [])
        names = {m["name"] for m in bm if m.get("name")}
        if names:
            by_name.setdefault(c["name"], names)
    return by_name


def candidates_for(dex, form_name):
    if (dex, form_name) in FORM_NAME_OVERRIDES:
        g8, gw = FORM_NAME_OVERRIDES[(dex, form_name)]
        return g8, gw
    fw = form_name.replace("(", "（").replace(")", "）")
    return form_name, form_name  # game8はfw必要な場合があるので呼び出し側で両方試す


def main():
    pdata = load_pokemon_data()
    mdata = load_move_data()
    name_to_id = {}
    for m in mdata:
        name_to_id.setdefault(m["name"], m["moveId"])
        name_to_id.setdefault(norm_move_name(m["name"]), m["moveId"])
    valid_ids = {m["moveId"] for m in mdata}

    all_dexnos = sorted({p["dexNo"] for p in pdata})
    fetch_pchamp_cache(all_dexnos)

    gw_index = build_gamewith_index()
    g8_index = build_game8_index()

    learnsets = {}
    meta = {}
    disputed = {}
    unmapped = {}

    pchamp_forms = 0
    fallback_forms = 0
    null_forms = 0

    for p in pdata:
        dex = p["dexNo"]
        pchamp_ids = None
        if dex not in FALLBACK_DEXNOS:
            pchamp_ids = parse_pchamp_learnset(dex)

        base_fallback_ids = None  # 直前に確定した base フォルムの技（同dexNoのメガ用に使い回す）
        for f in p["forms"]:
            key = f"{dex}:{f['formName']}"
            if pchamp_ids is not None:
                bad = [i for i in pchamp_ids if i not in valid_ids]
                if bad:
                    # PChamp個別ページの技テーブルには data/move_data.json（技一覧ページ由来・515件）に
                    # 存在しない moveId が混じることがある（confide/return/frustration/hidden-power/
                    # tera-blast等、技一覧ページには収録されていない過去作技や未実装技）。
                    # 捏造はせず、move_data.jsonに無いものは採用せず本ファイルに記録する。
                    unmapped[key] = sorted(bad)
                    print(f"警告: {key} 未知のmoveId {bad}", file=sys.stderr)
                learnsets[key] = [i for i in pchamp_ids if i in valid_ids]
                meta[key] = "pchamp"
                pchamp_forms += 1
                continue

            # メガシンカは全ポケモン共通の仕様として base フォルムと技構成が同一
            # （Game8のAPIでも「メガXXX」キャラクターは baseMove が空で、base側のみに技が入る）。
            # 既に base フォルムの技が確定していれば、個別照合はせずそれをそのまま使う。
            if f["formType"] == "mega" and base_fallback_ids is not None:
                learnsets[key] = base_fallback_ids
                meta[key] = meta[f"{dex}:{p['forms'][0]['formName']}"]
                fallback_forms += 1
                continue

            # フォールバック: Game8 + GameWith
            g8_cand, gw_cand = candidates_for(dex, f["formName"])
            fw = f["formName"].replace("(", "（").replace(")", "）")
            g8_names = g8_index.get(g8_cand) or g8_index.get(f["formName"]) or g8_index.get(fw)
            gw_names = gw_index.get(gw_cand) or gw_index.get(f["formName"])

            if not g8_names or not gw_names:
                learnsets[key] = None
                meta[key] = None
                null_forms += 1
                missing_src = []
                if not g8_names:
                    missing_src.append("game8")
                if not gw_names:
                    missing_src.append("gamewith")
                print(f"未取得: {key} ({'・'.join(missing_src)} に該当キャラなし)", file=sys.stderr)
                continue

            agreed = g8_names & gw_names
            only_g8 = g8_names - gw_names
            only_gw = gw_names - g8_names
            if only_g8 or only_gw:
                disputed[key] = {"game8_only": sorted(only_g8), "gamewith_only": sorted(only_gw)}

            ids = []
            for n in sorted(agreed):
                mid = name_to_id.get(n) or name_to_id.get(norm_move_name(n))
                if mid is None:
                    unmapped.setdefault(key, []).append(n)
                else:
                    ids.append(mid)
            ids = sorted(set(ids))
            learnsets[key] = ids
            meta[key] = "game8+gamewith"
            fallback_forms += 1
            if f["formType"] == "base":
                base_fallback_ids = ids

    with open(os.path.join(DATA, "learnsets.json"), "w", encoding="utf-8") as f:
        json.dump(learnsets, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    with open(os.path.join(DATA, "learnsets_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    with open(os.path.join(DATA, "learnsets_disputed.json"), "w", encoding="utf-8") as f:
        json.dump(disputed, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    with open(os.path.join(DATA, "learnsets_unmapped.json"), "w", encoding="utf-8") as f:
        json.dump(unmapped, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")

    print(f"総フォルム数: {len(learnsets)}", file=sys.stderr)
    print(f"  pchamp: {pchamp_forms}", file=sys.stderr)
    print(f"  game8+gamewith: {fallback_forms}", file=sys.stderr)
    print(f"  null(未取得): {null_forms}", file=sys.stderr)
    print(f"disputed件数: {len(disputed)}", file=sys.stderr)
    print(f"unmapped件数: {len(unmapped)}", file=sys.stderr)


if __name__ == "__main__":
    main()
