import { PARAMETERS, EFFECT_SLOT_COUNT, FIXED_BONUS_TYPES } from './constants.js';

/**
 * データ不備を表すエラー。どのファイルのどの項目が不正かを messages に保持する。
 */
export class DataValidationError extends Error {
  constructor(messages) {
    super(`データに問題があります（${messages.length}件）:\n- ${messages.join('\n- ')}`);
    this.name = 'DataValidationError';
    this.messages = messages;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isNonNegativeInteger = (v) => Number.isInteger(v) && v >= 0;
const show = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));

/** 空スロット表現: { "empty": true } */
export function isEmptySlot(effect) {
  return isPlainObject(effect) && effect.empty === true;
}

export function validatePlans(plans, file = 'plans.json') {
  const errors = [];
  if (!Array.isArray(plans) || plans.length === 0) {
    return [`${file}: 1件以上の育成プランを配列で定義してください`];
  }
  const seen = new Set();
  plans.forEach((plan, i) => {
    const where = `${file}: [${i}]`;
    if (!isPlainObject(plan) || !isNonEmptyString(plan.name)) {
      errors.push(`${where}.name: 空でない文字列が必要です（値: ${show(plan?.name)}）`);
      return;
    }
    if (seen.has(plan.name)) errors.push(`${where}.name: "${plan.name}" が重複しています`);
    seen.add(plan.name);
  });
  return errors;
}

export function validateActionTypes(actionTypes, file = 'action_types.json') {
  const errors = [];
  if (!Array.isArray(actionTypes) || actionTypes.length === 0) {
    return [`${file}: 1件以上の行動種類を配列で定義してください`];
  }
  const seen = new Set();
  actionTypes.forEach((action, i) => {
    const where = `${file}: [${i}]`;
    if (!isPlainObject(action) || !isNonEmptyString(action.name)) {
      errors.push(`${where}.name: 空でない文字列が必要です（値: ${show(action?.name)}）`);
      return;
    }
    if (seen.has(action.name)) errors.push(`${where}.name: "${action.name}" が重複しています`);
    seen.add(action.name);
    if (action.default !== undefined && !isNonNegativeInteger(action.default)) {
      errors.push(`${where}.default: 0以上の整数が必要です（値: ${show(action.default)}）`);
    }
  });
  return errors;
}

export function validateCards(cards, { planNames, actionNames }, file = 'support_cards.json') {
  const errors = [];
  if (!Array.isArray(cards)) return [`${file}: カードを配列で定義してください`];
  const plans = new Set(planNames);
  const actions = new Set(actionNames);
  const seenIds = new Set();

  cards.forEach((card, i) => {
    const label = isPlainObject(card) && isNonEmptyString(card.id) ? ` (id: ${card.id})` : '';
    const where = `${file}: [${i}]${label}`;
    if (!isPlainObject(card)) {
      errors.push(`${where}: カードはオブジェクトで定義してください`);
      return;
    }
    if (!isNonEmptyString(card.id)) {
      errors.push(`${where}.id: 空でない文字列が必要です（値: ${show(card.id)}）`);
    } else if (seenIds.has(card.id)) {
      errors.push(`${where}.id: "${card.id}" が重複しています`);
    } else {
      seenIds.add(card.id);
    }
    if (!isNonEmptyString(card.name)) errors.push(`${where}.name: 空でない文字列が必要です（値: ${show(card.name)}）`);
    if (!isNonEmptyString(card.rarity)) errors.push(`${where}.rarity: 空でない文字列が必要です（値: ${show(card.rarity)}）`);
    if (!plans.has(card.plan)) {
      errors.push(`${where}.plan: plans.json に存在しない育成プランです（値: ${show(card.plan)}）`);
    }
    if (card.image !== undefined && card.image !== null && typeof card.image !== 'string') {
      errors.push(`${where}.image: 文字列（画像パス）または空文字が必要です（値: ${show(card.image)}）`);
    }
    if (card.is_sample !== undefined && typeof card.is_sample !== 'boolean') {
      errors.push(`${where}.is_sample: true / false が必要です（値: ${show(card.is_sample)}）`);
    }
    for (const { key, label } of FIXED_BONUS_TYPES) {
      const list = card[key];
      if (list === undefined) continue;
      if (!Array.isArray(list)) {
        errors.push(`${where}.${key}: ${label}は配列で定義してください（例: [{ "target": "Vo", "value": 65 }]、なしの場合は []）`);
        continue;
      }
      list.forEach((bonus, j) => {
        const at = `${where}.${key}[${j}]`;
        if (!isPlainObject(bonus)) {
          errors.push(`${at}: ${label}はオブジェクトで定義してください`);
          return;
        }
        if (!PARAMETERS.includes(bonus.target)) {
          errors.push(`${at}.target: ${PARAMETERS.join(' / ')} のいずれかが必要です（値: ${show(bonus.target)}）`);
        }
        if (typeof bonus.value !== 'number' || !Number.isFinite(bonus.value)) {
          errors.push(`${at}.value: 数値が必要です（値: ${show(bonus.value)}）`);
        }
      });
    }
    if (!Array.isArray(card.effects) || card.effects.length !== EFFECT_SLOT_COUNT) {
      const len = Array.isArray(card.effects) ? `${card.effects.length}件` : show(card.effects);
      errors.push(`${where}.effects: 効果スロットはちょうど${EFFECT_SLOT_COUNT}件必要です（現在: ${len}）。未設定のスロットは { "empty": true } で表してください`);
      return;
    }
    card.effects.forEach((effect, j) => {
      const at = `${where}.effects[${j}]`;
      if (!isPlainObject(effect)) {
        errors.push(`${at}: 効果はオブジェクトで定義してください（空スロットは { "empty": true }）`);
        return;
      }
      if (isEmptySlot(effect)) return;
      if (effect.empty !== undefined) {
        errors.push(`${at}.empty: 空スロットにする場合は true を指定してください（値: ${show(effect.empty)}）`);
      }
      if (!actions.has(effect.type)) {
        errors.push(`${at}.type: action_types.json に存在しない効果種類です（値: ${show(effect.type)}）`);
      }
      if (!PARAMETERS.includes(effect.target)) {
        errors.push(`${at}.target: ${PARAMETERS.join(' / ')} のいずれかが必要です（値: ${show(effect.target)}）`);
      }
      if (!isNonNegativeInteger(effect.max_count)) {
        errors.push(`${at}.max_count: 0以上の整数が必要です（値: ${show(effect.max_count)}）`);
      }
      if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
        errors.push(`${at}.value: 数値が必要です（値: ${show(effect.value)}）`);
      }
    });
  });
  return errors;
}

/** 3種類のデータをまとめて検証し、問題があれば DataValidationError を投げる */
export function validateAll({ plans, actionTypes, cards }) {
  const errors = [...validatePlans(plans), ...validateActionTypes(actionTypes)];
  if (errors.length === 0) {
    errors.push(...validateCards(cards, {
      planNames: plans.map((p) => p.name),
      actionNames: actionTypes.map((a) => a.name),
    }));
  }
  if (errors.length > 0) throw new DataValidationError(errors);
}

/** 行動回数の入力値を検証する。問題がある項目名とメッセージの配列を返す */
export function validateActionCounts(actionCounts, actionNames) {
  const errors = [];
  for (const name of actionNames) {
    const v = actionCounts[name];
    if (!isNonNegativeInteger(v)) {
      errors.push({ name, message: `${name}：0以上の整数を入力してください` });
    }
  }
  return errors;
}
