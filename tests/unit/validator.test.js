import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCards, validateEffectTypes, buildCountSources, validateAll, validatePlans, validateActionTypes, validateActionCounts, DataValidationError } from '../../js/validator.js';
import { ACTIONS, EFFECT_TYPES, card, effect, EMPTY, counts } from './helpers.js';

const ctx = {
  planNames: ['センス', 'ロジック', 'アノマリー'],
  countSources: buildCountSources(ACTIONS.map((name) => ({ name })), EFFECT_TYPES),
};
const sixEffects = () => [
  effect('Voレッスン', 'Vo', 1, 1), effect('授業・営業終了時', 'Da', 1, 1), effect('相談', 'Vi', 1, 1),
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
  assert.deepEqual(validateActionTypes([{ name: 'Voレッスン', default: 0 }]), []);
  assert.equal(validateActionTypes([{ name: 'Voレッスン', default: -1 }]).length, 1);
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
  assert.deepEqual(validateActionCounts(counts({ Voレッスン: 3 }), ACTIONS), []);
  const errors = validateActionCounts(counts({ Voレッスン: -1, '授業・営業終了時': 1.5, 休む: Number.NaN }), ACTIONS);
  assert.deepEqual(errors.map((e) => e.name), ['Voレッスン', '授業・営業終了時', '休む']);
});

test('初期評価は effects の中に type: 初期評価 で書き、max_count は指定しない', () => {
  const effects = sixEffects();
  effects[3] = { type: '初期評価', target: 'Vo', value: 65 };
  assert.deepEqual(validateCards([card('a', 'センス', effects)], ctx), []);
  effects[3] = { type: '初期評価', target: 'Vo', max_count: null, value: 65 };
  assert.deepEqual(validateCards([card('a', 'センス', effects)], ctx), []);

  effects[3] = { type: '初期評価', target: 'Vo', max_count: 1, value: 65 };
  assert.deepEqual(validateCards([card('a', 'センス', effects)], ctx), []);
  for (const bad of [0, 2, '1']) {
    effects[3] = { type: '初期評価', target: 'Vo', max_count: bad, value: 65 };
    assert.match(validateCards([card('a', 'センス', effects)], ctx)[0], /effects\[3\]\.max_count: 「初期評価」は固定加算（1回のみ）/, String(bad));
  }
  effects[3] = { type: '初期評価', target: 'VO', value: '65' };
  assert.equal(validateCards([card('a', 'センス', effects)], ctx).length, 2);
});

test('旧形式の initial_bonus 項目はエラーとして案内する', () => {
  const legacy = { ...card('a', 'センス', sixEffects()), initial_bonus: [{ target: 'Vo', value: 65 }] };
  assert.match(validateCards([legacy], ctx)[0], /\(id: a\)\.initial_bonus: 初期評価は effects の中に/);
});

test('イベント効果（event_bonus）は効果と同じルールで検証する', () => {
  const ok = {
    ...card('a', 'センス', sixEffects()),
    event_bonus: [{ type: '初期評価', target: 'Da', value: 20 }, { type: '削除', target: 'Vo', max_count: 2, value: 10 }],
  };
  assert.deepEqual(validateCards([ok], ctx), []);
  assert.deepEqual(validateCards([{ ...ok, event_bonus: [] }], ctx), []);
  assert.match(validateCards([{ ...ok, event_bonus: 20 }], ctx)[0], /\(id: a\)\.event_bonus: イベント効果は配列/);

  // type なし（旧形式）、対象・値の不正
  const bad = validateCards([{ ...ok, event_bonus: [{ target: 'DA', value: null }] }], ctx);
  assert.equal(bad.length, 4);
  for (const f of ['type', 'target', 'max_count', 'value']) assert.ok(bad.some((e) => e.includes(`event_bonus[0].${f}`)), f);

  // 固定加算の type に max_count、回数で発動する type に max_count なし
  const counts = validateCards([{ ...ok, event_bonus: [
    { type: '初期評価', target: 'Da', max_count: 3, value: 20 },
    { type: '削除', target: 'Vo', value: 10 },
  ] }], ctx);
  assert.ok(counts.some((e) => e.includes('event_bonus[0].max_count: 「初期評価」は固定加算')));
  assert.ok(counts.some((e) => e.includes('event_bonus[1].max_count: 0以上の整数')));

  // 空スロットは使えない
  assert.match(validateCards([{ ...ok, event_bonus: [{ empty: true }] }], ctx)[0], /event_bonus\[0\]: イベント効果に空スロットは使えません/);
});

test('効果種類（effect_types.json）を検証する', () => {
  assert.deepEqual(validateEffectTypes(EFFECT_TYPES, ACTIONS), []);
  assert.deepEqual(validateEffectTypes([], ACTIONS), []);
  const errors = validateEffectTypes([
    { name: 'VoSP終了時', count_from: 'SPレッスン' },
    { name: '初期評価X', fixed: true, count_from: 'Voレッスン' },
    { name: '初期評価Y', fixed: 'yes' },
    { name: 'VoSP終了時', count_from: 'Voレッスン' },
    { name: '授業・営業終了時', count_from: '授業・営業終了時' },
  ], ACTIONS);
  assert.ok(errors.some((e) => e.includes('[0].count_from')));
  assert.ok(errors.some((e) => e.includes('[1]: fixed: true の効果種類には count_from を指定できません')));
  assert.ok(errors.some((e) => e.includes('[2].fixed')));
  assert.ok(errors.some((e) => e.includes('[3].name: "VoSP終了時" が重複')));
  assert.ok(errors.some((e) => e.includes('[4].name: "授業・営業終了時" は action_types.json の行動種類と重複')));
});

test('カードの効果には行動種類と effect_types.json の効果種類が使え、旧「SPレッスン」は使えない', () => {
  const effects = [effect('VoSP終了時', 'Vo', 4, 17), effect('Daレッスン', 'Da', 2, 5), EMPTY, EMPTY, EMPTY, EMPTY];
  assert.deepEqual(validateCards([card('a', 'センス', effects)], ctx), []);
  effects[0] = effect('SPレッスン', 'Vo', 4, 17);
  assert.match(validateCards([card('a', 'センス', effects)], ctx)[0], /effects\[0\]\.type/);
});
