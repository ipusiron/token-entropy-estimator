import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const TE = core();

test('目標のビット数に必要な長さ（128ビット: 16進数32字・Base32 26字・英数字22字・base64url 22字・数字39字・印字できる ASCII 20字）', () => {
  const k = (id) => TE.GEN_ALPHABETS[id].length;
  assert.deepEqual(['hex', 'base32', 'base62', 'base64url', 'digits', 'printable'].map((id) => k(id)), [16, 32, 62, 64, 10, 94]);
  assert.deepEqual(['hex', 'base32', 'base62', 'base64url', 'digits', 'printable'].map((id) => TE.requiredLength(128, k(id))), [32, 26, 22, 22, 39, 20]);
  assert.deepEqual([64, 112, 160, 256].map((b) => TE.requiredLength(b, 62)), [11, 19, 27, 43]);
  // ちょうど割り切れるときに1文字多くしない
  assert.equal(TE.requiredLength(128, 16), 32);
  assert.equal(TE.requiredLength(130, 32), 26);
  // 文字はすべて違う
  for (const a of Object.values(TE.GEN_ALPHABETS)) assert.equal(new Set(a).size, a.length);
});

test('剰余の偏り: 256 を割り切れない文字の数では、先頭の r 文字が1回多く出る', () => {
  const m62 = TE.moduloBias(62);
  assert.deepEqual([m62.remainder, m62.ratio, m62.pHigh, m62.pLow], [8, 1.25, 5 / 256, 4 / 256]);
  assert.ok(Math.abs(m62.minEntropyLoss - (Math.log2(62) + Math.log2(5 / 256))) < 1e-12);
  assert.ok(Math.abs(m62.minEntropyLoss * 32 - 8.84) < 0.01);
  for (const k of [16, 32, 64]) assert.deepEqual(TE.moduloBias(k), { remainder: 0, ratio: 1, minEntropyLoss: 0 });
  assert.deepEqual([TE.moduloBias(10).remainder, TE.moduloBias(94).remainder, TE.moduloBias(94).ratio], [6, 68, 1.5]);
});

test('生成（棄却法）: 0〜255 を1回ずつ渡すと、英数字62種がちょうど4回ずつ出る（248以上は捨てる）', () => {
  let next = 0;
  const seq = (buf) => {
    for (let i = 0; i < buf.length; i++) buf[i] = next++ % 256;
    return buf;
  };
  const s = TE.generate('base62', 248, seq);
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  assert.equal(counts.size, 62);
  assert.ok([...counts.values()].every((c) => c === 4));
  // 最初の62文字は文字の集合の順
  next = 0;
  assert.equal(TE.generate('base62', 62, seq), TE.GEN_ALPHABETS.base62);
  // 捨てる値（248〜255）だけが続いても、次の値で埋める
  let calls = 0;
  const high = (buf) => {
    calls++;
    buf.fill(calls < 3 ? 250 : 1);
    return buf;
  };
  assert.equal(TE.generate('base62', 4, high), '1111');
});

test('生成した文字列は、指定した文字の集合と長さで、ツール自身の見積もりと一致する', () => {
  const rb = (buf) => {
    for (let i = 0; i < buf.length; i++) buf[i] = (i * 37 + 11) % 256;
    return buf;
  };
  for (const [id, len] of [['hex', 32], ['base62', 22], ['base64url', 22], ['digits', 39]]) {
    const s = TE.generate(id, len, rb);
    assert.equal([...s].length, len);
    assert.ok([...s].every((ch) => TE.GEN_ALPHABETS[id].includes(ch)), id);
  }
  assert.equal(TE.generate('nope', 10, rb), null);
  assert.equal(TE.generate('hex', 0, rb), null);
});
