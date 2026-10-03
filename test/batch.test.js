import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const TE = core();

// 決まった種の乱数でバイト列を埋める（テストを毎回同じにするため。画面では crypto.getRandomValues）
function bytesFrom(seed) {
  const next = TE.xorshift32(seed);
  return (buf) => {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(next() * 256);
    return buf;
  };
}

const randomSet = (seed, n, len, alphabet = 'base62') => {
  const rb = bytesFrom(seed);
  return Array.from({ length: n }, () => TE.generate(alphabet, len, rb)).join('\n');
};

test('同じ個数の乱数の目安: 位置ごとの最小エントロピーは log2(個数) を超えず、個数が多いほど文字の数の log2 に近づく', () => {
  const b100 = TE.baselineMinEntropy(100, 62);
  assert.ok(b100 > 4.0 && b100 < 4.6, String(b100));
  assert.ok(b100 < Math.log2(100));
  const b1000 = TE.baselineMinEntropy(1000, 62);
  assert.ok(b1000 > b100 && b1000 < Math.log2(62), String(b1000));
  assert.equal(TE.baselineMinEntropy(100, 62), b100);
});

test('本物の乱数（英数字32字×100）: 構造は見つからず、位置ごとの最小エントロピーの和は、同じ個数の乱数の目安に近い', () => {
  const r = TE.batchAnalyze(randomSet(1, 100, 32));
  assert.deepEqual([r.count, r.duplicates, r.constantPositions, r.weakPositions, r.verdict], [100, 0, 0, 0, 'none']);
  assert.deepEqual(r.warnings, []);
  assert.ok(Math.abs(r.sumMinEntropy / r.baselineSum - 1) < 0.1, `${r.sumMinEntropy} / ${r.baselineSum}`);
  assert.ok(r.increasingShare > 0.3 && r.increasingShare < 0.7, String(r.increasingShare));
  assert.equal(r.singleBits, 32 * Math.log2(62));
  assert.ok(r.sumMinEntropy < r.singleBits);
});

test('本物の乱数を「構造あり」と誤って判定しない（決まった種で、英数字・16進数・16〜64字・20〜200個の組み合わせ）', () => {
  let seed = 100;
  for (const alphabet of ['base62', 'hex']) {
    for (const len of [16, 32, 64]) {
      for (const n of [20, 100, 200]) {
        const r = TE.batchAnalyze(randomSet(seed++, n, len, alphabet));
        assert.equal(r.verdict, 'none', `${alphabet} ${len} ${n}: ${JSON.stringify(r.warnings)}`);
      }
    }
  }
});

test('連番のトークン: 固定の位置と、増え続ける順番を見つける', () => {
  const text = Array.from({ length: 100 }, (_, i) => (0x5f3a10c0 + i).toString(16).padStart(32, '0')).join('\n');
  const r = TE.batchAnalyze(text);
  const ids = r.warnings.map((w) => w.id);
  assert.ok(ids.includes('batchConstant') && ids.includes('batchIncreasing'), ids.join());
  assert.equal(r.verdict, 'structure');
  assert.equal(r.increasingShare, 1);
  assert.ok(r.constantPositions >= 29, String(r.constantPositions));
  assert.ok(r.sumMinEntropy < 0.1 * r.baselineSum);
});

test('UUID v7（3ミリ秒おきに100個）: 先頭の時刻の部分が固定で、増え続ける。作った UUID は版7で時刻を読める', () => {
  const rb = bytesFrom(7);
  const start = Date.UTC(2026, 9, 4, 0, 0, 0);
  const list = Array.from({ length: 100 }, (_, i) => TE.makeUuidV7(start + i * 3, rb));
  const u = TE.uuidInfo(list[5]);
  assert.deepEqual([u.version, u.variant, u.time], [7, 'rfc9562', new Date(start + 15).toISOString()]);
  assert.equal(TE.analyze(list[0]).bits, 74);
  const r = TE.batchAnalyze(list.join('\n'));
  assert.equal(r.verdict, 'structure');
  assert.ok(r.prefixLength >= 8, String(r.prefixLength));
  assert.equal(r.increasingShare, 1);
});

test('重複・個数の不足・長さの違い・上限', () => {
  const dup = TE.batchAnalyze(`${randomSet(3, 30, 20)}\nAAAAbbbbCCCCddddEEEE\nAAAAbbbbCCCCddddEEEE`);
  assert.ok(dup.warnings.some((w) => w.id === 'batchDuplicates' && w.count === 1));
  const few = TE.batchAnalyze(randomSet(4, 10, 20));
  assert.equal(few.verdict, 'few');
  assert.ok(few.warnings.some((w) => w.id === 'batchFew' && w.min === 20));
  const mixed = TE.batchAnalyze(`${randomSet(5, 25, 20)}\n${randomSet(6, 5, 24)}`);
  assert.ok(mixed.warnings.some((w) => w.id === 'batchLengths' && w.min === 20 && w.max === 24));
  const over = TE.batchAnalyze(randomSet(8, 1001, 8));
  assert.deepEqual([over.count, over.overLimit], [1000, true]);
  assert.equal(TE.batchAnalyze('  \n\n').count, 0);
  // CRLF の改行と前後の空白は無視する
  assert.equal(TE.batchAnalyze(' ab \r\ncd\r\n').count, 2);
});
