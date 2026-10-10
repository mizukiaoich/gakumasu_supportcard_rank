export const SKILL_CARD_ACTIONS = [
  '好調効果カード獲得時', '好印象効果カード獲得時', 'やる気効果カード獲得時', '集中効果カード獲得時',
  '元気効果カード獲得時', '強気効果カード獲得時', '温存効果カード獲得時', '全力効果カード獲得時',
];

export const ACTIONS = [
  'Voレッスン', 'Daレッスン', 'Viレッスン', '授業・営業終了時', 'おでかけ', '相談', '活動支給・差し入れ選択時',
  '休む', '特別指導開始時', '試験・オーディション終了時', 'Pアイテム獲得時', 'Pドリンク獲得時', 'Pドリンク交換時',
  'スキル強化時', 'スキル削除時', 'スキルカスタム時', 'スキルチェンジ時', 'スキル（SSR）獲得時',
  'アクティブカード獲得時', 'メンタルカード獲得時', 'アクティブカード強化時', 'メンタルカード強化時',
  ...SKILL_CARD_ACTIONS,
];

// data/effect_types.json と同じ定義（初期評価は固定加算、SP終了時の効果は同じパラメータのレッスン（SPレッスン含む）の回数を参照する）
export const EFFECT_TYPES = [
  { name: '初期評価', fixed: true },
  { name: 'SPレッスン', count_from: { Vo: 'Voレッスン', Da: 'Daレッスン', Vi: 'Viレッスン' }, count_label: '対象パラメータのレッスン回数（Vo→Voレッスン、Da→Daレッスン、Vi→Viレッスン）' },
  { name: 'VoSP終了時', count_from: 'Voレッスン' },
  { name: 'DaSP終了時', count_from: 'Daレッスン' },
  { name: 'ViSP終了時', count_from: 'Viレッスン' },
  { name: 'スキル獲得時', count_from: SKILL_CARD_ACTIONS, count_label: '各効果カード獲得時の合計回数' },
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
