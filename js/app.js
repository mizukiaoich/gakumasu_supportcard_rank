import { PARAMETERS } from './constants.js';
import { loadGameData } from './data-loader.js';
import { validateActionCounts, DataValidationError } from './validator.js';
import { calculateForPlan } from './calculator.js';
import { rankByPriority, rankByTotal, PRIORITY_TIEBREAK_TEXT, TOTAL_TIEBREAK_TEXT } from './ranking.js';
import { createCardImage } from './card-image.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
};
const fmt = (n) => n.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
const paramBadge = (p) => el('span', { class: `param-badge param-${p.toLowerCase()}`, text: p });

const state = {
  data: null,
  results: null, // 直近に計算した結果
  selectedId: null,
};

/* ---------- 入力フォーム ---------- */

function renderPlanOptions(plans) {
  const box = $('plan-options');
  box.replaceChildren(...plans.map((plan, i) => {
    const input = el('input', { type: 'radio', name: 'plan', value: plan.name, id: `plan-${i}` });
    if (i === 0) input.checked = true;
    return el('label', { class: 'plan-option', for: `plan-${i}` }, [input, el('span', { text: plan.name })]);
  }));
}

function renderPrioritySelects() {
  const first = $('priority-first');
  const second = $('priority-second');
  for (const select of [first, second]) {
    select.replaceChildren(...PARAMETERS.map((p) => el('option', { value: p, text: p })));
  }
  first.value = PARAMETERS[0];
  second.value = PARAMETERS[1];
  syncPriorityOptions();
  first.addEventListener('change', () => {
    // 第一優先と同じ値が第二優先に選ばれていたら、別の値へ自動で切り替える
    if (second.value === first.value) second.value = PARAMETERS.find((p) => p !== first.value);
    syncPriorityOptions();
  });
  second.addEventListener('change', syncPriorityOptions);
}

/** 第二優先で第一優先と同じ値を選べないようにする */
function syncPriorityOptions() {
  const firstValue = $('priority-first').value;
  for (const opt of $('priority-second').options) opt.disabled = opt.value === firstValue;
}

function renderActionInputs(actionTypes) {
  const list = $('action-list');
  list.replaceChildren(...actionTypes.map((action, i) => {
    const id = `action-${i}`;
    const input = el('input', {
      type: 'number', id, min: '0', step: '1', inputmode: 'numeric',
      value: String(action.default ?? 0), class: 'count-input',
      dataset: { action: action.name },
    });
    const minus = el('button', { type: 'button', class: 'count-btn', 'aria-label': `${action.name}を1減らす`, text: '－' });
    const plus = el('button', { type: 'button', class: 'count-btn', 'aria-label': `${action.name}を1増やす`, text: '＋' });
    const step = (delta) => {
      const current = Number.parseInt(input.value, 10);
      const base = Number.isNaN(current) ? 0 : current;
      input.value = String(Math.max(0, base + delta));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(1));
    return el('li', { class: 'action-item' }, [
      el('label', { class: 'action-name', for: id }, [
        action.name,
        ...(action.description ? [el('span', { class: 'action-desc', text: action.description })] : []),
      ]),
      el('div', { class: 'counter' }, [minus, input, plus]),
    ]);
  }));
}

/** 入力値を読み取る。行動回数は整数として解釈できない場合 NaN のまま返し、検証で弾く */
function readConditions() {
  const plan = document.querySelector('input[name="plan"]:checked')?.value ?? null;
  const first = $('priority-first').value;
  const second = $('priority-second').value;
  const actionCounts = {};
  for (const input of document.querySelectorAll('.count-input')) {
    const raw = input.value.trim();
    actionCounts[input.dataset.action] = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  }
  return { plan, first, second, actionCounts };
}

function validateConditions(cond) {
  const messages = [];
  const invalidActions = [];
  if (!cond.plan) messages.push('育成プランを選択してください。');
  if (!PARAMETERS.includes(cond.first) || !PARAMETERS.includes(cond.second)) {
    messages.push('パラメータ優先順位を選択してください。');
  } else if (cond.first === cond.second) {
    messages.push('第一優先と第二優先には異なるパラメータを選んでください。');
  }
  for (const err of validateActionCounts(cond.actionCounts, state.data.actionTypes.map((a) => a.name))) {
    messages.push(err.message);
    invalidActions.push(err.name);
  }
  return { messages, invalidActions };
}

function showFormErrors({ messages, invalidActions }) {
  const box = $('form-error');
  for (const input of document.querySelectorAll('.count-input')) {
    const invalid = invalidActions.includes(input.dataset.action);
    input.classList.toggle('is-invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
  }
  if (messages.length === 0) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  box.replaceChildren(
    el('strong', { text: '入力内容を確認してください。' }),
    el('ul', {}, messages.map((m) => el('li', { text: m }))),
  );
  box.hidden = false;
}

/* ---------- ランキング表示 ---------- */

const COLUMNS = ['順位', '画像', 'カード名', 'レアリティ', 'Vo', 'Da', 'Vi', '総合'];

function renderTable(table, ranked, highlight = []) {
  const thead = el('thead', {}, [el('tr', {}, COLUMNS.map((c) => {
    const th = el('th', { scope: 'col', class: `col-${PARAMETERS.includes(c) ? c.toLowerCase() : 'base'}` });
    th.append(PARAMETERS.includes(c) ? paramBadge(c) : c);
    if (highlight.includes(c)) th.classList.add('is-priority');
    return th;
  }))]);

  const rows = ranked.length === 0
    ? [el('tr', {}, [el('td', { colspan: String(COLUMNS.length), class: 'empty-row', text: 'このプランに該当するカードが登録されていません。' })])]
    : ranked.map((r, i) => {
      const nameBtn = el('button', { type: 'button', class: 'card-name-btn', text: r.card.name });
      if (r.card.is_sample) nameBtn.append(el('span', { class: 'sample-tag', text: 'サンプル' }));
      const tr = el('tr', { class: 'ranking-row', dataset: { cardId: r.card.id } }, [
        el('td', { class: 'col-rank' }, [el('span', { class: `rank-badge rank-${i + 1}`, text: String(i + 1) })]),
        el('td', { class: 'col-image' }, [createCardImage(r.card, 'sm')]),
        el('td', { class: 'col-name' }, [nameBtn]),
        el('td', { class: 'col-rarity' }, [el('span', { class: 'rarity', text: r.card.rarity })]),
        ...PARAMETERS.map((p) => el('td', {
          class: `num col-${p.toLowerCase()}${highlight.includes(p) ? ' is-priority' : ''}`,
          'data-label': p, text: fmt(r.scores[p]),
        })),
        el('td', { class: 'num col-total', 'data-label': '総合', text: fmt(r.total) }),
      ]);
      if (r.card.id === state.selectedId) tr.classList.add('is-selected');
      tr.addEventListener('click', () => showDetail(r.card.id, true));
      return tr;
    });

  table.replaceChildren(thead, el('tbody', {}, rows));
}

function renderResults(cond) {
  const results = calculateForPlan(state.data.cards, cond.plan, cond.actionCounts, state.data.countSources);
  state.results = { cond, list: results };

  $('result-conditions').textContent = `育成プラン：${cond.plan} ／ 対象カード：${results.length}枚 ／ 完凸状態で計算`;
  $('priority-title').textContent = `優先パラメータランキング：第一優先 ${cond.first} ／ 第二優先 ${cond.second}`;
  $('priority-tiebreak').textContent = PRIORITY_TIEBREAK_TEXT;
  $('total-tiebreak').textContent = TOTAL_TIEBREAK_TEXT;

  renderTable(document.querySelector('[data-ranking="priority"]'), rankByPriority(results, cond.first, cond.second), [cond.first, cond.second]);
  renderTable(document.querySelector('[data-ranking="total"]'), rankByTotal(results));

  // 以前選択していたカードが今回も対象なら詳細を更新、そうでなければ詳細をリセット
  if (!results.some((r) => r.card.id === state.selectedId)) state.selectedId = null;
  showDetail(state.selectedId, false);

  $('results-empty').hidden = true;
  $('results-body').hidden = false;
  $('stale-notice').hidden = true;
}

function showDetail(cardId, scroll) {
  const content = $('detail-content');
  const result = state.results?.list.find((r) => r.card.id === cardId);
  state.selectedId = result ? cardId : null;
  for (const tr of document.querySelectorAll('.ranking-row')) {
    tr.classList.toggle('is-selected', tr.dataset.cardId === state.selectedId);
  }
  if (!result) {
    content.replaceChildren(el('p', { class: 'detail-placeholder', text: 'ランキング内のカードを選択すると、評価値とイベント効果・6つの効果（初期評価を含む）の内訳が表示されます。' }));
    return;
  }
  const { card, scores, total, breakdown, eventBreakdown } = result;
  const cond = state.results.cond;

  const head = el('div', { class: 'detail-head' }, [
    createCardImage(card, 'lg'),
    el('div', { class: 'detail-meta' }, [
      el('p', { class: 'detail-name' }, [card.name, ...(card.is_sample ? [el('span', { class: 'sample-tag', text: 'サンプル' })] : [])]),
      el('dl', { class: 'detail-attrs' }, [
        el('dt', { text: 'レアリティ' }), el('dd', { text: card.rarity }),
        el('dt', { text: '育成プラン' }), el('dd', { text: card.plan }),
      ]),
      el('ul', { class: 'score-tiles' }, [
        ...PARAMETERS.map((p) => el('li', { class: `score-tile score-${p.toLowerCase()}` }, [
          el('span', { class: 'score-label', text: `${p}評価値` }),
          el('span', { class: 'score-value', text: fmt(scores[p]) }),
        ])),
        el('li', { class: 'score-tile score-total' }, [
          el('span', { class: 'score-label', text: '総合評価値' }),
          el('span', { class: 'score-value', text: fmt(total) }),
        ]),
      ]),
    ]),
  ]);

  const headers = ['No.', '効果種類', '対象', '最大発動回数', '入力された行動回数', '実際の発動回数', '1回あたりの上昇値', '今回の上昇値'];
  const effectRow = (b) => {
    if (b.empty) {
      return el('tr', { class: 'is-empty-slot' }, [
        el('td', { class: 'num', text: String(b.no) }),
        el('td', { colspan: String(headers.length - 1), text: '空スロット（効果なし・計算対象外）' }),
      ]);
    }
    if (b.fixed) {
      return el('tr', { class: 'is-fixed' }, [
        el('td', { class: 'num', text: String(b.no) }),
        el('td', {}, [b.type, el('span', { class: 'count-from', text: '（固定加算・行動回数に関係なし）' })]),
        el('td', {}, [paramBadge(b.target)]),
        el('td', { class: 'num', text: b.maxCount === null ? '—' : fmt(b.maxCount) }),
        el('td', { class: 'num', text: '—' }),
        el('td', { class: 'num', text: fmt(b.actualCount) }),
        el('td', { class: 'num', text: fmt(b.value) }),
        el('td', { class: 'num contribution', text: `${b.target} +${fmt(b.contribution)}` }),
      ]);
    }
    const capped = b.inputCount > b.maxCount;
    return el('tr', {}, [
      el('td', { class: 'num', text: String(b.no) }),
      el('td', {}, [b.type, ...(b.countFrom !== b.type
        ? [el('span', { class: 'count-from', text: `（${b.countFrom}の回数）` })]
        : [])]),
      el('td', {}, [paramBadge(b.target)]),
      el('td', { class: 'num', text: fmt(b.maxCount) }),
      el('td', { class: 'num', text: fmt(b.inputCount) }),
      el('td', { class: `num${capped ? ' is-capped' : ''}`, title: capped ? '最大発動回数で頭打ち' : '' }, [
        fmt(b.actualCount), ...(capped ? [el('span', { class: 'cap-note', text: '（上限）' })] : []),
      ]),
      el('td', { class: 'num', text: fmt(b.value) }),
      el('td', { class: 'num contribution', text: `${b.target} +${fmt(b.contribution)}` }),
    ]);
  };
  const effectTable = (className, label, list) => el('div', { class: 'table-scroll', tabindex: '0', 'aria-label': label }, [
    el('table', { class: className }, [
      el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { scope: 'col', text: h })))]),
      el('tbody', {}, list.map(effectRow)),
    ]),
  ]);

  content.replaceChildren(
    head,
    el('h4', { class: 'breakdown-title', text: '6つの効果の内訳' }),
    el('p', { class: 'breakdown-help', text: `実際の発動回数 = MIN(入力された行動回数, 最大発動回数)、今回の上昇値 = 実際の発動回数 × 1回あたりの上昇値。初期評価など固定加算の効果は行動回数に関係なく1回だけ加算（育成プラン：${cond.plan}）` }),
    effectTable('breakdown-table', '効果の内訳表', breakdown),
    el('h4', { class: 'breakdown-title', text: 'イベント効果の内訳' }),
    eventBreakdown.length === 0
      ? el('p', { class: 'event-none', text: 'イベント効果なし' })
      : effectTable('event-table', 'イベント効果の内訳表', eventBreakdown),
  );
  if (scroll) $('card-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- 初期化 ---------- */

function showLoadError(error) {
  const messages = error instanceof DataValidationError ? error.messages : [error.message];
  $('load-error-list').replaceChildren(...messages.map((m) => el('li', { text: m })));
  $('load-error').hidden = false;
  console.error(error);
}

function showSampleNotice(cards) {
  const sampleCount = cards.filter((c) => c.is_sample).length;
  if (sampleCount === 0) return;
  $('sample-notice-text').textContent = sampleCount === cards.length
    ? '現在登録されているカードはすべて動作確認用のダミーデータです。カード名・効果・数値は実際のゲームデータではありません。'
    : `登録カード${cards.length}枚のうち${sampleCount}枚は動作確認用のダミーデータ（「サンプル」表示）です。実際のゲームデータではありません。`;
  $('sample-notice').hidden = false;
}

async function init() {
  try {
    state.data = await loadGameData();
  } catch (error) {
    showLoadError(error);
    return;
  }
  const { plans, actionTypes, cards } = state.data;
  showSampleNotice(cards);
  renderPlanOptions(plans);
  renderPrioritySelects();
  renderActionInputs(actionTypes);

  const form = $('condition-form');
  const markStale = () => {
    if (state.results) $('stale-notice').hidden = false;
  };
  form.addEventListener('input', markStale);
  form.addEventListener('change', markStale);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const cond = readConditions();
    const check = validateConditions(cond);
    showFormErrors(check);
    if (check.messages.length > 0) return;
    try {
      renderResults(cond);
    } catch (error) {
      showLoadError(error);
    }
  });
  $('calculate-button').disabled = false;
  document.body.dataset.ready = 'true';
}

init();
