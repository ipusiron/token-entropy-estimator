import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';

const { TokenTabs } = load('js/tabs.js');

test('URL の #tab= か ?tab= から開くタブを読む（# を先に見る。知らない名前は null）', () => {
  assert.equal(TokenTabs.fromUrl('?tab=batch', ''), 'batch');
  assert.equal(TokenTabs.fromUrl('', '#tab=make'), 'make');
  assert.equal(TokenTabs.fromUrl('?lang=en&tab=more', ''), 'more');
  assert.equal(TokenTabs.fromUrl('?tab=batch', '#tab=single'), 'single');
  assert.equal(TokenTabs.fromUrl('?tab=batch', '#tab=unknown'), 'batch');
  assert.equal(TokenTabs.fromUrl('?tab=BATCH', ''), null);
  assert.equal(TokenTabs.fromUrl('?tab=', ''), null);
  assert.equal(TokenTabs.fromUrl('', ''), null);
  assert.equal(TokenTabs.fromUrl(undefined, undefined), null);
});

test('左右の矢印キーは端で反対の端へ回る。Home・End は最初と最後。ほかのキーは null', () => {
  assert.equal(TokenTabs.nextIndex('ArrowRight', 0, 4), 1);
  assert.equal(TokenTabs.nextIndex('ArrowRight', 3, 4), 0);
  assert.equal(TokenTabs.nextIndex('ArrowLeft', 0, 4), 3);
  assert.equal(TokenTabs.nextIndex('ArrowLeft', 2, 4), 1);
  assert.equal(TokenTabs.nextIndex('Home', 2, 4), 0);
  assert.equal(TokenTabs.nextIndex('End', 0, 4), 3);
  for (const key of ['Enter', ' ', 'Tab', 'ArrowDown', 'ArrowUp']) assert.equal(TokenTabs.nextIndex(key, 1, 4), null, key);
});

// 画面の DOM の代わりに、タブとパネルの最小限の偽物を作る
function fakeDom(selected = 'single') {
  const panels = {};
  const focused = [];
  const tabs = TokenTabs.NAMES.map((name) => {
    panels[`panel-${name}`] = { hidden: name !== selected };
    const attrs = { 'aria-controls': `panel-${name}`, 'aria-selected': String(name === selected) };
    const handlers = {};
    return {
      dataset: { tab: name }, tabIndex: name === selected ? 0 : -1, handlers,
      getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      focus() { focused.push(name); }
    };
  });
  const nav = { querySelectorAll: () => tabs, ownerDocument: { getElementById: (id) => panels[id] } };
  const key = (tab, k) => {
    const e = { key: k, prevented: false, preventDefault() { this.prevented = true; } };
    tab.handlers.keydown(e);
    return e.prevented;
  };
  return { nav, tabs, panels, focused, key };
}

const shown = (d) => Object.entries(d.panels).filter(([, p]) => !p.hidden).map(([id]) => id);
const selectedTabs = (d) => d.tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.dataset.tab);

test('選んだタブだけが aria-selected=true・tabindex=0 になり、そのパネルだけが見える', () => {
  const d = fakeDom();
  const changes = [];
  const api = TokenTabs.init(d.nav, (name) => changes.push(name));
  assert.equal(api.current(), 'single');
  assert.deepEqual(shown(d), ['panel-single']);
  d.tabs[2].handlers.click();
  assert.equal(api.current(), 'make');
  assert.deepEqual(shown(d), ['panel-make']);
  assert.deepEqual(selectedTabs(d), ['make']);
  assert.deepEqual(d.tabs.map((t) => t.tabIndex), [-1, -1, 0, -1]);
  assert.deepEqual(d.focused, [], 'クリックではフォーカスを動かさない');
  api.select('batch');
  assert.deepEqual(shown(d), ['panel-batch']);
  api.select('nothing');
  assert.deepEqual(shown(d), ['panel-single'], '知らない名前は最初のタブ');
  assert.deepEqual(changes, ['single', 'make', 'batch', 'single']);
});

test('キーで移るとフォーカスも移る。関係のないキー（Enter・Space・Tab）は奪わない', () => {
  const d = fakeDom();
  const api = TokenTabs.init(d.nav);
  assert.equal(d.key(d.tabs[0], 'ArrowLeft'), true);
  assert.equal(api.current(), 'more');
  assert.equal(d.key(d.tabs[3], 'ArrowRight'), true);
  assert.equal(api.current(), 'single');
  assert.equal(d.key(d.tabs[0], 'End'), true);
  assert.equal(d.key(d.tabs[3], 'Home'), true);
  assert.deepEqual(d.focused, ['more', 'single', 'more', 'single']);
  for (const k of ['Enter', ' ', 'Tab']) assert.equal(d.key(d.tabs[0], k), false, k);
  assert.equal(api.current(), 'single');
});

test('HTML で aria-selected=true のタブから始める（なければ最初のタブ）', () => {
  const d = fakeDom('batch');
  assert.equal(TokenTabs.init(d.nav).current(), 'batch');
  assert.deepEqual(shown(d), ['panel-batch']);
  const none = fakeDom('none');
  assert.equal(TokenTabs.init(none.nav).current(), 'single');
});
