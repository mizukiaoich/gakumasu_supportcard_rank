// サポートカードデータと Excel（.xlsx）の相互変換。
// 1行 = 1カード。効果1〜6・イベント効果1〜2を横に並べる。
import ExcelJS from 'exceljs';
import { PARAMETERS, EFFECT_SLOT_COUNT } from '../js/constants.js';
import { validateAll, buildCountSources, isFixedEffectType } from '../js/validator.js';

export const CARD_SHEET = 'カード一覧';
export const LIST_SHEET = 'リスト';
export const HELP_SHEET = '説明';
export const EVENT_SLOT_COUNT = 2;
const MAX_ROWS = 1000;

const BASE_COLUMNS = [
  { key: 'id', header: 'ID', width: 16 },
  { key: 'name', header: 'カード名', width: 30 },
  { key: 'rarity', header: 'レアリティ', width: 10 },
  { key: 'plan', header: 'プラン', width: 12 },
  { key: 'image', header: '画像パス', width: 24 },
  { key: 'is_sample', header: 'サンプル', width: 9 },
];
const EFFECT_FIELDS = [
  { key: 'type', label: '種類', width: 14 },
  { key: 'target', label: '対象', width: 7 },
  { key: 'max_count', label: '最大回数', width: 9 },
  { key: 'value', label: '値', width: 8 },
];

/** 列定義（見出し名で読み書きするので、Excel 側で列の順番を入れ替えても読み込める） */
export function columnDefs() {
  const cols = BASE_COLUMNS.map((c) => ({ ...c, group: 'base' }));
  for (let i = 1; i <= EVENT_SLOT_COUNT; i++) {
    for (const f of EFFECT_FIELDS) cols.push({ key: `event${i}_${f.key}`, header: `イベント${i} ${f.label}`, width: f.width, group: 'event', slot: i, field: f.key });
  }
  for (let i = 1; i <= EFFECT_SLOT_COUNT; i++) {
    for (const f of EFFECT_FIELDS) cols.push({ key: `effect${i}_${f.key}`, header: `効果${i} ${f.label}`, width: f.width, group: 'effect', slot: i, field: f.key });
  }
  return cols;
}

const colLetter = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/* ---------------- JSON → Excel ---------------- */

export function cardToRow(card) {
  const row = {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    plan: card.plan,
    image: card.image ?? '',
    is_sample: card.is_sample ? '○' : '',
  };
  const events = card.event_bonus ?? [];
  if (events.length > EVENT_SLOT_COUNT) {
    throw new Error(`カード ${card.id}: イベント効果が${events.length}件あります。Excel には${EVENT_SLOT_COUNT}件まで書けます`);
  }
  const put = (prefix, e) => {
    for (const f of EFFECT_FIELDS) {
      if (e[f.key] !== undefined && e[f.key] !== null) row[`${prefix}_${f.key}`] = e[f.key];
    }
  };
  events.forEach((e, i) => put(`event${i + 1}`, e));
  card.effects.forEach((e, i) => {
    if (!e.empty) put(`effect${i + 1}`, e);
  });
  return row;
}

/**
 * カードデータから Excel ブックを作る。
 * 「リスト」シートにプラン・対象・効果種類を置き、入力欄はプルダウンで選べるようにする。
 */
export function buildWorkbook({ plans, actionTypes, effectTypes, cards }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(CARD_SHEET, { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  const cols = columnDefs();
  ws.columns = cols.map((c) => ({ key: c.key, header: c.header, width: c.width }));

  const fills = { base: 'FFEAF3FF', event: 'FFFFF4D1', effect: ['FFFFE6F0', 'FFF1ECFF'] };
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(1).height = 32;
  cols.forEach((c, i) => {
    const color = c.group === 'effect' ? fills.effect[c.slot % 2] : fills[c.group];
    ws.getCell(1, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });

  for (const card of cards) ws.addRow(cardToRow(card));

  // プルダウン用のリスト
  const list = wb.addWorksheet(LIST_SHEET);
  const effectTypeNames = Object.keys(buildCountSources(actionTypes, effectTypes));
  const lists = [
    ['プラン', plans.map((p) => p.name)],
    ['対象', PARAMETERS],
    ['効果種類', effectTypeNames],
    ['サンプル', ['○']],
  ];
  const ranges = {};
  lists.forEach(([title, values], i) => {
    const col = colLetter(i + 1);
    list.getCell(`${col}1`).value = title;
    values.forEach((v, j) => { list.getCell(`${col}${j + 2}`).value = v; });
    ranges[title] = `${LIST_SHEET}!$${col}$2:$${col}$${values.length + 1}`;
  });
  list.state = 'hidden';

  const listRule = (range, title) => ws.dataValidations.add(range, {
    type: 'list', allowBlank: true, formulae: [ranges[title]],
    showErrorMessage: true, errorTitle: '入力エラー', error: `「${title}」の一覧から選んでください`,
  });
  const numberRule = (range, integer) => ws.dataValidations.add(range, {
    type: integer ? 'whole' : 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
    showErrorMessage: true, errorTitle: '入力エラー', error: integer ? '0以上の整数を入力してください' : '0以上の数値を入力してください',
  });
  cols.forEach((c, i) => {
    const range = `${colLetter(i + 1)}2:${colLetter(i + 1)}${MAX_ROWS}`;
    if (c.key === 'plan') listRule(range, 'プラン');
    if (c.key === 'is_sample') listRule(range, 'サンプル');
    if (c.field === 'target') listRule(range, '対象');
    if (c.field === 'type') listRule(range, '効果種類');
    if (c.field === 'max_count') numberRule(range, true);
    if (c.field === 'value') numberRule(range, false);
  });

  // 説明シート
  const help = wb.addWorksheet(HELP_SHEET);
  help.getColumn(1).width = 110;
  const fixed = effectTypes.filter((e) => e.fixed === true).map((e) => e.name);
  const counted = effectTypes.filter((e) => e.fixed !== true).map((e) => `${e.name}（${e.count_from}の回数）`);
  [
    'サポートカードデータ 入力シート',
    '',
    `・「${CARD_SHEET}」シートに 1行＝1カードで入力します。入力後に npm run cards:import で data/support_cards.json に変換します。`,
    '・ID は重複しない英数字にしてください（例: ssr_0001）。同順位のときの並び順にも使われます。',
    '・効果1〜効果6 は完凸時の効果です。使わないスロットは「種類・対象・最大回数・値」をすべて空欄にしてください（空スロット）。',
    '・今の計算式で表せない効果（パラメータ上昇量%アップ、条件付きの効果など）も空欄にしてください。',
    `・固定加算の効果: ${fixed.join(' / ') || 'なし'} … 行動回数に関係なく値を1回だけ加算します。最大回数は空欄にしてください。`,
    `・別の行動の回数で発動する効果: ${counted.join(' / ') || 'なし'}`,
    `・上記以外の効果種類は、同じ名前の行動回数（${actionTypes.map((a) => a.name).join(' / ')}）で発動します。`,
    `・イベント効果1〜${EVENT_SLOT_COUNT} は効果と同じ書き方（種類・対象・最大回数・値）で、計算方法も効果と同じです。なければ4列とも空欄にしてください。`,
    '・サンプル列に ○ を付けたカードは、画面に「サンプル（ダミー）」として表示されます。実データには付けないでください。',
    '・画像パスは images/support_cards/ 以下のファイル（例: images/support_cards/ssr_0001.webp）。なければ空欄で構いません。',
    '・効果種類・プランの選択肢は data/action_types.json・data/effect_types.json・data/plans.json から作られます。増やした場合は npm run cards:export で作り直してください。',
  ].forEach((text, i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });

  return wb;
}

/* ---------------- Excel → JSON ---------------- */

/** セルの値を文字列・数値・空(undefined)に正規化する */
function cellValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return cellValue(value.richText.map((r) => r.text).join(''));
    if ('result' in value) return cellValue(value.result);
    if ('text' in value) return cellValue(value.text);
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? undefined : t;
  }
  return value;
}

/** 数値列：数値または数値として読める文字列は数値に、それ以外はそのまま返して検証でエラーにする */
function toNumber(v) {
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/**
 * Excel ブックからカードデータを読み込む。
 * @returns {{ cards: object[], rowNumbers: number[], errors: string[] }}
 */
export function readCards(wb, countSources) {
  const ws = wb.getWorksheet(CARD_SHEET);
  if (!ws) return { cards: [], rowNumbers: [], errors: [`「${CARD_SHEET}」シートが見つかりません`] };

  const headerIndex = {};
  ws.getRow(1).eachCell((cell, col) => {
    const h = cellValue(cell.value);
    if (typeof h === 'string') headerIndex[h] = col;
  });
  const cols = columnDefs();
  const missing = cols.filter((c) => !(c.header in headerIndex)).map((c) => c.header);
  if (missing.length > 0) {
    return { cards: [], rowNumbers: [], errors: [`「${CARD_SHEET}」シートの1行目に必要な見出しがありません: ${missing.join(', ')}`] };
  }

  const cards = [];
  const rowNumbers = [];
  const errors = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (key) => cellValue(row.getCell(headerIndex[cols.find((c) => c.key === key).header]).value);
    const values = Object.fromEntries(cols.map((c) => [c.key, get(c.key)]));
    if (Object.values(values).every((v) => v === undefined)) continue; // 空行は無視

    const asText = (v) => (v === undefined ? undefined : String(v));
    const card = {
      id: asText(values.id),
      name: asText(values.name),
      rarity: asText(values.rarity),
      plan: asText(values.plan),
      image: asText(values.image) ?? '',
    };
    if (values.is_sample !== undefined) {
      if (['○', '〇', 'TRUE', 'true', true, 1].includes(values.is_sample)) card.is_sample = true;
      else errors.push(`${CARD_SHEET} ${r}行目: サンプル列は ○ か空欄にしてください（値: ${values.is_sample}）`);
    }

    // 効果1件分（種類・対象・最大回数・値）を読む。4列すべて空欄なら null
    const readEffect = (prefix) => {
      const effect = {
        type: values[`${prefix}_type`],
        target: values[`${prefix}_target`],
        max_count: toNumber(values[`${prefix}_max_count`]),
        value: toNumber(values[`${prefix}_value`]),
      };
      if (Object.values(effect).every((v) => v === undefined)) return null;
      // 固定加算（初期評価など）は最大回数を持たない
      if (effect.max_count === undefined && isFixedEffectType(countSources, effect.type)) delete effect.max_count;
      return effect;
    };

    card.event_bonus = [];
    for (let i = 1; i <= EVENT_SLOT_COUNT; i++) {
      const effect = readEffect(`event${i}`);
      if (effect) card.event_bonus.push(effect);
    }

    card.effects = [];
    for (let i = 1; i <= EFFECT_SLOT_COUNT; i++) {
      card.effects.push(readEffect(`effect${i}`) ?? { empty: true });
    }
    cards.push(card);
    rowNumbers.push(r);
  }
  return { cards, rowNumbers, errors };
}

const FIELD_LABELS = { type: '種類', target: '対象', max_count: '最大回数', value: '値' };

/** 検証メッセージ中の「support_cards.json: [i]」を Excel の行番号・列名に置き換える */
export function toExcelMessage(message, rowNumbers) {
  return message
    .replace(/^support_cards\.json: \[(\d+)\]/, (_, i) => `${CARD_SHEET} ${rowNumbers[Number(i)] ?? '?'}行目`)
    .replace(/\.effects\[(\d+)\]\.(\w+)/g, (_, i, f) => ` 効果${Number(i) + 1} ${FIELD_LABELS[f] ?? f}`)
    .replace(/\.effects\[(\d+)\]/g, (_, i) => ` 効果${Number(i) + 1}`)
    .replace(/\.event_bonus\[(\d+)\]\.(\w+)/g, (_, i, f) => ` イベント${Number(i) + 1} ${FIELD_LABELS[f] ?? f}`)
    .replace(/\.(id|name|rarity|plan|image):/, (_, f) => ` ${{ id: 'ID', name: 'カード名', rarity: 'レアリティ', plan: 'プラン', image: '画像パス' }[f]}:`);
}

/**
 * Excel ブックを読み込み、アプリと同じ検証を行う。
 * @returns {{ cards: object[], errors: string[] }} errors が空なら cards をそのまま保存できる
 */
export function importCards(wb, { plans, actionTypes, effectTypes }) {
  const countSources = buildCountSources(actionTypes, effectTypes);
  const { cards, rowNumbers, errors } = readCards(wb, countSources);
  if (errors.length > 0) return { cards, errors };
  try {
    validateAll({ plans, actionTypes, effectTypes, cards });
  } catch (e) {
    if (!e.messages) throw e;
    return { cards, errors: e.messages.map((m) => toExcelMessage(m, rowNumbers)) };
  }
  return { cards, errors: [] };
}
