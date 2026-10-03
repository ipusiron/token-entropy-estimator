import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const TE = core();
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('シャノンエントロピー: 1文字あたりの値と、長さ n で出せる上限 log2(n)', () => {
  near(TE.shannon([...'A7kLw39mQp8Zr2Tx']).perChar, 4.0);
  near(TE.shannon([...'password123']).perChar, 3.277613436819116);
  near(TE.shannon([...'QWxhZGRpbjpvcGVuIHNlc2FtZQ==']).perChar, 4.378783493486176);
  near(TE.shannon([...'abcd']).maxPerChar, 2);
  assert.deepEqual(TE.shannon([]), { perChar: 0, total: 0, maxPerChar: 0 });
});

test('detect-secrets（Base64 4.5・Hex 3.0、超えたら検出）と gitleaks（3.5）の既定', () => {
  assert.deepEqual(TE.SCANNERS, { detectSecretsBase64: 4.5, detectSecretsHex: 3.0, gitleaks: 3.5 });
  // 英数16字は、本物の乱数でも Base64 側の4.5を超えない（1文字あたり最大 log2(16)=4）
  const s16 = TE.scanners([...'A7kLw39mQp8Zr2Tx']);
  assert.deepEqual([s16.detectSecretsBase64.applies, s16.detectSecretsBase64.hit, s16.detectSecretsHex.applies], [true, false, false]);
  const s32 = TE.scanners([...'G5hQmT9Zs1BcK8rV2xY4nP7uD3jL6wEa']);
  assert.equal(s32.detectSecretsBase64.hit, true);
  // 16進数32字は Hex 側で検出
  assert.equal(TE.scanners([...'3f1a0b2c9d7e4a1f0c5b6d8e2a7c9b1d']).detectSecretsHex.hit, true);
  // 数字だけの16進数は 1.2/log2(n) を引く（16字: 3.25−0.3=2.95 で検出されない）
  const d = TE.scanners([...'1234567890123456']).detectSecretsHex;
  near(d.entropy, 2.95);
  assert.equal(d.hit, false);
  // Base64 側の対象の文字に、記号の ! は入らない
  assert.equal(TE.scanners([...'Password1!']).detectSecretsBase64.applies, false);
  assert.equal(TE.scanners([...'Password1!']).gitleaks.hit, false);
});

test('ちょうどしきい値の値は検出しない（どちらも「より大きい」で検出）', () => {
  // 1文字あたりちょうど4.0（16種が1回ずつ）なら Hex 側（3.0）は検出、gitleaks（3.5）も検出、Base64 側（4.5）は検出しない
  const s = TE.scanners([...'0123456789abcdef']);
  assert.deepEqual([s.detectSecretsHex.hit, s.gitleaks.hit, s.detectSecretsBase64.hit], [true, true, false]);
  // 8種が2回ずつ＝ちょうど3.0。Hex 側は検出しない
  const t = TE.scanners([...'0123abcd0123abcd']);
  near(t.detectSecretsHex.entropy, 3);
  assert.equal(t.detectSecretsHex.hit, false);
});
