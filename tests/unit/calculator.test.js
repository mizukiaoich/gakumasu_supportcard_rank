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
  effect('削除', 'Vo', 2, 10),
  effect('削除', 'Vi', 1, 20),
  effect('VoSP終了時', 'Vo', 4, 8),
  effect('授業', 'Da', 3, 6),
]);

test('実際の発動回数は MIN(行動回数, max_count) で最大回数を超えない', () => {
  const r = calculateCard(example, counts({ おでかけ: 10, 相談: 1, 削除: 5, VoSPレッスン: 4, 授業: 0 }), SOURCES);
  assert.deepEqual(r.breakdown.map((b) => b.actualCount), [3, 1, 2, 1, 4, 0]);
  for (const b of r.breakdown) assert.ok(b.actualCount <= b.maxCount);
});

test('Vo / Da / Vi と総合評価が正しく計算される', () => {
  // おでかけ 3回(max3)→Vo30, 相談 2回(max2)→Da30, 削除 2回→Vo20 & Vi min(2,1)=1→20,
  // VoSPレッスン 1回→VoSP終了時 Vo8, 授業 5回(max3)→Da18
  const r = calculateCard(example, counts({ おでかけ: 3, 相談: 2, 削除: 2, VoSPレッスン: 1, 授業: 5 }), SOURCES);
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
  delete missing['授業'];
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
    effect('授業', 'Da', 3, 4),
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
  const many = calculateCard(c, counts({ Voレッスン: 9, 授業: 1 }), SOURCES);
  assert.deepEqual(many.scores, { Vo: 65 + 10, Da: 4, Vi: 10 });
  assert.equal(many.total, 89);
});

test('イベント効果は行動回数に関係なく1回だけ固定で加算される', () => {
  const c = {
    ...card('ev', 'センス', [effect('相談', 'Da', 5, 3), { type: '初期評価', target: 'Vo', value: 65 }, EMPTY, EMPTY, EMPTY, EMPTY]),
    event_bonus: [{ target: 'Da', value: 20 }, { target: 'Vi', value: 15 }],
  };
  const zero = calculateCard(c, counts(), SOURCES);
  assert.deepEqual(zero.scores, { Vo: 65, Da: 20, Vi: 15 });
  assert.equal(zero.total, 100);

  // 行動回数を増やしてもイベント効果は増えない（効果分 3回×3=9 のみ増える）
  const many = calculateCard(c, counts({ 相談: 3, 授業: 99 }), SOURCES);
  assert.deepEqual(many.scores, { Vo: 65, Da: 20 + 9, Vi: 15 });
  assert.deepEqual(many.fixedBonuses.map((f) => [f.key, f.label, f.items.length]), [['event_bonus', 'イベント効果', 2]]);

  // event_bonus がないカードはイベント効果0
  const none = calculateCard(card('n', 'センス', c.effects), counts(), SOURCES);
  assert.deepEqual(none.scores, { Vo: 65, Da: 0, Vi: 0 });
});

test('SP終了時の効果は、同じパラメータのSPレッスンの回数だけ発動する', () => {
  const c = card('sp', 'センス', [
    effect('VoSP終了時', 'Vo', 5, 10),
    effect('DaSP終了時', 'Vo', 5, 7),
    effect('ViSP終了時', 'Vi', 2, 4),
    effect('Voレッスン', 'Da', 9, 1),
    EMPTY, EMPTY,
  ]);
  const r = calculateCard(c, counts({ VoSPレッスン: 3, DaSPレッスン: 0, ViSPレッスン: 6, Voレッスン: 2 }), SOURCES);
  // VoSP終了時: VoSPレッスン3回→Vo30 / DaSP終了時: DaSPレッスン0回→0 / ViSP終了時: MIN(6,2)=2→Vi8 / Voレッスン2回→Da2
  assert.deepEqual(r.breakdown.slice(0, 4).map((b) => [b.countFrom, b.inputCount, b.actualCount]), [
    ['VoSPレッスン', 3, 3], ['DaSPレッスン', 0, 0], ['ViSPレッスン', 6, 2], ['Voレッスン', 2, 2],
  ]);
  assert.deepEqual(r.scores, { Vo: 30, Da: 2, Vi: 8 });

  // 他のパラメータのSPレッスンやレッスンの回数では発動しない
  const other = calculateCard(c, counts({ Voレッスン: 9, Daレッスン: 9, Viレッスン: 9 }), SOURCES);
  assert.deepEqual(other.scores, { Vo: 0, Da: 9, Vi: 0 });
});
