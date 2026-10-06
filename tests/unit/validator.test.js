import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCards, validateAll, validatePlans, validateActionTypes, validateActionCounts, DataValidationError } from '../../js/validator.js';
import { ACTIONS, card, effect, EMPTY, counts } from './helpers.js';

const ctx = { planNames: ['センス', 'ロジック', 'アノマリー'], actionNames: ACTIONS };
const sixEffects = () => [
  effect('レッスン', 'Vo', 1, 1), effect('授業', 'Da', 1, 1), effect('相談', 'Vi', 1, 1),
  EMPTY, EMPTY, EMPTY,
];

test('正しいカードはエラーなし（空スロット { empty: true } を許可）', () => {
  assert.deepEqual(validateCards([card('a', 'センス', sixEffects())], ctx), []);
});

test('効果スロットが6件でなければエラー', () => {
  const errors = validateCards([card('a', 'センス', sixEffects().slice(0, 5))], ctx);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\(id: a\)\.effects: 効果スロットはちょうど6件/);
});

test('不正な効果は場所を特定できるメッセージで報告される', () => {
  const effects = sixEffects();
  effects[1] = effect('存在しない行動', 'VO', -1, '10');
  const errors = validateCards([card('bad', 'センス', effects)], ctx);
  assert.equal(errors.length, 4);
  assert.ok(errors.every((e) => e.includes('(id: bad).effects[1]')));
  assert.ok(errors.some((e) => e.includes('.type')));
  assert.ok(errors.some((e) => e.includes('.target')));
  assert.ok(errors.some((e) => e.includes('.max_count')));
  assert.ok(errors.some((e) => e.includes('.value')));
});

test('空スロットは null ではなく { "empty": true } で明示する', () => {
  const effects = sixEffects();
  effects[5] = null;
  assert.match(validateCards([card('a', 'センス', effects)], ctx)[0], /effects\[5\]/);
});

test('未登録のプラン・ID重複・必須項目の欠落を検出する', () => {
  const errors = validateCards([
    card('a', '存在しないプラン', sixEffects()),
    card('a', 'センス', sixEffects()),
    { ...card('b', 'センス', sixEffects()), name: '', rarity: undefined },
  ], ctx);
  assert.ok(errors.some((e) => e.includes('.plan')));
  assert.ok(errors.some((e) => e.includes('"a" が重複')));
  assert.ok(errors.some((e) => e.includes('(id: b).name')));
  assert.ok(errors.some((e) => e.includes('(id: b).rarity')));
});

test('プラン・行動種類の定義を検証する', () => {
  assert.deepEqual(validatePlans([{ name: 'センス' }]), []);
  assert.equal(validatePlans([]).length, 1);
  assert.equal(validatePlans([{ name: 'A' }, { name: 'A' }]).length, 1);
  assert.deepEqual(validateActionTypes([{ name: 'レッスン', default: 0 }]), []);
  assert.equal(validateActionTypes([{ name: 'レッスン', default: -1 }]).length, 1);
});

test('validateAll は問題があれば DataValidationError を投げる', () => {
  const plans = [{ name: 'センス' }];
  const actionTypes = ACTIONS.map((name) => ({ name }));
  assert.doesNotThrow(() => validateAll({ plans, actionTypes, cards: [card('a', 'センス', sixEffects())] }));
  assert.throws(
    () => validateAll({ plans, actionTypes, cards: [card('a', 'ロジック', sixEffects())] }),
    (e) => e instanceof DataValidationError && e.messages.length === 1,
  );
});

test('行動回数の入力検証：0以上の整数のみ許可', () => {
  assert.deepEqual(validateActionCounts(counts({ レッスン: 3 }), ACTIONS), []);
  const errors = validateActionCounts(counts({ レッスン: -1, 授業: 1.5, 休む: Number.NaN }), ACTIONS);
  assert.deepEqual(errors.map((e) => e.name), ['レッスン', '授業', '休む']);
});

test('初期評価（initial_bonus）を検証する', () => {
  const ok = { ...card('a', 'センス', sixEffects()), initial_bonus: [{ target: 'Vo', value: 65 }] };
  assert.deepEqual(validateCards([ok], ctx), []);
  assert.deepEqual(validateCards([{ ...ok, initial_bonus: [] }], ctx), []);

  const notArray = validateCards([{ ...ok, initial_bonus: { target: 'Vo', value: 65 } }], ctx);
  assert.match(notArray[0], /\(id: a\)\.initial_bonus: 初期評価は配列/);

  const bad = validateCards([{ ...ok, initial_bonus: [{ target: 'vo', value: '65' }] }], ctx);
  assert.equal(bad.length, 2);
  assert.ok(bad.some((e) => e.includes('initial_bonus[0].target')));
  assert.ok(bad.some((e) => e.includes('initial_bonus[0].value')));
});
