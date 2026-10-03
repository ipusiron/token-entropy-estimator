import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load } from './load.js';

const { MESSAGES } = load('js/messages.js').TokenMessages;
const I18N = load('js/i18n.js').TokenI18n;
const JAPANESE = new RegExp('[' + [[0x3000, 0x303f], [0x3040, 0x30ff], [0x3400, 0x9fff], [0xff00, 0xffef]]
  .map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']');
// 数の区切り（万・億… と thousand・million…）は言語ごとに違うキーを持つ
const SCALE = /^scale\./;

test('日本語と英語の辞書は同じキーを持ち、置き場所（{name}）もそろう（数の区切りは言語ごと）', () => {
  const ja = Object.keys(MESSAGES.ja).filter((k) => !SCALE.test(k));
  const en = Object.keys(MESSAGES.en).filter((k) => !SCALE.test(k));
  assert.deepEqual([...en].sort(), [...ja].sort());
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of ja) assert.equal(ph(MESSAGES.en[k]), ph(MESSAGES.ja[k]), k);
  assert.deepEqual(Object.keys(MESSAGES.ja).filter((k) => SCALE.test(k)), ['scale.man', 'scale.oku', 'scale.cho', 'scale.kei']);
  assert.deepEqual(Object.keys(MESSAGES.en).filter((k) => SCALE.test(k)), ['scale.thousand', 'scale.million', 'scale.billion', 'scale.trillion']);
  assert.ok(ja.length >= 200, String(ja.length));
});

test('英語の文言に日本語の文字がない（言語の切り替えボタンの「日本語」だけは例外）', () => {
  for (const [k, v] of Object.entries(MESSAGES.en)) {
    if (k === 'ui.langButton') continue;
    assert.doesNotMatch(v, JAPANESE, k);
  }
  assert.equal(MESSAGES.en['ui.langButton'], '日本語');
  assert.equal(MESSAGES.ja['ui.langButton'], 'EN');
});

test('index.html の日本語の文字は、すべて辞書のキーで差し替わる', () => {
  const html = read('index.html');
  // data-i18n の要素の中身と、data-i18n-attr で差し替える属性を除いて、日本語が残らない
  const stripped = html
    .replace(/<([a-z0-9]+)\b[^>]*\bdata-i18n="[\w.]+"[^>]*>[^<]*<\/\1>/g, '')
    .replace(/\b(placeholder|aria-label|title)="[^"]*"/g, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const lines = stripped.split('\n').filter((l) => JAPANESE.test(l));
  assert.deepEqual(lines, []);
});

test('初期の言語: ?lang= → 保存した選択 → ブラウザーの言語（日本語以外は英語）', () => {
  assert.equal(I18N.initialLanguage('?lang=en', 'ja', ['ja-JP']), 'en');
  assert.equal(I18N.initialLanguage('?x=1&lang=ja', 'en', ['en-US']), 'ja');
  assert.equal(I18N.initialLanguage('?lang=fr', null, ['ja-JP']), 'ja');
  assert.equal(I18N.initialLanguage('', 'en', ['ja-JP']), 'en');
  assert.equal(I18N.initialLanguage('', null, ['ja']), 'ja');
  assert.equal(I18N.initialLanguage('', null, ['fr-FR', 'ja']), 'en');
  assert.equal(I18N.initialLanguage('', 'xx', []), 'en');
});
