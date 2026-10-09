// サポートカードデータの Excel 入出力コマンド
//   node scripts/cards-excel.mjs export [xlsx]   現在の data/support_cards.json から Excel を作る
//   node scripts/cards-excel.mjs check  [xlsx]   Excel を検証だけする（JSON は変更しない）
//   node scripts/cards-excel.mjs import [xlsx]   Excel を検証し、問題がなければ data/support_cards.json を上書きする
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { buildWorkbook, importCards } from './cards-excel-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_XLSX = path.join(ROOT, 'excel', 'support_cards.xlsx');
const CARDS_JSON = path.join(ROOT, 'data', 'support_cards.json');

const loadJson = async (file) => JSON.parse(await readFile(path.join(ROOT, 'data', file), 'utf8'));

async function loadMaster() {
  const [plans, actionTypes, effectTypes] = await Promise.all([
    loadJson('plans.json'), loadJson('action_types.json'), loadJson('effect_types.json'),
  ]);
  return { plans, actionTypes, effectTypes };
}

async function main() {
  const [command, file = DEFAULT_XLSX] = process.argv.slice(2);
  const xlsx = path.resolve(file);
  const rel = path.relative(ROOT, xlsx);

  if (command === 'export') {
    const master = await loadMaster();
    const cards = await loadJson('support_cards.json');
    const wb = buildWorkbook({ ...master, cards });
    await mkdir(path.dirname(xlsx), { recursive: true });
    await wb.xlsx.writeFile(xlsx);
    console.log(`${rel} を作成しました（${cards.length}枚）`);
    return;
  }

  if (command === 'check' || command === 'import') {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsx);
    const { cards, errors } = importCards(wb, await loadMaster());
    if (errors.length > 0) {
      console.error(`${rel} に問題があります（${errors.length}件）。data/support_cards.json は変更していません。`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }
    if (command === 'check') {
      console.log(`${rel}: 問題ありません（${cards.length}枚）`);
      return;
    }
    await writeFile(CARDS_JSON, `${JSON.stringify(cards, null, 2)}\n`);
    console.log(`${rel} から data/support_cards.json を更新しました（${cards.length}枚）`);
    return;
  }

  console.error('使い方: node scripts/cards-excel.mjs <export|check|import> [Excelファイル]');
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
