import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const css = read('style.css');

function tokens(selector) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, selector);
  const body = css.slice(i, css.indexOf('}', i));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// 文字と下地の組（ライト・ダークとも4.5:1以上）
const PAIRS = [['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['muted', 'surface'], ['muted', 'bg'], ['muted', 'surface-2'],
  ['accent', 'surface'], ['accent', 'surface-2'], ['accent', 'bg'], ['on-accent', 'accent'], ['on-accent', 'accent-hover'], ['meets-text', 'meets-bg'],
  ['below-text', 'below-bg'], ['pattern-text', 'pattern-bg'], ['na-text', 'na-bg'], ['below-text', 'surface']];

const LIGHT = tokens(':root {');
const DARK = tokens(':root[data-theme="dark"] {');
const OS_DARK = tokens(':root:not([data-theme="light"]) {');

test('配色のコントラスト: ライト・ダークとも文字と下地の組が4.5:1以上', () => {
  for (const [name, t] of [['light', LIGHT], ['dark', DARK]]) {
    for (const [a, b] of PAIRS) {
      assert.ok(t[a] && t[b], `${name} ${a}/${b}`);
      assert.ok(ratio(t[a], t[b]) >= 4.5, `${name} ${a}/${b}: ${ratio(t[a], t[b]).toFixed(2)}`);
    }
  }
});

test('ダークの上書きは、明示（data-theme）と OS の設定の2か所で同じ。ライトと同じ名前をすべて上書きする', () => {
  assert.deepEqual(OS_DARK, DARK);
  assert.deepEqual(Object.keys(DARK).sort(), Object.keys(LIGHT).sort());
});

test('入力欄は16px、操作の要素は44px以上。動きを減らす設定に従う', () => {
  assert.match(css, /textarea,\ninput,\nselect \{[^}]*font-size: 16px;[^}]*min-height: 44px;/);
  assert.match(css, /button \{[^}]*min-height: 44px;/);
  assert.match(css, /\.help-icon \{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /min-height: 100dvh;/);
});

test('タブの色は検査した組だけを使う。選ばれていないタブは button の既定（アクセントの下地に白い文字）を打ち消す', () => {
  const rule = (selector) => {
    const i = css.indexOf(`${selector} {`);
    assert.ok(i >= 0, selector);
    return css.slice(i, css.indexOf('}', i));
  };
  // 選ばれていない＝muted／surface（下地は透明で .tabs の surface）、ホバー＝text／surface-2、選ばれた＝on-accent／accent・accent-hover
  assert.match(rule('.tabs'), /background: var\(--surface\);/);
  assert.match(rule('.tab'), /background: transparent;[^}]*color: var\(--muted\);/);
  assert.match(rule('.tab:hover'), /background: var\(--surface-2\);[^}]*color: var\(--text\);/);
  assert.match(rule('.tab[aria-selected="true"]'), /background: var\(--accent\);[^}]*color: var\(--on-accent\);/);
  assert.match(rule('.tab[aria-selected="true"]:hover'), /background: var\(--accent-hover\);/);
  for (const pair of ['muted/surface', 'text/surface-2', 'on-accent/accent', 'on-accent/accent-hover']) {
    assert.ok(PAIRS.some(([a, b]) => `${a}/${b}` === pair), pair);
  }
  // タブの間は、フォーカスの枠の外側（3px＋2px）が隣のタブにかからない広さ
  assert.match(rule('.tabs'), /gap: 8px;[^}]*padding: 6px;/);
});
