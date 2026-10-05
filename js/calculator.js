import { PARAMETERS } from './constants.js';
import { isEmptySlot } from './validator.js';

/**
 * 1枚のカードの評価値を計算する。
 *   actualCount  = MIN(ユーザー入力の行動回数, max_count)
 *   contribution = actualCount × value
 *   対象パラメータ（Vo / Da / Vi）ごとに加算し、total = Vo + Da + Vi
 * 空スロットは計算対象外。データは validator.js で検証済みである前提だが、
 * 想定外の値が来た場合は誤った数値を出さずに例外を投げる。
 *
 * @param {object} card カードデータ
 * @param {Record<string, number>} actionCounts 行動種類名 → 入力回数
 */
export function calculateCard(card, actionCounts) {
  const scores = Object.fromEntries(PARAMETERS.map((p) => [p, 0]));
  const breakdown = card.effects.map((effect, index) => {
    const no = index + 1;
    if (isEmptySlot(effect)) return { no, empty: true };

    const inputCount = actionCounts[effect.type];
    if (!Number.isInteger(inputCount) || inputCount < 0) {
      throw new Error(`カード ${card.id} の効果${no}: 行動「${effect.type}」の入力回数が不正です（値: ${inputCount}）`);
    }
    if (!PARAMETERS.includes(effect.target)) {
      throw new Error(`カード ${card.id} の効果${no}: 対象パラメータ「${effect.target}」が不正です`);
    }
    const actualCount = Math.min(inputCount, effect.max_count);
    const contribution = actualCount * effect.value;
    scores[effect.target] += contribution;
    return {
      no,
      empty: false,
      type: effect.type,
      target: effect.target,
      maxCount: effect.max_count,
      inputCount,
      actualCount,
      value: effect.value,
      contribution,
    };
  });
  const total = PARAMETERS.reduce((sum, p) => sum + scores[p], 0);
  return { card, scores, total, breakdown };
}

/** 選択した育成プランのカードだけを抽出して計算する */
export function calculateForPlan(cards, plan, actionCounts) {
  return cards.filter((card) => card.plan === plan).map((card) => calculateCard(card, actionCounts));
}
