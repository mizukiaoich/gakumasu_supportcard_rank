import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankByPriority, rankByTotal } from '../../js/ranking.js';
import { scored } from './helpers.js';

const ids = (list) => list.map((r) => r.card.id);

test('優先パラメータランキング：第一優先の降順', () => {
  const list = [scored('a', 10, 0, 0), scored('b', 30, 0, 0), scored('c', 20, 0, 0)];
  assert.deepEqual(ids(rankByPriority(list, 'Vo', 'Da')), ['b', 'c', 'a']);
});

test('優先パラメータランキング：第一優先が同値なら第二優先で比較', () => {
  const list = [scored('a', 50, 10, 0), scored('b', 50, 30, 0), scored('c', 50, 20, 0)];
  assert.deepEqual(ids(rankByPriority(list, 'Vo', 'Da')), ['b', 'c', 'a']);
});

test('優先パラメータランキング：重み付き合算ではない（第一優先が少しでも高いほうが上）', () => {
  // 合算(Vo+Da)なら b が上だが、第一優先 Vo が高い a を上位にする
  const list = [scored('a', 51, 0, 0), scored('b', 50, 100, 0)];
  assert.deepEqual(ids(rankByPriority(list, 'Vo', 'Da')), ['a', 'b']);
});

test('優先パラメータランキング：第一・第二が同値なら総合評価、さらに同値ならカードID昇順', () => {
  const list = [
    scored('d', 10, 10, 5),
    scored('c', 10, 10, 9),
    scored('b', 10, 10, 5),
    scored('a', 10, 10, 1),
  ];
  assert.deepEqual(ids(rankByPriority(list, 'Vo', 'Da')), ['c', 'b', 'd', 'a']);
});

test('優先パラメータランキング：第二優先 Vi 指定時は Vi で比較する', () => {
  const list = [scored('a', 0, 50, 10), scored('b', 0, 50, 20)];
  assert.deepEqual(ids(rankByPriority(list, 'Da', 'Vi')), ['b', 'a']);
});

test('優先パラメータランキング：第一と第二が同じ・不正値はエラー', () => {
  assert.throws(() => rankByPriority([], 'Vo', 'Vo'));
  assert.throws(() => rankByPriority([], 'VO', 'Da'));
});

test('総合評価ランキング：総合の降順、同値ならカードID昇順', () => {
  const list = [scored('c', 10, 0, 0), scored('a', 0, 5, 5), scored('b', 30, 0, 0), scored('d', 1, 1, 1)];
  assert.deepEqual(ids(rankByTotal(list)), ['b', 'a', 'c', 'd']);
});

test('ランキング関数は元の配列を変更しない', () => {
  const list = [scored('a', 1, 0, 0), scored('b', 2, 0, 0)];
  rankByTotal(list);
  rankByPriority(list, 'Vo', 'Da');
  assert.deepEqual(ids(list), ['a', 'b']);
});
