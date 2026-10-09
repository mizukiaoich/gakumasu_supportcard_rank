export const ACTIONS = [
  'Voレッスン', 'Daレッスン', 'Viレッスン', 'VoSPレッスン', 'DaSPレッスン', 'ViSPレッスン',
  '授業', 'おでかけ', '相談', '強化', '削除', '活動支給', '休む',
];

// data/effect_types.json と同じ定義（初期評価は固定加算、SP終了時の効果は各SPレッスンの回数を参照する）
export const EFFECT_TYPES = [
  { name: '初期評価', fixed: true },
  { name: 'VoSP終了時', count_from: 'VoSPレッスン' },
  { name: 'DaSP終了時', count_from: 'DaSPレッスン' },
  { name: 'ViSP終了時', count_from: 'ViSPレッスン' },
];

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
