import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAll } from '../../js/validator.js';

const load = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), 'utf8'));

test('data/ 配下のJSONを読み込め、検証エラーがない', async () => {
  const plans = await load('plans.json');
  const actionTypes = await load('action_types.json');
  const cards = await load('support_cards.json');
  assert.doesNotThrow(() => validateAll({ plans, actionTypes, cards }));
  assert.deepEqual(plans.map((p) => p.name), ['センス', 'ロジック', 'アノマリー']);
  assert.deepEqual(actionTypes.map((a) => a.name), ['レッスン', 'SPレッスン', '授業', 'おでかけ', '相談', '強化', '削除', '活動支給', '休む']);
});

test('ダミーカードはすべて is_sample: true で、名前でもサンプルと分かる', async () => {
  const cards = await load('support_cards.json');
  for (const c of cards.filter((x) => x.id.startsWith('sample_'))) {
    assert.equal(c.is_sample, true, c.id);
    assert.match(c.name, /サンプル/, c.id);
  }
});
