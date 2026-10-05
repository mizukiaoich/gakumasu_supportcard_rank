export const ACTIONS = ['レッスン', 'SPレッスン', '授業', 'おでかけ', '相談', '強化', '削除', '活動支給', '休む'];

export const effect = (type, target, max_count, value) => ({ type, target, max_count, value });
export const EMPTY = { empty: true };

export function counts(overrides = {}) {
  return { ...Object.fromEntries(ACTIONS.map((a) => [a, 0])), ...overrides };
}

/** テスト用のカード（スコアを直接指定したい場合は scored を使う） */
export function card(id, plan, effects) {
  return { id, name: `テスト${id}`, rarity: 'SSR', plan, image: '', effects };
}

export function scored(id, Vo, Da, Vi) {
  return { card: { id }, scores: { Vo, Da, Vi }, total: Vo + Da + Vi };
}
