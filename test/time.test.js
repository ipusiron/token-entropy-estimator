import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const TE = core();
const near = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const years = (log10s) => 10 ** (log10s - Math.log10(TE.SECONDS_PER_YEAR));

test('当たるまでの回数: 有効な値が K 個なら (N+1)/(K+1)、最悪は N−K+1', () => {
  // N=16、K=1 なら平均 8.5 回、最悪 16 回
  const g = TE.guesses(4, 1);
  near(10 ** g.avg, 8.5, 1e-9);
  near(10 ** g.worst, 16, 1e-9);
  // K が N 以上なら1回目で当たる
  assert.deepEqual(TE.guesses(4, 16), { avg: 0, worst: 0 });
  // 桁あふれしない（1万ビット）
  const big = TE.guesses(10000, 1);
  near(big.worst, 10000 * Math.log10(2), 1e-9);
});

test('OWASP の例（64ビット・有効なセッション10万・1万回/秒）は約585年になる', () => {
  const row = TE.timeTable(64, { valid: 1e5 }).find((r) => r.id === 'onlineUnthrottled');
  near(years(row.avg), 584.5362007286192, 1e-6);
});

test('README の例（英数16字・10億回/秒）は約7553億年', () => {
  const bits = TE.analyze('A7kLw39mQp8Zr2Tx').bits;
  const row = TE.timeTable(bits, { customRate: 1e9 }).find((r) => r.id === 'custom');
  near(years(row.avg) / 755323625795.7413, 1, 1e-9);
});

test('攻撃の場面: オフラインの速さは GPU の枚数を掛ける。オンラインは掛けない', () => {
  const one = TE.timeTable(80, { gpus: 1 });
  const ten = TE.timeTable(80, { gpus: 10 });
  assert.deepEqual(one.map((r) => r.id), ['onlineThrottled', 'onlineUnthrottled', 'offlineBcrypt', 'offlineSha256', 'offlineMd5']);
  for (const [a, b] of one.map((r, i) => [r, ten[i]])) {
    const gpu = TE.SCENARIOS.find((s) => s.id === a.id).gpu;
    near(a.avg - b.avg, gpu ? 1 : 0, 1e-12);
  }
  near(one[0].rate * 3600, 100, 1e-9);
  assert.deepEqual(one.slice(2).map((r) => r.rate), [304.8e3, 28353.3e6, 220.6e9]);
});

test('時間の単位: 1秒未満・秒・分・時間・日・年（年は log10 と宇宙の年齢との比）', () => {
  assert.equal(TE.durationParts(-1).unit, 'underSecond');
  const s = TE.durationParts(Math.log10(30));
  assert.equal(s.unit, 'seconds');
  near(s.value, 30, 1e-9);
  assert.equal(TE.durationParts(Math.log10(120)).unit, 'minutes');
  assert.equal(TE.durationParts(Math.log10(7200)).unit, 'hours');
  near(TE.durationParts(Math.log10(86400 * 3)).value, 3, 1e-9);
  const y = TE.durationParts(Math.log10(TE.SECONDS_PER_YEAR * 1.38e10));
  assert.equal(y.unit, 'years');
  near(y.universe, 0, 1e-12);
});

test('大きな数の区切り: 日本語は4桁（万・億・兆・京）、英語は3桁。上限を超えたら10の指数', () => {
  const ja = TE.scaleNumber(Math.log10(7553e8), 'ja');
  assert.equal(ja.scale, 'oku');
  near(ja.value, 7553, 1e-6);
  const en = TE.scaleNumber(Math.log10(7553e8), 'en');
  assert.equal(en.scale, 'billion');
  near(en.value, 755.3, 1e-6);
  assert.equal(TE.scaleNumber(Math.log10(5e19), 'ja').scale, 'kei');
  const exp = TE.scaleNumber(Math.log10(3e21), 'ja');
  assert.equal(exp.exp, 21);
  near(exp.mantissa, 3, 1e-9);
  assert.equal(TE.scaleNumber(Math.log10(3e15), 'en').exp, 15);
  assert.equal(TE.scaleNumber(2, 'ja').scale, '');
  assert.deepEqual(['7553', '75.5', '7.55', '1'].map(Number), [7553.2, 75.53, 7.553, 1].map((v) => Number(TE.roundForDisplay(v))));
});
