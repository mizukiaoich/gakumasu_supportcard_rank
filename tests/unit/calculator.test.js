import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCard, calculateForPlan } from '../../js/calculator.js';
import { card, counts, effect, EMPTY } from './helpers.js';

// 要件の構造説明用データ例と同じ効果構成
const example = card('sample_001', 'センス', [
  effect('おでかけ', 'Vo', 3, 10),
  effect('相談', 'Da', 2, 15),
  effect('削除', 'Vo', 2, 10),
  effect('削除', 'Vi', 1, 20),
  effect('SPレッスン', 'Vo', 4, 8),
  effect('授業', 'Da', 3, 6),
]);

test('実際の発動回数は MIN(行動回数, max_count) で最大回数を超えない', () => {
  const r = calculateCard(example, counts({ おでかけ: 10, 相談: 1, 削除: 5, SPレッスン: 4, 授業: 0 }));
  assert.deepEqual(r.breakdown.map((b) => b.actualCount), [3, 1, 2, 1, 4, 0]);
  for (const b of r.breakdown) assert.ok(b.actualCount <= b.maxCount);
});

test('Vo / Da / Vi と総合評価が正しく計算される', () => {
  // おでかけ 3回(max3)→Vo30, 相談 2回(max2)→Da30, 削除 2回→Vo20 & Vi min(2,1)=1→20,
  // SPレッスン 1回→Vo8, 授業 5回(max3)→Da18
  const r = calculateCard(example, counts({ おでかけ: 3, 相談: 2, 削除: 2, SPレッスン: 1, 授業: 5 }));
  assert.deepEqual(r.scores, { Vo: 58, Da: 48, Vi: 20 });
  assert.equal(r.total, 126);
  assert.deepEqual(r.breakdown.map((b) => b.contribution), [30, 30, 20, 20, 8, 18]);
});

test('行動回数がすべて0なら評価値は0', () => {
  const r = calculateCard(example, counts());
  assert.deepEqual(r.scores, { Vo: 0, Da: 0, Vi: 0 });
  assert.equal(r.total, 0);
});

test('空スロットは計算対象外で、内訳には空として残る', () => {
  const c = card('x', 'センス', [effect('レッスン', 'Vo', 2, 5), EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
  const r = calculateCard(c, counts({ レッスン: 9 }));
  assert.equal(r.breakdown.length, 6);
  assert.deepEqual(r.breakdown.map((b) => b.empty), [false, true, true, true, true, true]);
  assert.deepEqual(r.scores, { Vo: 10, Da: 0, Vi: 0 });
});

test('入力回数が不正なら黙って計算せず例外を投げる', () => {
  assert.throws(() => calculateCard(example, counts({ おでかけ: -1 })), /おでかけ/);
  const missing = counts();
  delete missing['授業'];
  assert.throws(() => calculateCard(example, missing), /授業/);
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
