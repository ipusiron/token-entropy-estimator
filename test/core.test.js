import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const TE = core();
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
// 既知解答は Python（zlib・uuid・base64・math）で別に計算した値（impl/ref/day048/known_answers.json）

test('文字の集合: 見た文字をすべて含む、いちばん小さい標準の集合を選ぶ', () => {
  const id = (s) => TE.detectAlphabet([...s]).id;
  assert.equal(id('1234567890123456'), 'digits');
  assert.equal(id('3f1a0b2c9d7e4a1f'), 'hex');
  assert.equal(id('3F1A0B2C9D7E4A1F'), 'hex');
  assert.equal(id('deadbeef'), 'hex');
  assert.equal(id('JBSWY3DPEHPK3PXP'), 'base32');
  assert.equal(id('JBSWY3DPEHPK3PXP===='), 'base32');
  assert.equal(id('QWxhZGRpbjpvcGVuIHNlc2FtZQ=='), 'base64');
  assert.equal(id('ab+c/d9Z'), 'base64');
  assert.equal(id('q-8Zr2Tx_A7kLw39mQp8Zr'), 'base64url');
  // 英数字だけは Base64 にしない（以前の不具合: 英数16字が64種と数えられた）
  const a = TE.detectAlphabet([...'A7kLw39mQp8Zr2Tx']);
  assert.deepEqual([a.id, a.size, a.classes], ['classes', 62, ['lower', 'upper', 'digits']]);
  assert.equal(TE.detectAlphabet([...'password123']).size, 36);
  assert.equal(TE.detectAlphabet([...'Password1!']).size, 94);
  assert.equal(TE.detectAlphabet([...'pass word']).size, 27);
  // 大文字と小文字が混ざった16進数の文字は、16進数とみなさない
  assert.equal(TE.detectAlphabet([...'3F1a0B2c']).id, 'classes');
  assert.equal(TE.detectAlphabet([...'パスワード']).id, 'nonAscii');
});

test('ビット数: 埋め草（=）は数えない。コードポイントで数える', () => {
  near(TE.analyze('A7kLw39mQp8Zr2Tx').bits, 95.26714096619, 1e-9);
  near(TE.analyze('password123').bits, 56.86917501586544, 1e-9);
  near(TE.analyze('1234567890123456').bits, 53.150849518197795, 1e-9);
  const b = TE.analyze('QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
  assert.deepEqual([b.alphabet.id, b.counted, b.bits], ['base64', 26, 156]);
  assert.equal(TE.analyze('q-8Zr2Tx_A7kLw39mQp8Zr').bits, 132);
  near(TE.analyze('Password1!').bits, 65.54588851677637, 1e-9);
  assert.equal(TE.analyze('3f1a0b2c9d7e4a1f0c5b6d8e2a7c9b1d').bits, 128);
  // 絵文字1つは1文字（UTF-16 の2単位ではない）
  const e = TE.analyze('ab😀');
  assert.equal(e.length, 3);
  assert.equal(e.alphabet.id, 'nonAscii');
  assert.equal(e.bits, null);
  assert.equal(e.basis, 'unknown');
});

test('UUID: 版を読み、ランダムな部分だけを数える（RFC 9562 の付録の例）', () => {
  const T = '2022-02-22T19:22:22.000Z';
  const r = (s) => TE.analyze(s);
  const v4 = r('919108f7-52d1-4320-9bac-f847db4148a8');
  assert.deepEqual([v4.format, v4.details.version, v4.bits, v4.basis], ['uuid', 4, 122, 'bits']);
  const v7 = r('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
  assert.deepEqual([v7.details.version, v7.bits, v7.details.time], [7, 74, T]);
  assert.ok(v7.warnings.some((w) => w.id === 'uuidTime' && w.time === T));
  for (const [s, v] of [['C232AB00-9414-11EC-B3C8-9F6BDECED846', 1], ['1EC9414C-232A-6B00-B3C8-9F6BDECED846', 6]]) {
    const u = r(s);
    assert.deepEqual([u.details.version, u.details.time, u.bits, u.basis], [v, T, null, 'notApplicable']);
  }
  for (const [s, v] of [['5df41881-3aed-3515-88a7-2f4a814cf09e', 3], ['2ed6657d-e927-568b-95e1-2665a8aea6a2', 5],
    ['2489E9AD-2EE2-8E00-8EC9-32D5F69181C0', 8]]) {
    const u = r(s);
    assert.deepEqual([u.details.version, u.bits, u.basis], [v, null, 'notApplicable']);
  }
  assert.equal(r('00000000-0000-0000-0000-000000000000').details.kind, 'nil');
  assert.equal(r('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF').details.kind, 'max');
  // 変種が RFC 9562 でない（先頭が0〜7）
  assert.equal(r('919108f7-52d1-4320-1bac-f847db4148a8').details.kind, 'uuidOther');
});

test('JWT: ヘッダーの alg を読み、エントロピーで測る対象としない（RFC 7519 3.1 の例）', () => {
  const jwt = 'eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ'
    + '.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const r = TE.analyze(jwt);
  assert.deepEqual([r.format, r.details.alg, r.details.typ, r.bits, r.basis], ['jwt', 'HS256', 'JWT', null, 'notApplicable']);
  // ドットが3つに分かれても、ヘッダーが JSON でなければ JWT ではない
  assert.notEqual(TE.analyze('abc.def.ghi').format, 'jwt');
});

test('GitHub のトークン: CRC-32 を Base62（0-9A-Za-z）にしたチェックサムを検算し、ランダムな30文字だけを数える', () => {
  assert.equal(TE.crc32('123456789').toString(16), 'cbf43926');
  assert.equal(TE.base62(0xcbf43926, 6), '3jZRME');
  assert.deepEqual([TE.base62(0, 6), TE.base62(61, 6), TE.base62(62, 6), TE.base62(0xffffffff, 6)], ['000000', '00000z', '000010', '4gfFC3']);
  // 本物と同じ形の文字列をソースに書かない（シークレット検出の誤検知を避ける）ため、実行時に組み立てる
  const random30 = 'A7kLw39mQp8Zr2TxG5hQmT9Zs1BcK8';
  const ok = ['gh', 'p_', random30, '2FyxDi'].join('');
  const r = TE.analyze(ok);
  assert.deepEqual([r.format, r.details.prefix, r.details.checksumOk, r.counted], ['github', 'ghp', true, 30]);
  near(r.bits, 178.62588931160624, 1e-9);
  const bad = TE.analyze(['gh', 'o_', random30, '2FyxDj'].join(''));
  assert.equal(bad.details.checksumOk, false);
  assert.ok(bad.warnings.some((w) => w.id === 'githubChecksum'));
});

test('中身が読める Base64・16進数を知らせる。ハッシュ値と同じ長さの16進数も知らせる', () => {
  const b = TE.analyze('QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
  const d = b.warnings.find((w) => w.id === 'decodedText');
  assert.deepEqual([d.preview, d.bytes, b.basis], ['Aladdin:open sesame', 19, 'pattern']);
  // "Hello, world" の16進数
  assert.equal(TE.analyze('48656c6c6f2c20776f726c64').warnings.find((w) => w.id === 'decodedText').preview, 'Hello, world');
  // ランダムなバイト列は読めない
  assert.ok(!TE.analyze('3f1a0b2c9d7e4a1f0c5b6d8e2a7c9b1d').warnings.some((w) => w.id === 'decodedText'));
  for (const [len, bits] of [[32, 128], [40, 160], [64, 256], [128, 512]]) {
    const r = TE.analyze('a1'.repeat(len / 2));
    assert.ok(r.warnings.some((w) => w.id === 'hashLength' && w.bits === bits), String(len));
  }
});

test('構造の警告: 同じ文字・繰り返し・連続・キーボードの並び・ばらつきの少なさ。判定は「構造あり」', () => {
  const ids = (s) => TE.analyze(s).warnings.map((w) => w.id);
  assert.deepEqual(ids('aaaaaaaaaaaaaaaa'), ['allSame']);
  assert.equal(TE.analyze('aaaaaaaaaaaaaaaa').basis, 'pattern');
  assert.ok(ids('abcabcabcabc').includes('repeated'));
  assert.equal(TE.analyze('abcabcabcabc').warnings.find((w) => w.id === 'repeated').period, 3);
  assert.ok(ids('xK9abcdefQ').includes('sequence'));
  assert.ok(ids('Zp98765tR').includes('sequence'));
  assert.ok(ids('Tqwerty7!').includes('keyboard'));
  assert.ok(ids('aaaaaaaaaaaaaaab').includes('lowVariety'));
  // ランダムな英数字には警告を出さない
  assert.deepEqual(ids('A7kLw39mQp8Zr2Tx'), []);
  assert.deepEqual(ids('G5hQmT9Zs1BcK8rV2xY4nP7uD3jL6wEa'), []);
});

test('本物の乱数に構造の警告をほとんど出さない（決まった種の乱数で各1,000本、0.5%未満）', () => {
  let s = 20261004;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const sets = {
    digits: '0123456789', hex: '0123456789abcdef', base62: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  };
  for (const [name, a] of Object.entries(sets)) {
    for (const n of [16, 32, 64]) {
      let pattern = 0;
      for (let i = 0; i < 1000; i++) {
        const t = Array.from({ length: n }, () => a[Math.floor(next() * a.length)]).join('');
        if (TE.analyze(t).basis === 'pattern') pattern++;
      }
      assert.ok(pattern < 5, `${name}_${n}: ${pattern}`);
    }
  }
});

test('接頭辞らしい部分を知らせ、除いたときのビット数も出す', () => {
  const r = TE.analyze('sk_live_A7kLw39mQp8Zr2TxG5hQ');
  const w = r.warnings.find((x) => x.id === 'prefix');
  assert.equal(w.prefix, 'sk_live_');
  near(w.bitsWithout, 20 * Math.log2(62), 1e-9);
  assert.ok(w.bitsWithout < r.bits);
});

test('文字の集合を指定する（作り方がわかっているとき）。自由な数も、ASCII 以外の文字にも使える', () => {
  near(TE.analyze('A7kLw39mQp8Zr2Tx', { override: 'hex' }).bits, 64);
  near(TE.analyze('パスワード', { override: 'custom', customSize: 100 }).bits, 5 * Math.log2(100));
  assert.deepEqual(TE.analyze('abc', { override: 'custom', customSize: 1 }).warnings.map((w) => w.id), ['badCustomSize']);
  // 指定したときは形式の判定を使わない（UUID も文字の集合で数える）
  near(TE.analyze('919108f7-52d1-4320-9bac-f847db4148a8', { override: 'printable' }).bits, 36 * Math.log2(95));
});

test('空・上限（10,000字）・判定', () => {
  const e = TE.analyze('');
  assert.deepEqual([e.empty, e.bits, TE.verdict(e, 128)], [true, null, 'none']);
  const long = TE.analyze('ab'.repeat(6000));
  assert.deepEqual([long.length, long.truncated, long.warnings[0].id], [10000, true, 'truncated']);
  const r = TE.analyze('A7kLw39mQp8Zr2Tx');
  assert.deepEqual([TE.verdict(r, 64), TE.verdict(r, 96), TE.verdict(r, 95)], ['meets', 'below', 'meets']);
  assert.equal(TE.verdict(TE.analyze('aaaaaaaaaaaaaaaa'), 64), 'pattern');
  assert.deepEqual(TE.STANDARDS.map((s) => [s.id, s.bits]), [['session', 64], ['nist112', 112], ['nist128', 128], ['otp', 160], ['hs256', 256]]);
  assert.equal(TE.standardBits(TE.DEFAULT_STANDARD), 128);
});

test('入力の検証: 基準・個数・速さは、正しくなければ NaN（黙って既定値に戻さない）', () => {
  assert.equal(TE.parseThreshold('128'), 128);
  for (const bad of ['', 'abc', '0', '1025', '64,80', '12.5', '-1']) assert.ok(Number.isNaN(TE.parseThreshold(bad)), bad);
  assert.equal(TE.parseCount('100,000', 1e15), 100000);
  for (const bad of ['0', '-1', '1.5', 'x', '']) assert.ok(Number.isNaN(TE.parseCount(bad, 1e15)), bad);
  assert.ok(Number.isNaN(TE.parseCount('2000000', 1e6)));
  assert.equal(TE.parseRate('1e9'), 1e9);
  assert.equal(TE.parseRate('28,353,300,000'), 28353300000);
  for (const bad of ['0', '1e22', 'fast', '']) assert.ok(Number.isNaN(TE.parseRate(bad)), bad);
});
