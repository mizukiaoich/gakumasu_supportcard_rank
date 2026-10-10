// 公開時の版番号付け（scripts/stamp-version.mjs）のテスト。
// サイトを一時フォルダにコピーして版番号を付け、GitHub Pages と同じサブパスで配信して動作を確認する。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from '../../scripts/serve.mjs';
import { stampVersion } from '../../scripts/stamp-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = '/gakumasu_supportcard_rank/';
const VERSION = 'test123abc';
let dir;
let server;
let browser;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'stamp-'));
  for (const entry of ['index.html', 'ranking', 'js', 'css', 'data', 'images']) {
    await cp(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
  }
  await stampVersion(dir, VERSION);
  server = createServer({ base: BASE, root: dir });
  await new Promise((resolve) => server.listen(0, resolve));
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

test('HTML・JS の参照に版番号が付き、元のファイルは変更されない', async () => {
  const html = await readFile(path.join(dir, 'ranking', 'index.html'), 'utf8');
  assert.match(html, new RegExp(`src="\\.\\./js/app\\.js\\?v=${VERSION}"`));
  assert.match(html, new RegExp(`href="\\.\\./css/ranking\\.css\\?v=${VERSION}"`));
  const app = await readFile(path.join(dir, 'js', 'app.js'), 'utf8');
  assert.match(app, new RegExp(`from '\\./validator\\.js\\?v=${VERSION}'`));
  assert.doesNotMatch(await readFile(path.join(ROOT, 'js', 'app.js'), 'utf8'), /\?v=/);
});

test('JS・CSS・データ（JSON）がすべて同じ版番号で読み込まれ、ランキングを計算できる', async () => {
  const page = await browser.newPage();
  const requests = [];
  const errors = [];
  page.on('request', (req) => requests.push(new URL(req.url())));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}${BASE}ranking/`);
  await page.waitForSelector('body[data-ready="true"]');
  await page.fill('.count-input[data-action="Voレッスン"]', '3');
  await page.click('#calculate-button');
  assert.ok(await page.locator('[data-ranking="total"] tbody tr.ranking-row').count() > 0);

  const assets = requests.filter((u) => /\.(js|css|json)$/.test(u.pathname));
  const kinds = new Set(assets.map((u) => u.pathname.split('.').pop()));
  assert.deepEqual([...kinds].sort(), ['css', 'js', 'json']);
  for (const u of assets) assert.equal(u.searchParams.get('v'), VERSION, u.pathname);
  assert.equal(assets.filter((u) => u.pathname.endsWith('.json')).length, 4);
  assert.deepEqual(errors, []);
  await page.close();
});
