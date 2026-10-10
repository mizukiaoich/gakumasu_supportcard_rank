import { PARAMETERS } from './constants.js';

// 全項目が同値のときの最終基準：カードIDの昇順（ロケールに依存しない単純比較）
const compareId = (a, b) => (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0);

/**
 * 優先パラメータランキング。重み付き合算はせず、次の順で比較する。
 *   1. 第一優先パラメータ（降順）
 *   2. 第二優先パラメータ（降順）
 *   3. 総合評価（降順）
 *   4. カードID（昇順）
 */
export function rankByPriority(results, first, second) {
  if (!PARAMETERS.includes(first) || !PARAMETERS.includes(second)) {
    throw new Error(`優先パラメータが不正です（第一: ${first} / 第二: ${second}）`);
  }
  if (first === second) throw new Error('第一優先と第二優先には異なるパラメータを指定してください');
  return [...results].sort((a, b) =>
    b.scores[first] - a.scores[first]
    || b.scores[second] - a.scores[second]
    || b.total - a.total
    || compareId(a, b));
}

/**
 * 総合評価ランキング。
 *   1. 総合評価（降順）
 *   2. カードID（昇順）
 */
export function rankByTotal(results) {
  return [...results].sort((a, b) => b.total - a.total || compareId(a, b));
}

/**
 * パラメータ別（単独）ランキング。
 *   1. 指定パラメータ（降順）
 *   2. 総合評価（降順）
 *   3. カードID（昇順）
 */
export function rankByParameter(results, parameter) {
  if (!PARAMETERS.includes(parameter)) throw new Error(`パラメータが不正です（${parameter}）`);
  return [...results].sort((a, b) => b.scores[parameter] - a.scores[parameter] || b.total - a.total || compareId(a, b));
}

export const PRIORITY_TIEBREAK_TEXT = '同値の場合の比較順：第一優先 → 第二優先 → 総合評価 → カードID（昇順）';
export const TOTAL_TIEBREAK_TEXT = '同値の場合の比較順：総合評価 → カードID（昇順）';
export const parameterTiebreakText = (p) => `同値の場合の比較順：${p} → 総合評価 → カードID（昇順）`;
