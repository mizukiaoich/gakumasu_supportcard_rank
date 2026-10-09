import { PARAMETERS, EFFECT_SLOT_COUNT } from './constants.js';

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

/**
 * 効果種類の定義（effect_types.json）を検証する。
 * 例: { "name": "VoSP終了時", "count_from": "VoSPレッスン" }
 *   → 効果「VoSP終了時」の発動回数には、行動「VoSPレッスン」の入力回数を使う
 * 例: { "name": "初期評価", "fixed": true }
 *   → 行動回数に関係なく value を1回だけ加算する（max_count は不要）
 */
export function validateEffectTypes(effectTypes, actionNames, file = 'effect_types.json') {
  const errors = [];
  if (!Array.isArray(effectTypes)) return [`${file}: 効果種類を配列で定義してください（なしの場合は []）`];
  const actions = new Set(actionNames);
  const seen = new Set();
  effectTypes.forEach((effectType, i) => {
    const where = `${file}: [${i}]`;
    if (!isPlainObject(effectType) || !isNonEmptyString(effectType.name)) {
      errors.push(`${where}.name: 空でない文字列が必要です（値: ${show(effectType?.name)}）`);
      return;
    }
    if (seen.has(effectType.name)) errors.push(`${where}.name: "${effectType.name}" が重複しています`);
    if (actions.has(effectType.name)) errors.push(`${where}.name: "${effectType.name}" は action_types.json の行動種類と重複しています`);
    seen.add(effectType.name);
    if (effectType.fixed !== undefined && effectType.fixed !== true) {
      errors.push(`${where}.fixed: 固定加算にする場合は true を指定してください（値: ${show(effectType.fixed)}）`);
    } else if (effectType.fixed === true) {
      if (effectType.count_from !== undefined) {
        errors.push(`${where}: fixed: true の効果種類には count_from を指定できません`);
      }
    } else if (!actions.has(effectType.count_from)) {
      errors.push(`${where}.count_from: action_types.json に存在しない行動種類です（値: ${show(effectType.count_from)}）`);
    }
  });
  return errors;
}

/**
 * カードの効果に使える効果種類名 → 回数を参照する行動種類名 の対応表を作る。
 * 行動種類はそれ自身の回数を、effect_types.json の効果種類は count_from の回数を参照する。
 * 固定加算（fixed: true）の効果種類は null（回数を参照しない）。
 */
export function buildCountSources(actionTypes, effectTypes = []) {
  return Object.fromEntries([
    ...actionTypes.map((a) => [a.name, a.name]),
    ...effectTypes.map((e) => [e.name, e.fixed === true ? null : e.count_from]),
  ]);
}

/** 固定加算の効果種類か（countSources で回数の参照先が null） */
export function isFixedEffectType(countSources, type) {
  return Object.hasOwn(countSources, type) && countSources[type] === null;
}

/** 効果1件（effects の1スロット、または event_bonus の1件）を検証する */
function validateEffect(effect, at, effectTypeSet, countSources, label) {
  const errors = [];
  if (!isPlainObject(effect)) {
    return [`${at}: ${label}はオブジェクトで定義してください${label === '効果' ? '（空スロットは { "empty": true }）' : ''}`];
  }
  if (effect.empty !== undefined) {
    errors.push(`${at}.empty: 空スロットにする場合は true を指定してください（値: ${show(effect.empty)}）`);
  }
  if (!effectTypeSet.has(effect.type)) {
    errors.push(`${at}.type: action_types.json / effect_types.json に存在しない効果種類です（値: ${show(effect.type)}）`);
  }
  if (!PARAMETERS.includes(effect.target)) {
    errors.push(`${at}.target: ${PARAMETERS.join(' / ')} のいずれかが必要です（値: ${show(effect.target)}）`);
  }
  if (isFixedEffectType(countSources, effect.type)) {
    // 固定加算は1回だけ加算するので、max_count は 1 か省略のみ
    if (effect.max_count !== undefined && effect.max_count !== null && effect.max_count !== 1) {
      errors.push(`${at}.max_count: 「${effect.type}」は固定加算（1回のみ）のため、最大発動回数は 1 にするか省略してください（値: ${show(effect.max_count)}）`);
    }
  } else if (!isNonNegativeInteger(effect.max_count)) {
    errors.push(`${at}.max_count: 0以上の整数が必要です（値: ${show(effect.max_count)}）`);
  }
  if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
    errors.push(`${at}.value: 数値が必要です（値: ${show(effect.value)}）`);
  }
  return errors;
}

export function validateCards(cards, { planNames, countSources }, file = 'support_cards.json') {
  const errors = [];
  if (!Array.isArray(cards)) return [`${file}: カードを配列で定義してください`];
  const plans = new Set(planNames);
  const effectTypeSet = new Set(Object.keys(countSources));
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
    if (card.initial_bonus !== undefined) {
      errors.push(`${where}.initial_bonus: 初期評価は effects の中に { "type": "初期評価", "target": "Vo", "value": 65 } の形で記入してください`);
    }
    if (card.event_bonus !== undefined) {
      if (!Array.isArray(card.event_bonus)) {
        errors.push(`${where}.event_bonus: イベント効果は配列で定義してください（例: [{ "type": "初期評価", "target": "Vo", "value": 20 }]、なしの場合は []）`);
      } else {
        card.event_bonus.forEach((effect, j) => {
          const at = `${where}.event_bonus[${j}]`;
          if (isEmptySlot(effect)) {
            errors.push(`${at}: イベント効果に空スロットは使えません。不要な場合は削除してください`);
            return;
          }
          errors.push(...validateEffect(effect, at, effectTypeSet, countSources, 'イベント効果'));
        });
      }
    }
    if (!Array.isArray(card.effects) || card.effects.length !== EFFECT_SLOT_COUNT) {
      const len = Array.isArray(card.effects) ? `${card.effects.length}件` : show(card.effects);
      errors.push(`${where}.effects: 効果スロットはちょうど${EFFECT_SLOT_COUNT}件必要です（現在: ${len}）。未設定のスロットは { "empty": true } で表してください`);
      return;
    }
    card.effects.forEach((effect, j) => {
      const at = `${where}.effects[${j}]`;
      if (isEmptySlot(effect)) return;
      errors.push(...validateEffect(effect, at, effectTypeSet, countSources, '効果'));
    });
  });
  return errors;
}

/** データをまとめて検証し、問題があれば DataValidationError を投げる */
export function validateAll({ plans, actionTypes, effectTypes = [], cards }) {
  const errors = [...validatePlans(plans), ...validateActionTypes(actionTypes)];
  if (errors.length === 0) {
    errors.push(...validateEffectTypes(effectTypes, actionTypes.map((a) => a.name)));
  }
  if (errors.length === 0) {
    errors.push(...validateCards(cards, {
      planNames: plans.map((p) => p.name),
      countSources: buildCountSources(actionTypes, effectTypes),
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
