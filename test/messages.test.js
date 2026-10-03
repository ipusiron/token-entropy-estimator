import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load, core } from './load.js';

const { MESSAGES, t } = load('js/messages.js').TokenMessages;
const TE = core();
const html = read('index.html');
// かな・カタカナ・漢字・全角の記号（記号の定数は使わないので、当たるのは文言だけ）
const JAPANESE = new RegExp('[' + [[0x3000, 0x303f], [0x3040, 0x30ff], [0x3400, 0x9fff], [0xff00, 0xffef]]
  .map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('画面の文言は messages.js に集め、ほかの JS のコード（コメント以外）に日本語を書かない', () => {
  for (const f of ['script.js', 'js/entropy-core.js', 'js/samples.js', 'js/theme.js', 'js/theme-init.js', 'js/i18n.js']) {
    const lines = stripComments(read(f)).split('\n');
    const hit = lines.findIndex((l) => JAPANESE.test(l));
    assert.equal(hit, -1, `${f}:${hit + 1} ${lines[hit]}`);
  }
});

test('script.js・theme.js が使うキーは、すべて日本語の辞書にある（組み立てるキーも含む）', () => {
  const keys = new Set();
  for (const f of ['script.js', 'js/theme.js']) for (const m of read(f).matchAll(/\bt\('([\w.]+)'/g)) keys.add(m[1]);
  for (const v of ['none', 'meets', 'below', 'pattern', 'notApplicable', 'unknown', 'noThreshold']) keys.add(`verdict.${v}`);
  for (const f of ['uuid', 'uuidNil', 'uuidMax', 'uuidOther', 'jwt', 'github', 'digits', 'hex', 'base32', 'base64', 'base64url', 'classes', 'nonAscii',
    'specified']) keys.add(`format.${f}`);
  for (const c of [...Object.keys(TE.OVERRIDES), 'base64url', 'custom', 'classes']) keys.add(`cs.${c}`);
  for (const c of ['lower', 'upper', 'digits', 'symbols', 'space']) keys.add(`cls.${c}`);
  for (const w of ['truncated', 'uuidTime', 'githubChecksum', 'nonAscii', 'badCustomSize', 'decodedText', 'hashLength', 'prefix', 'allSame', 'repeated',
    'sequence', 'keyboard', 'lowVariety', 'human']) keys.add(`w.${w}`);
  for (const b of [128, 160, 256, 512]) keys.add(`hash.${b}`);
  for (const s of [...TE.SCENARIOS.map((x) => x.id), 'custom']) keys.add(`sc.${s}`);
  for (const s of Object.keys(TE.SCANNERS)) keys.add(`scan.${s}`);
  for (const u of ['underSecond', 'seconds', 'minutes', 'hours', 'days', 'years']) keys.add(`dur.${u}`);
  for (const s of ['man', 'oku', 'cho', 'kei', 'thousand', 'million', 'billion', 'trillion']) keys.add(`scale.${s}`);
  const ja = MESSAGES.ja;
  const missing = [...keys].filter((k) => !(k in ja) && !k.startsWith('scale.') && !['thousand', 'million', 'billion', 'trillion'].includes(k));
  assert.deepEqual(missing.filter((k) => !/^scale\.(thousand|million|billion|trillion)$/.test(k)), []);
  for (const s of ['man', 'oku', 'cho', 'kei']) assert.ok(`scale.${s}` in ja, s);
  assert.ok(keys.size > 80, String(keys.size));
});

test('index.html の data-i18n のキーは辞書にあり、HTML に書いた日本語は辞書の日本語と同じ', () => {
  const pairs = [...html.matchAll(/data-i18n="([\w.]+)">([^<]*)</g)].map((m) => [m[1], m[2]]);
  assert.ok(pairs.length > 60, String(pairs.length));
  for (const [k, text] of pairs) {
    assert.ok(k in MESSAGES.ja, k);
    assert.equal(text, MESSAGES.ja[k], k);
  }
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const part of m[1].split(';')) assert.ok(part.split(':')[1] in MESSAGES.ja, part);
  }
});

test('置き場所 {name} を値で埋める。未知のキーはキーのまま', () => {
  assert.equal(t('bits.value', { bits: '95.27' }), '95.27ビット');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('verdict.meets', {}), '基準（{std}ビット）以上です');
});
