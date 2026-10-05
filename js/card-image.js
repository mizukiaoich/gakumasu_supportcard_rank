import { resolveSitePath } from './data-loader.js';

function createPlaceholder(card) {
  const ph = document.createElement('div');
  ph.className = 'card-thumb-placeholder';
  ph.setAttribute('role', 'img');
  ph.setAttribute('aria-label', `${card.name}（画像なし）`);
  ph.textContent = 'NO IMAGE';
  return ph;
}

/**
 * カード画像要素を作成する。画像パスはカードデータの image 項目から読み込む。
 * 画像が未設定・読み込み失敗の場合は同じ大きさのプレースホルダーに差し替える。
 */
export function createCardImage(card, size = 'sm') {
  const wrap = document.createElement('div');
  wrap.className = `card-thumb card-thumb-${size}`;
  if (!card.image) {
    wrap.append(createPlaceholder(card));
    return wrap;
  }
  const img = document.createElement('img');
  img.src = resolveSitePath(card.image);
  img.alt = card.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => img.replaceWith(createPlaceholder(card)), { once: true });
  wrap.append(img);
  return wrap;
}
