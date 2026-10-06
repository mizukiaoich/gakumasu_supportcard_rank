// 評価対象パラメータの定義。表示順・計算対象はこの配列で一元管理する。
export const PARAMETERS = ['Vo', 'Da', 'Vi'];

// 1枚のカードが持つ効果スロット数（初期版は完凸状態のみを対象）
export const EFFECT_SLOT_COUNT = 6;

// 行動回数に関係なく、育成中に1回だけ固定値を加算する評価項目。
// key はカードデータの項目名、label は画面表示名。項目を増やす場合はここに追加する。
export const FIXED_BONUS_TYPES = [
  { key: 'initial_bonus', label: '初期評価' },
  { key: 'event_bonus', label: 'イベント効果' },
];
