// ブラウザでの動作テスト。GitHub Pages のプロジェクトサイトと同じく
// サブパス（/gakumasu_supportcard_rank/）配下で配信して画面遷移・計算を確認する。
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from '../../scripts/serve.mjs';

const BASE_PATH = '/gakumasu_supportcard_rank/';
const load = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), 'utf8'));

let server;
let browser;
let origin;
let context;
let page;
let consoleErrors;
let cards;
let actionTypes;
let countFrom;

before(async () => {
  cards = await load('support_cards.json');
  actionTypes = await load('action_types.json');
  // 効果種類 → 回数を参照する行動（行動種類は自分自身、SP終了時は同じパラメータのレッスン）
  countFrom = Object.fromEntries([
    ...actionTypes.map((a) => [a.name, a.name]),
    ...(await load('effect_types.json')).map((e) => [e.name, e.fixed ? null : e.count_from]),
  ]);
  server = createServer({ base: BASE_PATH });
  await new Promise((resolve) => server.listen(0, resolve));
  origin = `http://localhost:${server.address().port}`;
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function openPage(viewport = { width: 1280, height: 900 }) {
  context = await browser.newContext({ viewport, hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });
  context.setDefaultTimeout(10000);
  page = await context.newPage();
  consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  return page;
}

beforeEach(async () => { await openPage(); });
afterEach(async () => { await context?.close(); });

/** 横方向にはみ出す要素がないか（body の overflow-x:hidden で隠れたはみ出しも検出する） */
async function assertNoHorizontalOverflow() {
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll('header, main, footer, section, .panel, form, .notice, .mock, .hero-visual')]
      .filter((el) => el.offsetParent !== null || el.tagName === 'MAIN')
      .filter((el) => el.getBoundingClientRect().right > vw + 1)
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${el.className}`);
  });
  assert.deepEqual(overflow, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}

const url = (p = '') => `${origin}${BASE_PATH}${p}`;

async function openRanking() {
  await page.goto(url('ranking/'));
  await page.waitForSelector('body[data-ready="true"]');
}

async function setCount(name, value) {
  await page.fill(`.count-input[data-action="${name}"]`, String(value));
}

async function selectPlan(name) {
  await page.click(`.plan-option:has(input[value="${name}"])`);
}

/** 期待値をテスト側で独立に計算する（固定加算の効果は1回だけ value、それ以外は MIN(入力, max_count) × value。イベント効果も同じ） */
function expectedScores(card, counts) {
  const s = { Vo: 0, Da: 0, Vi: 0 };
  for (const e of [...card.effects, ...(card.event_bonus ?? [])]) {
    if (e.empty) continue;
    if (countFrom[e.type] === null) s[e.target] += e.value; // 固定加算（初期評価）
    else s[e.target] += Math.min(counts[countFrom[e.type]] ?? 0, e.max_count) * e.value;
  }
  return { ...s, total: s.Vo + s.Da + s.Vi };
}

async function readTable(kind) {
  return page.$$eval(`[data-ranking="${kind}"] tbody tr.ranking-row`, (rows) => rows.map((tr) => {
    const num = (cls) => Number(tr.querySelector(cls).textContent.replace(/,/g, ''));
    return {
      id: tr.dataset.cardId,
      rank: Number(tr.querySelector('.col-rank').textContent),
      Vo: num('.col-vo'), Da: num('.col-da'), Vi: num('.col-vi'), total: num('.col-total'),
    };
  }));
}

const COUNTS = {
  Voレッスン: 3, Daレッスン: 4, Viレッスン: 2, '授業・営業終了時': 4, おでかけ: 1, 相談: 2,
  '活動支給・差し入れ選択時': 1, 強化: 3, 削除: 2, 休む: 5, '試験・オーディション終了時': 2, 集中効果カード獲得時: 3,
};

async function fillCounts(counts) {
  for (const [name, value] of Object.entries(counts)) await setCount(name, value);
}

/* ---------- ランディングページ・画面遷移 ---------- */

test('ランディングページが表示され、CTAからサブパス配下のランキング画面へ遷移できる', async () => {
  await page.goto(url());
  assert.equal(await page.textContent('.site-name'), '学園アイドルマスター サポートカード能力ランキング');
  assert.match(await page.textContent('.hero-title'), /あなたの育成条件に合わせて\s*最適なサポートカードを\s*見つけよう！/);
  const navTexts = await page.$$eval('.global-nav a', (as) => as.map((a) => a.textContent.trim()));
  assert.deepEqual(navTexts, ['使い方', '特徴', 'ランキングについて', 'よくある質問', '今すぐ使う']);
  assert.equal(await page.locator('.faq-item').count(), 5);
  assert.match(await page.textContent('.disclaimer'), /非公式/);

  await page.click('[data-testid="hero-cta"]');
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(new URL(page.url()).pathname, `${BASE_PATH}ranking/`);

  // ランキング画面のヘッダーからトップへ戻れる
  await page.click('.site-name');
  assert.equal(new URL(page.url()).pathname, BASE_PATH);
  assert.deepEqual(consoleErrors, []);
});

test('ランディングページのリンクはすべてサブパス内で解決される', async () => {
  await page.goto(url());
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
  for (const href of hrefs) assert.ok(href.startsWith(`${origin}${BASE_PATH}`), href);
  const res = await page.request.get(url('ranking'));
  assert.equal(res.status(), 200); // 末尾スラッシュなしでもリダイレクトで到達
});

/* ---------- データ読み込み・入力 ---------- */

test('JSONデータを読み込み、プラン・優先順位・行動回数の入力欄が生成される', async () => {
  await openRanking();
  const plans = await page.$$eval('input[name="plan"]', (els) => els.map((e) => e.value));
  assert.deepEqual(plans, ['センス', 'ロジック', 'アノマリー']);
  const actions = await page.$$eval('.count-input', (els) => els.map((e) => e.dataset.action));
  assert.deepEqual(actions, actionTypes.map((a) => a.name));
  assert.equal(await page.isVisible('#sample-notice'), true);
  assert.match(await page.textContent('#sample-notice'), /ダミーデータ/);
  assert.equal(await page.isVisible('#load-error'), false);
  assert.deepEqual(consoleErrors, []);
});

test('第一優先と同じパラメータは第二優先で選べない', async () => {
  await openRanking();
  const disabled = async () => page.$$eval('#priority-second option', (os) => os.filter((o) => o.disabled).map((o) => o.value));
  assert.deepEqual(await disabled(), ['Vo']);
  await page.selectOption('#priority-first', 'Da'); // 第二優先も Da だったので自動で切り替わる
  assert.notEqual(await page.inputValue('#priority-second'), 'Da');
  assert.deepEqual(await disabled(), ['Da']);
});

test('行動回数は＋／－ボタンと直接入力で変更でき、0未満にならない', async () => {
  await openRanking();
  const input = '.count-input[data-action="Voレッスン"]';
  const plus = '.action-item:has(input[data-action="Voレッスン"]) .count-btn:last-child';
  const minus = '.action-item:has(input[data-action="Voレッスン"]) .count-btn:first-child';
  await page.click(plus);
  await page.click(plus);
  assert.equal(await page.inputValue(input), '2');
  await page.click(minus);
  await page.click(minus);
  await page.click(minus);
  assert.equal(await page.inputValue(input), '0');
  await page.fill(input, '12');
  assert.equal(await page.inputValue(input), '12');
});

test('不正な行動回数では計算せず、エラーを案内する', async () => {
  await openRanking();
  await setCount('授業・営業終了時', -2);
  await page.click('#calculate-button');
  assert.equal(await page.isVisible('#form-error'), true);
  assert.match(await page.textContent('#form-error'), /授業・営業終了時：0以上の整数を入力してください/);
  assert.equal(await page.getAttribute('.count-input[data-action="授業・営業終了時"]', 'aria-invalid'), 'true');
  assert.equal(await page.isVisible('#results-body'), false);

  await setCount('授業・営業終了時', '1.5');
  await page.click('#calculate-button');
  assert.equal(await page.isVisible('#results-body'), false);

  await setCount('授業・営業終了時', 3);
  await page.click('#calculate-button');
  assert.equal(await page.isVisible('#form-error'), false);
  assert.equal(await page.isVisible('#results-body'), true);
});

/* ---------- 計算・ランキング ---------- */

for (const plan of ['センス', 'ロジック', 'アノマリー']) {
  test(`${plan}：選択プランのカードだけが表示され、Vo/Da/Vi・総合が正しい`, async () => {
    await openRanking();
    await selectPlan(plan);
    await fillCounts(COUNTS);
    await page.click('#calculate-button');

    const expectedIds = cards.filter((c) => c.plan === plan).map((c) => c.id).sort();
    for (const kind of ['priority', 'total']) {
      const rows = await readTable(kind);
      assert.deepEqual(rows.map((r) => r.id).sort(), expectedIds, kind);
      for (const row of rows) {
        const card = cards.find((c) => c.id === row.id);
        const exp = expectedScores(card, COUNTS);
        assert.deepEqual({ Vo: row.Vo, Da: row.Da, Vi: row.Vi, total: row.total }, exp, `${kind} ${row.id}`);
      }
    }
  });
}

test('優先パラメータランキングは 第一優先 → 第二優先 → 総合 → ID の順に並ぶ', async () => {
  await openRanking();
  await selectPlan('センス');
  await fillCounts(COUNTS);
  for (const [first, second] of [['Vo', 'Da'], ['Vi', 'Vo'], ['Da', 'Vi']]) {
    await page.selectOption('#priority-first', first);
    await page.selectOption('#priority-second', second);
    await page.click('#calculate-button');
    assert.equal(await page.textContent('#priority-title'), `優先パラメータランキング：第一優先 ${first} ／ 第二優先 ${second}`);
    assert.match(await page.textContent('#priority-tiebreak'), /第一優先 → 第二優先 → 総合評価 → カードID/);
    const rows = await readTable('priority');
    const sorted = [...rows].sort((a, b) => b[first] - a[first] || b[second] - a[second] || b.total - a.total || (a.id < b.id ? -1 : 1));
    assert.deepEqual(rows.map((r) => r.id), sorted.map((r) => r.id), `${first}/${second}`);
    assert.deepEqual(rows.map((r) => r.rank), rows.map((_, i) => i + 1));
  }
});

test('総合評価ランキングは総合の降順（同値はID順）に並ぶ', async () => {
  await openRanking();
  await selectPlan('ロジック');
  await fillCounts(COUNTS);
  await page.click('#calculate-button');
  const rows = await readTable('total');
  const sorted = [...rows].sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : 1));
  assert.deepEqual(rows.map((r) => r.id), sorted.map((r) => r.id));
  assert.ok(rows.length > 1);
});

test('入力変更後に再計算すると最新の条件で更新される', async () => {
  await openRanking();
  await page.click('#calculate-button');
  // 行動回数がすべて0のときは初期評価・イベント効果だけが加算される
  const zero = await readTable('total');
  for (const row of zero) {
    const card = cards.find((c) => c.id === row.id);
    const fixed = [...card.effects, ...(card.event_bonus ?? [])].filter((e) => e.type === '初期評価').reduce((sum, b) => sum + b.value, 0);
    assert.equal(row.total, fixed, row.id);
  }
  await setCount('Voレッスン', 4);
  assert.equal(await page.isVisible('#stale-notice'), true);
  await page.click('#calculate-button');
  assert.equal(await page.isVisible('#stale-notice'), false);
  const updated = await readTable('total');
  for (const row of updated) {
    const card = cards.find((c) => c.id === row.id);
    assert.equal(row.total, expectedScores(card, { Voレッスン: 4 }).total, row.id);
  }
  assert.ok(updated.some((r) => r.total !== zero.find((z) => z.id === r.id).total), "再計算で値が更新される");
});

/* ---------- カード詳細 ---------- */

test('カードを選ぶと詳細に6つの効果の内訳が表示され、発動回数は最大回数を超えない', async () => {
  await openRanking();
  await selectPlan('センス');
  const counts = { ...COUNTS, おでかけ: 9, 削除: 9 }; // 最大発動回数を超える入力
  await fillCounts(counts);
  await page.click('#calculate-button');
  await page.click('[data-ranking="priority"] tr[data-card-id="sample_001"] .card-name-btn');

  const detail = page.locator('#card-detail');
  assert.match(await detail.locator('.detail-name').textContent(), /ダミーカードA/);
  assert.match(await detail.locator('.detail-attrs').textContent(), /SSR.*センス/s);
  const rows = await detail.locator('.breakdown-table tbody tr').count();
  assert.equal(rows, 6);
  const header = await detail.locator('.breakdown-table thead th').allTextContents();
  assert.deepEqual(header, ['No.', '効果種類', '対象', '最大発動回数', '入力された行動回数', '実際の発動回数', '1回あたりの上昇値', '今回の上昇値']);

  const card = cards.find((c) => c.id === 'sample_001');
  const cells = await detail.locator('.breakdown-table tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((td) => td.textContent)));
  assert.ok(card.effects.some((e) => e.type === '初期評価'), 'sample_001 は初期評価を持つ');
  card.effects.forEach((e, i) => {
    const [no, type, target, max, input, actual, value, contribution] = cells[i];
    if (countFrom[e.type] === null) {
      // 初期評価：行動回数に関係なく1回だけ加算
      assert.deepEqual([no, type, target, max, input, actual, value, contribution],
        [String(i + 1), `${e.type}（固定加算・行動回数に関係なし）`, e.target, e.max_count === undefined ? '—' : String(e.max_count), '—', '1', String(e.value), `${e.target} +${e.value}`]);
      return;
    }
    const actualCount = Math.min(counts[countFrom[e.type]], e.max_count);
    assert.equal(no, String(i + 1));
    assert.equal(type, countFrom[e.type] === e.type ? e.type : `${e.type}（${countFrom[e.type]}の回数）`);
    assert.equal(target, e.target);
    assert.equal(Number(max), e.max_count);
    assert.equal(Number(input), counts[countFrom[e.type]]);
    assert.equal(Number(actual.replace('（上限）', '')), actualCount);
    assert.ok(actualCount <= e.max_count);
    assert.equal(Number(value), e.value);
    assert.equal(contribution, `${e.target} +${actualCount * e.value}`);
  });
  // イベント効果も同じ列構成の表で内訳が表示される
  const eventRows = await detail.locator('.event-table tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((td) => td.textContent)));
  assert.ok(card.event_bonus.length > 0);
  assert.deepEqual(eventRows.map((r) => [r[1].replace(/（.*$/, ''), r[2], r[7]]), card.event_bonus.map((e) => [e.type, e.target, `${e.target} +${e.value}`]));

  const exp = expectedScores(card, counts);
  const tiles = await detail.locator('.score-value').allTextContents();
  assert.deepEqual(tiles.map(Number), [exp.Vo, exp.Da, exp.Vi, exp.total]);
  assert.equal(await page.locator('tr.is-selected').count(), 2); // 両ランキングで選択表示
});

test('空スロットは詳細で「計算対象外」と表示される', async () => {
  await openRanking();
  await selectPlan('センス');
  await page.click('#calculate-button');
  await page.click('[data-ranking="total"] tr[data-card-id="sample_004"]');
  const rows = page.locator('.breakdown-table tbody tr');
  assert.equal(await rows.count(), 6);
  assert.equal(await page.locator('.breakdown-table tr.is-empty-slot').count(), 2);
  assert.match(await page.locator('.breakdown-table tr.is-empty-slot').first().textContent(), /計算対象外/);
  // sample_004 は初期評価なし（イベント効果はあり）
  assert.equal(await page.locator('.breakdown-table tr.is-fixed').count(), 0);
  assert.equal(await page.locator('.event-table tbody tr').count(), 1);
  assert.match(await page.textContent('.event-table tbody tr'), /Vo \+10/);
});

test('回数で発動するイベント効果は、入力した行動回数（上限あり）で計算される', async () => {
  await openRanking();
  await selectPlan('センス');
  await setCount('削除', 5);
  await page.click('#calculate-button');
  await page.click('[data-ranking="total"] tr[data-card-id="sample_002"]');
  const card = cards.find((c) => c.id === 'sample_002');
  const ev = card.event_bonus.find((e) => e.type === '削除');
  const row = await page.locator('.event-table tbody tr', { hasText: '削除' }).evaluate((tr) => [...tr.cells].map((td) => td.textContent));
  assert.deepEqual(row.slice(3), [String(ev.max_count), '5', `${ev.max_count}（上限）`, String(ev.value), `${ev.target} +${ev.max_count * ev.value}`]);
  const exp = expectedScores(card, { 削除: 5 });
  const tiles = await page.locator('#card-detail .score-value').allTextContents();
  assert.deepEqual(tiles.map(Number), [exp.Vo, exp.Da, exp.Vi, exp.total]);
});

/* ---------- 画像 ---------- */

test('画像がない・読み込めない場合もプレースホルダーで同じ大きさを保つ', async () => {
  // sample_001 の画像読み込みを失敗させる
  await page.route('**/images/support_cards/sample_001.svg', (route) => route.abort());
  await openRanking();
  await selectPlan('センス');
  await page.click('#calculate-button');
  await page.waitForFunction(() => !document.querySelector('[data-ranking="priority"] tr[data-card-id="sample_001"] img'));

  const boxes = await page.$$eval('[data-ranking="priority"] .card-thumb', (els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), placeholder: !!el.querySelector('.card-thumb-placeholder') };
  }));
  assert.ok(boxes.every((b) => b.placeholder));
  assert.ok(boxes.every((b) => b.w === boxes[0].w && b.h === boxes[0].h && b.h > b.w));
});

test('画像がある場合はカードデータの image パスから表示される', async () => {
  await openRanking();
  await selectPlan('センス');
  await page.click('#calculate-button');
  const img = page.locator('[data-ranking="priority"] tr[data-card-id="sample_001"] img');
  await img.evaluate((el) => (el.complete ? null : new Promise((r) => { el.onload = r; })));
  assert.equal(new URL(await img.evaluate((el) => el.src)).pathname, `${BASE_PATH}images/support_cards/sample_001.svg`);
  assert.ok(await img.evaluate((el) => el.naturalWidth > 0));
  assert.deepEqual(consoleErrors, []);
});

/* ---------- データ不備 ---------- */

test('データが不正な場合、問題のある箇所を特定できるエラーを表示し計算しない', async () => {
  const broken = structuredClone(cards);
  broken[1].effects[2].target = 'VO';
  broken[2].effects = broken[2].effects.slice(0, 5);
  await page.route('**/data/support_cards.json', (route) => route.fulfill({ json: broken }));
  await page.goto(url('ranking/'));
  await page.waitForSelector('#load-error:not([hidden])');
  const text = await page.textContent('#load-error');
  assert.match(text, /\(id: sample_002\)\.effects\[2\]\.target/);
  assert.match(text, /\(id: sample_003\)\.effects: 効果スロットはちょうど6件/);
  assert.equal(await page.isDisabled('#calculate-button'), true);
});

/* ---------- スマートフォン ---------- */

test('スマートフォン幅：ナビゲーションが折りたたまれ、横スクロールが発生しない', async () => {
  await context.close();
  await openPage({ width: 375, height: 740 });
  await page.goto(url());
  assert.equal(await page.isVisible('.nav-toggle'), true);
  assert.equal(await page.isVisible('#global-nav'), false);
  await page.tap('.nav-toggle');
  assert.equal(await page.isVisible('#global-nav'), true);
  assert.equal(await page.getAttribute('.nav-toggle', 'aria-expanded'), 'true');
  await page.tap('#global-nav a[href="#faq"]');
  assert.equal(await page.isVisible('#global-nav'), false);
  await assertNoHorizontalOverflow();

  await page.goto(url());
  await page.tap('[data-testid="hero-cta"]');
  await page.waitForSelector('body[data-ready="true"]');
  await assertNoHorizontalOverflow();
});

test('スマートフォン幅：入力欄とランキングが縦に並び、タップで操作・計算できる', async () => {
  await context.close();
  await openPage({ width: 375, height: 740 });
  await openRanking();
  await page.tap('.plan-option:has(input[value="アノマリー"])');
  const plus = '.action-item:has(input[data-action="授業・営業終了時"]) .count-btn:last-child';
  for (let i = 0; i < 3; i++) await page.tap(plus);
  assert.equal(await page.inputValue('.count-input[data-action="授業・営業終了時"]'), '3');
  const btn = await page.locator('.count-btn').first().boundingBox();
  assert.ok(btn.width >= 36 && btn.height >= 36, 'タップしやすいボタンサイズ');

  await page.tap('#calculate-button');
  const form = await page.locator('#condition-form').boundingBox();
  const results = await page.locator('#results-body').boundingBox();
  assert.ok(results.y >= form.y + form.height, '結果は入力欄の下に表示される');
  const rows = await readTable('priority');
  assert.deepEqual(rows.map((r) => r.id).sort(), cards.filter((c) => c.plan === 'アノマリー').map((c) => c.id).sort());
  await assertNoHorizontalOverflow();

  await page.tap('[data-ranking="priority"] tbody tr:first-child .card-name-btn');
  assert.equal(await page.locator('.breakdown-table tbody tr').count(), 6);
  await assertNoHorizontalOverflow();
  assert.deepEqual(consoleErrors, []);
});

test('PC幅：入力欄が左、ランキングが右に配置される', async () => {
  await openRanking();
  await page.click('#calculate-button');
  const form = await page.locator('#condition-form').boundingBox();
  const results = await page.locator('#results-body').boundingBox();
  assert.ok(form.x + form.width <= results.x);
  await assertNoHorizontalOverflow();
});
