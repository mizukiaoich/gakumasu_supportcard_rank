// ランディングページ：スマートフォン用ナビゲーションの開閉
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('global-nav');

function setOpen(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.visually-hidden').textContent = open ? 'メニューを閉じる' : 'メニューを開く';
  nav.classList.toggle('is-open', open);
}

toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
// メニュー内のリンクを選んだら閉じる
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
    setOpen(false);
    toggle.focus();
  }
});
