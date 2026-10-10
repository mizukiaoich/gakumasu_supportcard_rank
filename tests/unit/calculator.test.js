import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCard, calculateForPlan } from '../../js/calculator.js';
import { ACTIONS, EFFECT_TYPES, card, counts, effect, EMPTY } from './helpers.js';
import { buildCountSources } from '../../js/validator.js';

const SOURCES = buildCountSources(ACTIONS.map((name) => ({ name })), EFFECT_TYPES);

// 要件の構造説明用データ例と同じ効果構成（SPレッスンは VoSP終了時 に置き換え）
const example = card('sample_001', 'センス', [
  effect('おでかけ', 'Vo', 3, 10),
  effect('相談', 'Da', 2, 15),
  effect('スキル削除時', 'Vo', 2, 10),
  effect('スキル削除時', 'Vi', 1, 20),
  effect('VoSP終了時', 'Vo', 4, 8),
  effect('授業・営業終了時', 'Da', 3, 6),
]);

test('実際の発動回数は MIN(行動回数, max_count) で最大回数を超えない', () => {
  const r = calculateCard(example, counts({ おでかけ: 10, 相談: 1, スキル削除時: 5, Voレッスン: 4, '授業・営業終了時': 0 }), SOURCES);
  assert.deepEqual(r.breakdown.map((b) => b.actualCount), [3, 1, 2, 1, 4, 0]);
  for (const b of r.breakdown) assert.ok(b.actualCount <= b.maxCount);
});

test('Vo / Da / Vi と総合評価が正しく計算される', () => {
  // おでかけ 3回(max3)→Vo30, 相談 2回(max2)→Da30, スキル削除時 2回→Vo20 & Vi min(2,1)=1→20,
  // Voレッスン 1回→VoSP終了時 Vo8, 授業・営業終了時 5回(max3)→Da18
  const r = calculateCard(example, counts({ おでかけ: 3, 相談: 2, スキル削除時: 2, Voレッスン: 1, '授業・営業終了時': 5 }), SOURCES);
  assert.deepEqual(r.scores, { Vo: 58, Da: 48, Vi: 20 });
  assert.equal(r.total, 126);
  assert.deepEqual(r.breakdown.map((b) => b.contribution), [30, 30, 20, 20, 8, 18]);
});

test('行動回数がすべて0なら評価値は0', () => {
  const r = calculateCard(example, counts(), SOURCES);
  assert.deepEqual(r.scores, { Vo: 0, Da: 0, Vi: 0 });
  assert.equal(r.total, 0);
});

test('空スロットは計算対象外で、内訳には空として残る', () => {
  const c = card('x', 'センス', [effect('Voレッスン', 'Vo', 2, 5), EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
  const r = calculateCard(c, counts({ Voレッスン: 9 }));
  assert.equal(r.breakdown.length, 6);
  assert.deepEqual(r.breakdown.map((b) => b.empty), [false, true, true, true, true, true]);
  assert.deepEqual(r.scores, { Vo: 10, Da: 0, Vi: 0 });
});

test('入力回数が不正なら黙って計算せず例外を投げる', () => {
  assert.throws(() => calculateCard(example, counts({ おでかけ: -1 }), SOURCES), /おでかけ/);
  const missing = counts();
  delete missing['授業・営業終了時'];
  assert.throws(() => calculateCard(example, missing, SOURCES), /授業/);
});

test('calculateForPlan は選択したプランのカードだけを対象にする', () => {
  const cards = [
    card('a', 'センス', [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]),
    card('b', 'ロジック', [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]),
    card('c', 'センス', [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]),
  ];
  assert.deepEqual(calculateForPlan(cards, 'センス', counts()).map((r) => r.card.id), ['a', 'c']);
  assert.deepEqual(calculateForPlan(cards, 'アノマリー', counts()), []);
});

test('初期評価（効果スロット）は行動回数に関係なく1回だけ固定で加算される', () => {
  const c = card('init', 'センス', [
    effect('Voレッスン', 'Vo', 2, 5),
    effect('授業・営業終了時', 'Da', 3, 4),
    { type: '初期評価', target: 'Vo', value: 65 },
    { type: '初期評価', target: 'Vi', value: 10 },
    EMPTY, EMPTY,
  ]);
  // 行動回数0でも初期評価だけは加算される
  const zero = calculateCard(c, counts(), SOURCES);
  assert.deepEqual(zero.scores, { Vo: 65, Da: 0, Vi: 10 });
  assert.equal(zero.total, 75);
  assert.deepEqual(zero.breakdown[2], {
    no: 3, empty: false, fixed: true, type: '初期評価', countFrom: null, target: 'Vo',
    maxCount: null, inputCount: null, actualCount: 1, value: 65, contribution: 65,
  });

  // 行動回数を増やしても初期評価の値は変わらず、効果分だけが増える
  const many = calculateCard(c, counts({ Voレッスン: 9, '授業・営業終了時': 1 }), SOURCES);
  assert.deepEqual(many.scores, { Vo: 65 + 10, Da: 4, Vi: 10 });
  assert.equal(many.total, 89);
});

test('イベント効果は効果と同じ type で計算される（固定加算も回数分の加算も使える）', () => {
  const c = {
    ...card('ev', 'センス', [effect('相談', 'Da', 5, 3), { type: '初期評価', target: 'Vo', value: 65 }, EMPTY, EMPTY, EMPTY, EMPTY]),
    event_bonus: [
      { type: '初期評価', target: 'Da', max_count: 1, value: 20 },
      { type: '初期評価', target: 'Vi', value: 15 },
      { type: 'スキル削除時', target: 'Vi', max_count: 2, value: 10 },
      { type: 'DaSP終了時', target: 'Da', max_count: 3, value: 4 },
    ],
  };
  // 行動回数0：固定加算のイベント効果だけが加算される
  const zero = calculateCard(c, counts(), SOURCES);
  assert.deepEqual(zero.scores, { Vo: 65, Da: 20, Vi: 15 });
  assert.equal(zero.total, 100);

  // スキル削除時5回 → MIN(5,2)×10=20、Daレッスン1回 → 1×4=4、相談3回 → 3×3=9
  const many = calculateCard(c, counts({ 相談: 3, スキル削除時: 5, Daレッスン: 1, '授業・営業終了時': 99 }), SOURCES);
  assert.deepEqual(many.scores, { Vo: 65, Da: 20 + 9 + 4, Vi: 15 + 20 });
  assert.deepEqual(many.eventBreakdown.map((b) => [b.no, b.type, b.fixed, b.countFrom, b.actualCount, b.contribution]), [
    [1, '初期評価', true, null, 1, 20],
    [2, '初期評価', true, null, 1, 15],
    [3, 'スキル削除時', false, 'スキル削除時', 2, 20],
    [4, 'DaSP終了時', false, 'Daレッスン', 1, 4],
  ]);

  // event_bonus がないカードはイベント効果0
  const none = calculateCard(card('n', 'センス', c.effects), counts(), SOURCES);
  assert.deepEqual(none.scores, { Vo: 65, Da: 0, Vi: 0 });
});

test('SP終了時の効果は、同じパラメータのレッスン（SPレッスン含む）の回数で発動する', () => {
  const c = card('sp', 'センス', [
    effect('VoSP終了時', 'Vo', 5, 10),
    effect('DaSP終了時', 'Vo', 5, 7),
    effect('ViSP終了時', 'Vi', 2, 4),
    effect('Voレッスン', 'Da', 9, 1),
    EMPTY, EMPTY,
  ]);
  const r = calculateCard(c, counts({ Voレッスン: 3, Daレッスン: 0, Viレッスン: 6 }), SOURCES);
  // VoSP終了時: Voレッスン3回→Vo30 / DaSP終了時: Daレッスン0回→0 / ViSP終了時: MIN(6,2)=2→Vi8 / Voレッスン3回→Da3
  assert.deepEqual(r.breakdown.slice(0, 4).map((b) => [b.countFrom, b.inputCount, b.actualCount]), [
    ['Voレッスン', 3, 3], ['Daレッスン', 0, 0], ['Viレッスン', 6, 2], ['Voレッスン', 3, 3],
  ]);
  assert.deepEqual(r.scores, { Vo: 30, Da: 3, Vi: 8 });

  // 他のパラメータのレッスン回数では発動しない
  const other = calculateCard(c, counts({ Daレッスン: 9 }), SOURCES);
  assert.deepEqual(other.scores, { Vo: 5 * 7, Da: 0, Vi: 0 });
});

test('追加した効果種類（試験・オーディション終了時、特別指導開始時、各効果カード獲得時）は同名の行動回数で発動する', () => {
  const c = card('new', 'センス', [
    effect('試験・オーディション終了時', 'Vo', 3, 20),
    effect('好印象効果カード獲得時', 'Da', 4, 5),
    effect('全力効果カード獲得時', 'Vi', 2, 8),
    effect('活動支給・差し入れ選択時', 'Vo', 2, 6),
    effect('授業・営業終了時', 'Da', 3, 2),
    effect('特別指導開始時', 'Vi', 2, 15),
  ]);
  const r = calculateCard(c, counts({
    '試験・オーディション終了時': 2, 好印象効果カード獲得時: 6, 全力効果カード獲得時: 1,
    '活動支給・差し入れ選択時': 5, '授業・営業終了時': 1, 好調効果カード獲得時: 9, 特別指導開始時: 3,
  }), SOURCES);
  // 試験2回×20=Vo40、好印象 MIN(6,4)×5=Da20、全力1回×8=Vi8、活動支給 MIN(5,2)×6=Vo12、授業1回×2=Da2、
  // 特別指導 MIN(3,2)×15=Vi30（好調は対象外）
  assert.deepEqual(r.scores, { Vo: 52, Da: 22, Vi: 38 });
});

test('SPレッスンは対象パラメータと同じレッスンの回数、スキル獲得時は各効果カード獲得時の合計回数で発動する', () => {
  const c = card('sum', 'センス', [
    effect('SPレッスン', 'Vo', 10, 3),
    effect('スキル獲得時', 'Da', 5, 4),
    effect('Pドリンク獲得時', 'Vi', 3, 2),
    effect('スキルチェンジ時', 'Vi', 2, 10),
    EMPTY, EMPTY,
  ]);
  const r = calculateCard(c, counts({
    Voレッスン: 2, Daレッスン: 3, Viレッスン: 1,
    好調効果カード獲得時: 1, 集中効果カード獲得時: 2, 全力効果カード獲得時: 1, 'スキル（SSR）獲得時': 9,
    Pドリンク獲得時: 1, スキルチェンジ時: 4,
  }), SOURCES);
  // SPレッスン（対象Vo）: Voレッスン2回だけ ×3 = Vo6（Da・Viレッスンは数えない）
  // スキル獲得時: 1+2+1=4回 ×4 = Da16（スキル（SSR）獲得時は含まない）
  // Pドリンク獲得時 1回×2 = Vi2 / スキルチェンジ時 MIN(4,2)×10 = Vi20
  assert.deepEqual(r.breakdown.slice(0, 2).map((b) => [b.inputCount, b.actualCount]), [[2, 2], [4, 4]]);
  assert.equal(r.breakdown[0].countFrom, 'Voレッスン');
  assert.deepEqual(r.scores, { Vo: 6, Da: 16, Vi: 22 });

  // 対象が Da / Vi の SPレッスン効果は、それぞれ Daレッスン / Viレッスンの回数だけを使う
  const byTarget = card('sp2', 'センス', [effect('SPレッスン', 'Da', 99, 1), effect('SPレッスン', 'Vi', 99, 1), EMPTY, EMPTY, EMPTY, EMPTY]);
  const r2 = calculateCard(byTarget, counts({ Voレッスン: 7, Daレッスン: 3, Viレッスン: 1 }), SOURCES);
  assert.deepEqual(r2.breakdown.slice(0, 2).map((b) => [b.countFrom, b.inputCount]), [['Daレッスン', 3], ['Viレッスン', 1]]);
  assert.deepEqual(r2.scores, { Vo: 0, Da: 3, Vi: 1 });

  // 合計回数にも最大発動回数の上限がかかる
  const capped = calculateCard(c, counts({ 好調効果カード獲得時: 5, 好印象効果カード獲得時: 5 }), SOURCES);
  assert.equal(capped.breakdown[1].actualCount, 5);
});
