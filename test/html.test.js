import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const html = read('index.html');

test('CSP: インラインのスクリプト・スタイルを許さず、外部へつながない。meta で効かない指定は書かない', () => {
  const m = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(m);
  const csp = m[1];
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "connect-src 'none'", "object-src 'none'",
    "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.includes(d), d);
  }
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https:|frame-ancestors/);
  assert.doesNotMatch(html, /X-Frame-Options|X-Content-Type-Options/);
  assert.match(html, /<meta name="referrer" content="no-referrer" \/>/);
  assert.match(html, /<noscript>/);
});

test('インラインのスクリプト・イベントハンドラー・style 属性がない。スクリプトは決まった順に読む（file:// でも動く通常のスクリプト）', () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(html, /type="module"/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['js/theme-init.js', 'js/messages.js', 'js/samples.js', 'js/entropy-core.js', 'js/theme.js', 'script.js']);
  for (const s of scripts.slice(1)) assert.match(html, new RegExp(`<script src="${s}" defer></script>`));
  for (const f of ['script.js', 'js/theme.js', 'js/entropy-core.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
    assert.doesNotMatch(src, /\.cssText|setAttribute\('style'|alert\(|confirm\(/, f);
  }
});

test('画面の要素の id がそろっている（それぞれ1つだけ）', () => {
  const ids = ['token', 'btnClear', 'charset', 'customSizeField', 'customSize', 'standard', 'customBitsField', 'customBits', 'customBitsError', 'valid',
    'validError', 'gpus', 'gpusError', 'customRate', 'customRateError', 'verdict', 'bits', 'bitsKind', 'format', 'alphabet', 'counted', 'perChar',
    'shannon', 'gauge', 'gaugeFill', 'gaugeMark', 'notes', 'timeTable', 'scanTable', 'btnTheme', 'helpDialog', 'helpTitle', 'helpClose'];
  for (const id of ids) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(all).size, all.length);
});

test('ボタンには type、入力欄にはラベル、状態の表示は aria-live、外部リンクは noopener noreferrer', () => {
  for (const m of html.matchAll(/<button\b[^>]*>/g)) assert.match(m[0], /type="button"/, m[0]);
  for (const m of html.matchAll(/<(input|textarea|select)\b[^>]*id="([^"]+)"/g)) assert.match(html, new RegExp(`<label for="${m[2]}"`), m[2]);
  for (const id of ['verdict', 'notes', 'customBitsError', 'validError', 'gpusError', 'customRateError']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-live="polite"`), id);
  }
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="noopener noreferrer"/, m[0]);
  for (const id of ['customBits', 'valid', 'gpus', 'customRate']) assert.match(html, new RegExp(`id="${id}"[^>]*aria-describedby="${id}Error"`), id);
});

test('サンプルのボタンは js/samples.js の順と同じ。ヘルプの ? ボタンには、それぞれの話題がある', () => {
  const buttons = [...html.matchAll(/data-sample="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['uuid4', 'uuid7', 'hex32', 'base64', 'alnum16', 'alnum32', 'jwt', 'github', 'same', 'password']);
  const helps = [...html.matchAll(/class="help-icon" data-help="(\w+)" aria-label="[^"]+"/g)].map((m) => m[1]);
  assert.deepEqual(helps, ['charset', 'standard', 'valid', 'shannon', 'time', 'scanners']);
  for (const h of helps) assert.match(html, new RegExp(`data-help-topic="${h}" hidden`), h);
  assert.match(html, /<dialog id="helpDialog" class="help-dialog" aria-labelledby="helpTitle">/);
  // ? ボタンは label の外に置く（label の中だと、押したときに入力欄へフォーカスが移る）
  assert.doesNotMatch(html, /<label[^>]*>[^<]*<button/);
});

test('判定の基準の選択肢は、ロジックの基準と同じ（既定は128ビット）', async () => {
  const { core } = await import('./load.js');
  const TE = core();
  const options = [...html.matchAll(/<option value="(\w+)" data-i18n="ui\.st\w+"( selected)?/g)].map((m) => [m[1], !!m[2]]);
  assert.deepEqual(options.map((o) => o[0]), [...TE.STANDARDS.map((s) => s.id), 'custom']);
  assert.deepEqual(options.filter((o) => o[1]).map((o) => o[0]), [TE.DEFAULT_STANDARD]);
  const charsets = [...html.matchAll(/<option value="(\w+)" data-i18n="ui\.cs\w+"/g)].map((m) => m[1]);
  assert.deepEqual(charsets, ['auto', ...Object.keys(TE.OVERRIDES), 'custom']);
});
