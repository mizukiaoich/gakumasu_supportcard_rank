import { PARAMETERS } from './constants.js';
import { isEmptySlot, isFixedEffectType } from './validator.js';

/**
 * 効果1件（effects の1スロット、または event_bonus の1件）を計算し、内訳を返す。
 *   固定加算の効果（初期評価など、effect_types.json で fixed: true）: value を1回だけ加算
 *   それ以外: actualCount = MIN(ユーザー入力の行動回数, max_count)、contribution = actualCount × value
 * 発動回数の元になる行動回数は countSources で決まる（例: 効果「VoSP終了時」→ 行動「Voレッスン」の回数）。
 */
function calculateEffect(card, effect, label, no, actionCounts, countSources) {
  if (!PARAMETERS.includes(effect.target)) {
    throw new Error(`カード ${card.id} の${label}${no}: 対象パラメータ「${effect.target}」が不正です`);
  }
  const base = { no, empty: false, type: effect.type, target: effect.target, value: effect.value };
  if (isFixedEffectType(countSources, effect.type)) {
    return {
      ...base, fixed: true, countFrom: null, maxCount: effect.max_count ?? null, inputCount: null, actualCount: 1, contribution: effect.value,
    };
  }
  const countFrom = countSources[effect.type] ?? effect.type;
  const inputCount = actionCounts[countFrom];
  if (!Number.isInteger(inputCount) || inputCount < 0) {
    throw new Error(`カード ${card.id} の${label}${no}: 行動「${countFrom}」の入力回数が不正です（値: ${inputCount}）`);
  }
  const actualCount = Math.min(inputCount, effect.max_count);
  return {
    ...base, fixed: false, countFrom, maxCount: effect.max_count, inputCount, actualCount, contribution: actualCount * effect.value,
  };
}

/**
 * 1枚のカードの評価値を計算する。
 * 6つの効果スロット（effects）とイベント効果（event_bonus）は同じ形式・同じ計算方法で、
 * 対象パラメータ（Vo / Da / Vi）ごとに合計し、total = Vo + Da + Vi。
 * 空スロットは計算対象外。データは validator.js で検証済みである前提だが、
 * 想定外の値が来た場合は誤った数値を出さずに例外を投げる。
 *
 * @param {object} card カードデータ
 * @param {Record<string, number>} actionCounts 行動種類名 → 入力回数
 * @param {Record<string, string|null>} [countSources] 効果種類名 → 回数を参照する行動種類名（null は固定加算。省略時は効果種類名と同名の行動）
 */
export function calculateCard(card, actionCounts, countSources = {}) {
  const scores = Object.fromEntries(PARAMETERS.map((p) => [p, 0]));
  const add = (row) => {
    if (!row.empty) scores[row.target] += row.contribution;
    return row;
  };

  const breakdown = card.effects.map((effect, index) => (isEmptySlot(effect)
    ? { no: index + 1, empty: true }
    : add(calculateEffect(card, effect, '効果', index + 1, actionCounts, countSources))));
  const eventBreakdown = (card.event_bonus ?? []).map((effect, index) => add(
    calculateEffect(card, effect, 'イベント効果', index + 1, actionCounts, countSources),
  ));

  const total = PARAMETERS.reduce((sum, p) => sum + scores[p], 0);
  return { card, scores, total, breakdown, eventBreakdown };
}

/** 選択した育成プランのカードだけを抽出して計算する */
export function calculateForPlan(cards, plan, actionCounts, countSources = {}) {
  return cards.filter((card) => card.plan === plan).map((card) => calculateCard(card, actionCounts, countSources));
}
