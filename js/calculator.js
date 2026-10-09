import { PARAMETERS, FIXED_BONUS_TYPES } from './constants.js';
import { isEmptySlot, isFixedEffectType } from './validator.js';

/**
 * 1枚のカードの評価値を計算する。
 *   固定加算の効果（初期評価など、effect_types.json で fixed: true）とイベント効果（event_bonus）は
 *   行動回数に関係なく value を1回だけそのまま対象パラメータに加算
 *   それ以外の効果: actualCount = MIN(ユーザー入力の行動回数, max_count)
 *   contribution = actualCount × value
 *   対象パラメータ（Vo / Da / Vi）ごとに加算し、total = Vo + Da + Vi
 * 空スロットは計算対象外。データは validator.js で検証済みである前提だが、
 * 想定外の値が来た場合は誤った数値を出さずに例外を投げる。
 *
 * 発動回数の元になる行動回数は countSources で決まる（例: 効果「VoSP終了時」→ 行動「VoSPレッスン」の回数）。
 *
 * @param {object} card カードデータ
 * @param {Record<string, number>} actionCounts 行動種類名 → 入力回数
 * @param {Record<string, string>} [countSources] 効果種類名 → 回数を参照する行動種類名（省略時は効果種類名と同名の行動）
 */
export function calculateCard(card, actionCounts, countSources = {}) {
  const scores = Object.fromEntries(PARAMETERS.map((p) => [p, 0]));

  // イベント効果：回数に依存しない固定加算（1回のみ）
  const fixedBonuses = FIXED_BONUS_TYPES.map(({ key, label }) => ({
    key,
    label,
    items: (card[key] ?? []).map((bonus) => {
      if (!PARAMETERS.includes(bonus.target)) {
        throw new Error(`カード ${card.id} の${label}: 対象パラメータ「${bonus.target}」が不正です`);
      }
      scores[bonus.target] += bonus.value;
      return { target: bonus.target, value: bonus.value };
    }),
  }));

  const breakdown = card.effects.map((effect, index) => {
    const no = index + 1;
    if (isEmptySlot(effect)) return { no, empty: true };
    if (!PARAMETERS.includes(effect.target)) {
      throw new Error(`カード ${card.id} の効果${no}: 対象パラメータ「${effect.target}」が不正です`);
    }

    if (isFixedEffectType(countSources, effect.type)) {
      scores[effect.target] += effect.value;
      return {
        no,
        empty: false,
        fixed: true,
        type: effect.type,
        countFrom: null,
        target: effect.target,
        maxCount: null,
        inputCount: null,
        actualCount: 1,
        value: effect.value,
        contribution: effect.value,
      };
    }

    const countFrom = countSources[effect.type] ?? effect.type;
    const inputCount = actionCounts[countFrom];
    if (!Number.isInteger(inputCount) || inputCount < 0) {
      throw new Error(`カード ${card.id} の効果${no}: 行動「${countFrom}」の入力回数が不正です（値: ${inputCount}）`);
    }
    const actualCount = Math.min(inputCount, effect.max_count);
    const contribution = actualCount * effect.value;
    scores[effect.target] += contribution;
    return {
      no,
      empty: false,
      fixed: false,
      type: effect.type,
      countFrom,
      target: effect.target,
      maxCount: effect.max_count,
      inputCount,
      actualCount,
      value: effect.value,
      contribution,
    };
  });
  const total = PARAMETERS.reduce((sum, p) => sum + scores[p], 0);
  return { card, scores, total, fixedBonuses, breakdown };
}

/** 選択した育成プランのカードだけを抽出して計算する */
export function calculateForPlan(cards, plan, actionCounts, countSources = {}) {
  return cards.filter((card) => card.plan === plan).map((card) => calculateCard(card, actionCounts, countSources));
}
