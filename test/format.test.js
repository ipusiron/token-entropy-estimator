import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const lines = (f) => read(f).split('\n');
const CODE = ['script.js', 'style.css', 'js/entropy-core.js', 'js/messages.js', 'js/samples.js', 'js/theme.js', 'js/theme-init.js', 'js/i18n.js',
  'test/load.js', 'test/core.test.js', 'test/time.test.js', 'test/scanners.test.js', 'test/html.test.js', 'test/contrast.test.js',
  'test/format.test.js', 'test/messages.test.js', 'test/i18n.test.js', 'test/readme.test.js', 'test/batch.test.js', 'test/generate.test.js',
  'js/tabs.js', 'test/tabs.test.js'];

test('JS・CSS・テストの最長行は160文字以下、index.html は250文字以下（1行に詰め込んだファイルを見つける）', () => {
  for (const f of CODE) {
    const long = lines(f).findIndex((l) => l.length > 160);
    assert.equal(long, -1, `${f}:${long + 1}`);
  }
  assert.equal(lines('index.html').findIndex((l) => l.length > 250), -1);
});

test('主要なファイルの行数の下限と、改行コード（LF）・制御文字', () => {
  const min = { 'index.html': 150, 'style.css': 400, 'script.js': 200, 'js/entropy-core.js': 400, 'js/messages.js': 150 };
  for (const [f, n] of Object.entries(min)) assert.ok(lines(f).length >= n, `${f}: ${lines(f).length}`);
  for (const f of [...CODE, 'index.html']) {
    const s = read(f);
    assert.ok(!s.includes(String.fromCharCode(13)), `${f}: CR`);
    assert.ok(![...s].some((ch) => ch.charCodeAt(0) < 32 && ch !== '\n'), `${f}: control`);
  }
});
