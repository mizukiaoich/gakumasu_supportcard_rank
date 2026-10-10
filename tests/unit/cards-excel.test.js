import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { buildWorkbook, importCards, CARD_SHEET, columnDefs } from '../../scripts/cards-excel-lib.mjs';

const load = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), 'utf8'));
const master = async () => ({
  plans: await load('plans.json'),
  actionTypes: await load('action_types.json'),
  effectTypes: await load('effect_types.json'),
});

/** 実際にファイルへ書き出して読み直す（Excel で保存した場合と同じ経路） */
async function reload(wb) {
  const copy = new ExcelJS.Workbook();
  await copy.xlsx.load(await wb.xlsx.writeBuffer());
  return copy;
}

const col = (header) => columnDefs().findIndex((c) => c.header === header) + 1;

test('JSON → Excel → JSON で同じデータに戻る', async () => {
  const m = await master();
  const cards = await load('support_cards.json');
  const { cards: imported, errors } = importCards(await reload(buildWorkbook({ ...m, cards })), m);
  assert.deepEqual(errors, []);
  assert.deepEqual(imported, cards);
});

test('新しいカード行：空欄スロットは空スロット、初期評価は最大回数なし、数値文字列は数値になる', async () => {
  const m = await master();
  const wb = buildWorkbook({ ...m, cards: [] });
  const ws = wb.getWorksheet(CARD_SHEET);
  const row = ws.getRow(2);
  const set = (header, value) => { row.getCell(col(header)).value = value; };
  set('ID', 'ssr_0001');
  set('カード名', 'テストカード');
  set('レアリティ', 'SSR');
  set('プラン', 'センス');
  set('イベント1 種類', '初期評価'); set('イベント1 対象', 'Vo'); set('イベント1 最大回数', 1); set('イベント1 値', '20');
  set('イベント2 種類', '削除'); set('イベント2 対象', 'Da'); set('イベント2 最大回数', 2); set('イベント2 値', 10);
  set('効果2 種類', '削除'); set('効果2 対象', 'Vo'); set('効果2 最大回数', 4); set('効果2 値', 20);
  set('効果3 種類', '初期評価'); set('効果3 対象', 'Vo'); set('効果3 値', 65);
  set('効果4 種類', 'VoSP終了時'); set('効果4 対象', 'Vo'); set('効果4 最大回数', 3); set('効果4 値', 17);

  const { cards, errors } = importCards(await reload(wb), m);
  assert.deepEqual(errors, []);
  assert.deepEqual(cards, [{
    id: 'ssr_0001',
    name: 'テストカード',
    rarity: 'SSR',
    plan: 'センス',
    image: '',
    event_bonus: [
      { type: '初期評価', target: 'Vo', max_count: 1, value: 20 },
      { type: '削除', target: 'Da', max_count: 2, value: 10 },
    ],
    effects: [
      { empty: true },
      { type: '削除', target: 'Vo', max_count: 4, value: 20 },
      { type: '初期評価', target: 'Vo', value: 65 },
      { type: 'VoSP終了時', target: 'Vo', max_count: 3, value: 17 },
      { empty: true },
      { empty: true },
    ],
  }]);
});

test('不正な入力は Excel の行番号・列名つきで報告され、カードは保存されない', async () => {
  const m = await master();
  const cards = (await load('support_cards.json')).slice(0, 2);
  const wb = buildWorkbook({ ...m, cards });
  const ws = wb.getWorksheet(CARD_SHEET);
  ws.getRow(3).getCell(col('効果2 対象')).value = 'VO';
  ws.getRow(3).getCell(col('効果1 最大回数')).value = 'たくさん';
  ws.getRow(2).getCell(col('プラン')).value = 'センスX';

  const { errors } = importCards(await reload(wb), m);
  assert.equal(errors.length, 3);
  assert.ok(errors.some((e) => e.startsWith(`${CARD_SHEET} 2行目 (id: sample_001) プラン:`)), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith(`${CARD_SHEET} 3行目 (id: sample_002) 効果2 対象:`)), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith(`${CARD_SHEET} 3行目 (id: sample_002) 効果1 最大回数:`)), errors.join('\n'));
});

test('種類が空なのに他の項目が入っている効果はエラーになる（無言で空スロットにしない）', async () => {
  const m = await master();
  const wb = buildWorkbook({ ...m, cards: (await load('support_cards.json')).slice(0, 1) });
  wb.getWorksheet(CARD_SHEET).getRow(2).getCell(col('効果1 種類')).value = null;
  const { errors } = importCards(await reload(wb), m);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /2行目 \(id: sample_001\) 効果1 種類:/);
});

test('入力欄にはプルダウンが設定されている', async () => {
  const m = await master();
  const wb = await reload(buildWorkbook({ ...m, cards: [] }));
  const ws = wb.getWorksheet(CARD_SHEET);
  const at = (header) => ws.getCell(2, col(header)).dataValidation;
  assert.equal(at('プラン').type, 'list');
  assert.equal(at('効果1 種類').type, 'list');
  assert.equal(at('効果6 対象').type, 'list');
  assert.equal(at('効果1 最大回数').type, 'whole');
  const effectTypes = wb.getWorksheet('リスト').getColumn(3).values.filter(Boolean);
  assert.ok(effectTypes.includes('初期評価') && effectTypes.includes('VoSP終了時') && effectTypes.includes('Voレッスン'));
});
