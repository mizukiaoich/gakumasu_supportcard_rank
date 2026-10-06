import { validateAll, buildCountSources } from './validator.js';

// サイトのルート（js/ の1つ上）。GitHub Pages のプロジェクトサイト（/リポジトリ名/）でも
// ドメイン直下でも同じように解決できるよう、このファイル自身の URL を基準にする。
export const SITE_ROOT = new URL('../', import.meta.url);

/** サイトルートからの相対パスを絶対 URL に変換する（データ・画像共通） */
export function resolveSitePath(path) {
  return new URL(path, SITE_ROOT).href;
}

async function fetchJson(path) {
  let res;
  try {
    res = await fetch(resolveSitePath(path), { cache: 'no-cache' });
  } catch (e) {
    throw new Error(`${path} を読み込めませんでした（${e.message}）。ローカルではWebサーバー経由で開いてください。`);
  }
  if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${path} のJSON形式が正しくありません（${e.message}）`);
  }
}

/** 育成プラン・行動種類・効果種類・サポートカードを読み込み、検証して返す */
export async function loadGameData() {
  const [plans, actionTypes, effectTypes, cards] = await Promise.all([
    fetchJson('data/plans.json'),
    fetchJson('data/action_types.json'),
    fetchJson('data/effect_types.json'),
    fetchJson('data/support_cards.json'),
  ]);
  validateAll({ plans, actionTypes, effectTypes, cards });
  return { plans, actionTypes, effectTypes, cards, countSources: buildCountSources(actionTypes, effectTypes) };
}
