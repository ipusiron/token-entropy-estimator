// Token Entropy Estimator の計算（DOM に依存しない）。通常のスクリプトとして読み、globalThis.TokenEntropy に置く
// （file:// でも動かすため ES modules にしない。テストは Node の vm で同じファイルを読む）
// 文言は持たない。結果は id と値で返し、画面側が messages.js で文にする
(function (root) {
  'use strict';

  const MAX_INPUT = 10000; // 解析する長さの上限（コードポイント）
  const LOG10_2 = Math.log10(2);
  const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
  const UNIVERSE_YEARS = 1.38e10; // 宇宙の年齢（約138億年）

  // 見た文字から選ぶ標準の文字の集合（その文字をすべて含む、いちばん小さいもの）
  const ALPHABETS = {
    digits: 10, hex: 16, base32: 32, base64: 64, base64url: 64,
    lower: 26, upper: 26, symbols: 32, space: 1
  };
  // 文字の集合を指定するときの選択肢（auto は自動判定、custom は数を入力）
  const OVERRIDES = { digits: 10, hex: 16, base32: 32, base62: 62, base64: 64, printable: 95 };

  // 判定の基準（出典は README と画面のヘルプ）
  const STANDARDS = [
    { id: 'session', bits: 64 }, // OWASP Session Management・NIST SP 800-63B-4
    { id: 'nist112', bits: 112 }, // NIST SP 800-57 Part 1 Rev.5 表4（2030年まで）
    { id: 'nist128', bits: 128 }, // 同（2031年以降）
    { id: 'otp', bits: 160 }, // RFC 4226 R6（128以上必須、160推奨）
    { id: 'hs256', bits: 256 } // RFC 7518 3.2
  ];
  const DEFAULT_STANDARD = 'nist128';

  // 攻撃の場面（1秒あたりの試行回数）。gpu: true は GPU の枚数を掛ける
  const SCENARIOS = [
    { id: 'onlineThrottled', rate: 100 / 3600, gpu: false }, // zxcvbn の「制限あり」100回/時
    { id: 'onlineUnthrottled', rate: 1e4, gpu: false }, // OWASP の例 1万回/秒
    { id: 'offlineBcrypt', rate: 304.8e3, gpu: true }, // hashcat 6.2.6・RTX 5090 1枚・bcrypt（コスト5）
    { id: 'offlineSha256', rate: 28353.3e6, gpu: true }, // 同 SHA2-256
    { id: 'offlineMd5', rate: 220.6e9, gpu: true } // 同 MD5
  ];

  // シークレット検出ツールの既定（README に出典）
  const SCANNERS = {
    detectSecretsBase64: 4.5, detectSecretsHex: 3.0, gitleaks: 3.5
  };

  const isDigit = (c) => c >= 48 && c <= 57;
  const isUpper = (c) => c >= 65 && c <= 90;
  const isLower = (c) => c >= 97 && c <= 122;
  const isPrintableAscii = (c) => c >= 32 && c <= 126;
  const isSymbol = (c) => isPrintableAscii(c) && c !== 32 && !isDigit(c) && !isUpper(c) && !isLower(c);
  const isHexLetterLower = (c) => c >= 97 && c <= 102;
  const isHexLetterUpper = (c) => c >= 65 && c <= 70;

  function codePoints(s) {
    return Array.from(String(s));
  }

  function log2(x) {
    return Math.log2(x);
  }

  // 1文字あたりのシャノンエントロピー（出現率から）。合計は perChar × 長さ
  function shannon(chars) {
    const n = chars.length;
    if (!n) return { perChar: 0, total: 0, maxPerChar: 0 };
    const count = new Map();
    for (const ch of chars) count.set(ch, (count.get(ch) || 0) + 1);
    let h = 0;
    for (const k of count.values()) h -= (k / n) * log2(k / n);
    return { perChar: h, total: h * n, maxPerChar: log2(n) };
  }

  // ===== Base64・16進数・UTF-8 の解読（中身が読める文字列かを見るため） =====
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64Bytes(text, url) {
    let s = text.replace(/=+$/, '');
    if (url) s = s.replace(/-/g, '+').replace(/_/g, '/');
    if (s.length % 4 === 1) return null;
    const bytes = [];
    let buf = 0;
    let bits = 0;
    for (const ch of s) {
      const v = B64.indexOf(ch);
      if (v < 0) return null;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buf >> bits) & 255);
      }
    }
    return bytes;
  }

  function hexBytes(text) {
    if (text.length % 2) return null;
    const bytes = [];
    for (let i = 0; i < text.length; i += 2) bytes.push(parseInt(text.slice(i, i + 2), 16));
    return bytes;
  }

  // UTF-8 として読めれば文字列、読めなければ null
  function utf8(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length;) {
      const b = bytes[i];
      let cp;
      let need;
      if (b < 0x80) [cp, need] = [b, 0];
      else if (b >= 0xc2 && b < 0xe0) [cp, need] = [b & 0x1f, 1];
      else if (b >= 0xe0 && b < 0xf0) [cp, need] = [b & 0x0f, 2];
      else if (b >= 0xf0 && b < 0xf5) [cp, need] = [b & 0x07, 3];
      else return null;
      for (let k = 1; k <= need; k++) {
        const c = bytes[i + k];
        if (c === undefined || (c & 0xc0) !== 0x80) return null;
        cp = (cp << 6) | (c & 0x3f);
      }
      if ((need === 2 && cp < 0x800) || (need === 3 && (cp < 0x10000 || cp > 0x10ffff)) || (cp >= 0xd800 && cp <= 0xdfff)) return null;
      out += String.fromCodePoint(cp);
      i += need + 1;
    }
    return out;
  }

  // 12バイト以上の UTF-8 で、制御文字を含まず、8割以上が ASCII の印字できる文字なら「読める文字列」
  // （ランダムな12バイトがすべて ASCII の印字できる文字になる確率は約0.001%）
  const READABLE_MIN_BYTES = 12;
  function readableText(bytes) {
    if (!bytes || bytes.length < READABLE_MIN_BYTES) return null;
    const s = utf8(bytes);
    if (s === null) return null;
    let ascii = 0;
    let total = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c < 32 && c !== 9 && c !== 10 && c !== 13) return null;
      if (c === 127 || (c >= 0x80 && c < 0xa0)) return null;
      total++;
      if (isPrintableAscii(c)) ascii++;
    }
    return ascii >= 0.8 * total ? s : null;
  }

  // ===== CRC-32（IEEE 802.3）と Base62（0-9A-Za-z）。GitHub のトークンのチェックサム =====
  const CRC_TABLE = (() => {
    const t = new Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(text) {
    let c = 0xffffffff;
    for (let i = 0; i < text.length; i++) c = CRC_TABLE[(c ^ text.charCodeAt(i)) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  function base62(n, width) {
    let s = '';
    let v = n;
    do {
      s = B62[v % 62] + s;
      v = Math.floor(v / 62);
    } while (v > 0);
    return s.padStart(width, '0');
  }

  // ===== 形式の判定 =====
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const GREGORIAN_OFFSET_100NS = 122192928000000000n; // 1582-10-15 から 1970-01-01 まで（100ns 単位）

  function uuidInfo(text) {
    const hex = text.replace(/-/g, '').toLowerCase();
    if (/^0+$/.test(hex)) return { kind: 'nil', version: null, randomBits: null };
    if (/^f+$/.test(hex)) return { kind: 'max', version: null, randomBits: null };
    const version = parseInt(hex[12], 16);
    const v = parseInt(hex[16], 16);
    const variant = v < 8 ? 'ncs' : v < 12 ? 'rfc9562' : v < 14 ? 'microsoft' : 'future';
    const info = { kind: 'uuid', version, variant, randomBits: null, time: null };
    if (variant !== 'rfc9562') return { ...info, kind: 'uuidOther' };
    if (version === 4) info.randomBits = 122;
    else if (version === 7) {
      info.randomBits = 74;
      info.time = new Date(parseInt(hex.slice(0, 12), 16)).toISOString();
    } else if (version === 1 || version === 6) {
      // 60ビットの時刻（1582-10-15 からの100ns）。v1 は low・mid・high、v6 は high・mid・low の順
      const t = version === 1 ? hex.slice(13, 16) + hex.slice(8, 12) + hex.slice(0, 8) : hex.slice(0, 12) + hex.slice(13, 16);
      const ms = (BigInt('0x' + t) - GREGORIAN_OFFSET_100NS) / 10000n;
      info.time = new Date(Number(ms)).toISOString();
    }
    return info;
  }

  // JWT（JWS のコンパクト形式）: 3つの base64url をドットでつなぎ、1つ目が alg を持つ JSON
  function jwtInfo(text) {
    const parts = text.split('.');
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]*$/.test(parts[2])) {
      return null;
    }
    const head = readableHeader(parts[0]);
    if (!head || typeof head.alg !== 'string') return null;
    return { alg: head.alg.slice(0, 20), typ: typeof head.typ === 'string' ? head.typ.slice(0, 20) : null, signatureLength: parts[2].length };
  }

  function readableHeader(segment) {
    const bytes = base64Bytes(segment, true);
    if (!bytes) return null;
    const s = utf8(bytes);
    if (s === null) return null;
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }

  // GitHub のトークン（ghp_・gho_・ghu_・ghs_・ghr_）: ランダム30文字＋CRC-32 を Base62 にした6文字
  const GITHUB_RE = /^(gh[pousr])_([A-Za-z0-9]{30})([A-Za-z0-9]{6})$/;
  function githubInfo(text) {
    const m = GITHUB_RE.exec(text);
    if (!m) return null;
    const expected = base62(crc32(m[2]), 6);
    return { prefix: m[1], checksumOk: expected === m[3] };
  }

  // 文字の種類から、標準の文字の集合を選ぶ
  function detectAlphabet(chars) {
    let lower = false;
    let upper = false;
    let digit = false;
    let symbol = false;
    let space = false;
    let hexLowerOnly = true;
    let hexUpperOnly = true;
    let hexLetter = false;
    let base64Sym = false;
    let urlSym = false;
    let other = false;
    let base32Bad = false;
    let base32Digit = false;
    for (const ch of chars) {
      const c = ch.codePointAt(0);
      if (isDigit(c)) {
        digit = true;
        if (c === 48 || c === 49 || c === 56 || c === 57) base32Bad = true;
        else base32Digit = true;
      } else if (isUpper(c)) {
        upper = true;
        hexLowerOnly = false;
        if (isHexLetterUpper(c)) hexLetter = true;
        else hexUpperOnly = false;
      } else if (isLower(c)) {
        lower = true;
        hexUpperOnly = false;
        base32Bad = true;
        if (isHexLetterLower(c)) hexLetter = true;
        else hexLowerOnly = false;
      } else if (c === 32) space = true;
      else if (isSymbol(c)) {
        symbol = true;
        if (c === 43 || c === 47) base64Sym = true;
        else if (c === 45 || c === 95) urlSym = true;
        else if (c !== 61) other = true;
      } else return { id: 'nonAscii', size: null };
    }
    const text = chars.join('');
    const onlyAlnum = !symbol && !space;
    if (onlyAlnum && digit && !lower && !upper) return { id: 'digits', size: ALPHABETS.digits };
    if (onlyAlnum && hexLetter && (hexLowerOnly || hexUpperOnly) && (lower || upper)) return { id: 'hex', size: ALPHABETS.hex };
    // Base32（RFC 4648）: 大文字と 2〜7、末尾の = は埋め草
    if (!lower && !space && !other && !base64Sym && !urlSym && upper && base32Digit && !base32Bad && /^[A-Z2-7]+=*$/.test(text)) {
      return { id: 'base32', size: ALPHABETS.base32 };
    }
    // Base64: + か / か末尾の = を含み、= は末尾の2つまで
    if (!space && !other && !urlSym && /^[A-Za-z0-9+/]+={0,2}$/.test(text) && (base64Sym || /=$/.test(text))) {
      return { id: 'base64', size: ALPHABETS.base64 };
    }
    // base64url: - か _ を含み、英数字と - _ だけ
    if (!space && !other && !base64Sym && urlSym && /^[A-Za-z0-9_-]+$/.test(text)) return { id: 'base64url', size: ALPHABETS.base64url };
    // 上のどれでもない: 含まれる文字の種類を足す（記号は印字できる32種、空白は1）
    const classes = [];
    let size = 0;
    for (const [on, id] of [[lower, 'lower'], [upper, 'upper'], [digit, 'digits'], [symbol, 'symbols'], [space, 'space']]) {
      if (!on) continue;
      size += ALPHABETS[id];
      classes.push(id);
    }
    return { id: 'classes', size, classes };
  }

  // 埋め草（=）を除いた、数える文字
  function countedChars(chars, alphabetId) {
    if (alphabetId !== 'base64' && alphabetId !== 'base32') return chars;
    let end = chars.length;
    while (end > 0 && chars[end - 1] === '=') end--;
    return chars.slice(0, end);
  }

  // ===== 構造の警告（1本の文字列から分かるもの） =====
  const KEYBOARD_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

  function longestRun(chars, step) {
    let best = 1;
    let run = 1;
    for (let i = 1; i < chars.length; i++) {
      const a = chars[i - 1].codePointAt(0);
      const b = chars[i].codePointAt(0);
      const sameKind = (isDigit(a) && isDigit(b)) || (isLower(a) && isLower(b)) || (isUpper(a) && isUpper(b));
      run = sameKind && b - a === step ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  function keyboardRun(text) {
    const s = text.toLowerCase();
    let best = '';
    for (const row of KEYBOARD_ROWS) {
      for (const r of [row, [...row].reverse().join('')]) {
        for (let len = r.length; len >= 4 && len > best.length; len--) {
          for (let i = 0; i + len <= r.length; i++) {
            if (s.includes(r.slice(i, i + len))) {
              best = r.slice(i, i + len);
              break;
            }
          }
        }
      }
    }
    return best;
  }

  // 最小の周期（文字列全体がその長さのかたまりの繰り返しか）。なければ 0
  function repeatPeriod(chars) {
    const n = chars.length;
    for (let p = 1; p <= n / 2; p++) {
      let ok = true;
      for (let i = p; i < n && ok; i++) if (chars[i] !== chars[i - p]) ok = false;
      if (ok) return p;
    }
    return 0;
  }

  // 長さ n の文字列を見るとき、出現率から出るばらつきの上限は log2(min(n, 文字の数))。その半分未満なら「ばらつきが小さい」
  const LOW_VARIETY_RATIO = 0.5;
  // 同じ長さ・同じ文字の数のランダムな文字列に、偶然現れる回数の期待値がこれ未満なら「偶然では起きにくい並び」とする
  const CHANCE_LIMIT = 1e-3;
  // 長さ r の上り・下りの並び（abcd・9876）が現れる回数の期待値（およそ。次の文字が1つ後になる確率を 1/k とする）
  function runChance(n, k, r) {
    return Math.max(0, n - r + 1) * 2 * (1 / k) ** (r - 1);
  }
  // キーボードの並び（両向き）の長さ r の部分の数と、それが現れる回数の期待値（大文字・小文字の両方を含む集合では1文字あたり 2/k）
  function keyboardChance(n, k, r) {
    const kinds = 2 * KEYBOARD_ROWS.reduce((a, row) => a + Math.max(0, row.length - r + 1), 0);
    const p = (k >= 52 ? 2 : 1) / k;
    return Math.max(0, n - r + 1) * kinds * p ** r;
  }

  function structureWarnings(chars, size, sh) {
    const w = [];
    const n = chars.length;
    if (n < 2) return w;
    const period = repeatPeriod(chars);
    if (period === 1) w.push({ id: 'allSame' });
    else if (period > 1) w.push({ id: 'repeated', period });
    const run = Math.max(longestRun(chars, 1), longestRun(chars, -1));
    if (period !== 1 && run >= 3 && runChance(n, size, run) < CHANCE_LIMIT) w.push({ id: 'sequence', run });
    const kb = keyboardRun(chars.join(''));
    if (kb && keyboardChance(n, size, kb.length) < CHANCE_LIMIT) w.push({ id: 'keyboard', run: kb.length });
    if (n >= 8 && period === 0 && size && sh.perChar < LOW_VARIETY_RATIO * log2(Math.min(n, size))) w.push({ id: 'lowVariety' });
    return w;
  }

  // 「構造あり」とみなす警告（判定を出さない）
  const PATTERN_WARNINGS = ['allSame', 'repeated', 'sequence', 'keyboard', 'lowVariety', 'decodedText'];

  // ===== シークレット検出ツールの見え方 =====
  const DS_BASE64 = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' + String.fromCharCode(92) + '-_=');
  const HEX_SET = new Set('0123456789abcdefABCDEF');

  function scanners(chars) {
    const sh = shannon(chars);
    const n = chars.length;
    const all = (set) => n > 0 && chars.every((ch) => set.has(ch));
    const out = {};
    out.detectSecretsBase64 = all(DS_BASE64)
      ? { applies: true, entropy: sh.perChar, limit: SCANNERS.detectSecretsBase64, hit: sh.perChar > SCANNERS.detectSecretsBase64 }
      : { applies: false };
    if (all(HEX_SET)) {
      // detect-secrets は数字だけの16進数から 1.2÷log2(長さ) を引く
      const digitsOnly = n > 1 && chars.every((ch) => isDigit(ch.codePointAt(0)));
      const e = digitsOnly ? sh.perChar - 1.2 / log2(n) : sh.perChar;
      out.detectSecretsHex = { applies: true, entropy: e, limit: SCANNERS.detectSecretsHex, hit: e > SCANNERS.detectSecretsHex };
    } else out.detectSecretsHex = { applies: false };
    out.gitleaks = { applies: n > 0, entropy: sh.perChar, limit: SCANNERS.gitleaks, hit: sh.perChar > SCANNERS.gitleaks };
    return out;
  }

  // ===== 解析の本体 =====
  // options.override: 'auto'（既定）・OVERRIDES のキー・'custom'。options.customSize: custom のときの文字の数
  function analyze(input, options = {}) {
    const all = codePoints(input);
    const truncated = all.length > MAX_INPUT;
    const chars = truncated ? all.slice(0, MAX_INPUT) : all;
    const res = {
      empty: chars.length === 0, length: chars.length, truncated, format: null, alphabet: null, counted: 0, bits: null,
      bitsKind: null, warnings: [], details: null, shannon: shannon(chars), scanners: scanners(chars), basis: 'none'
    };
    if (res.empty) return res;
    const text = chars.join('');
    const override = options.override && options.override !== 'auto' ? options.override : null;
    if (truncated) res.warnings.push({ id: 'truncated', max: MAX_INPUT });

    // 形式（版や構造の決まった文字列）。文字の集合を指定したときは使わない
    if (!override) {
      if (UUID_RE.test(text)) {
        const u = uuidInfo(text);
        res.format = 'uuid';
        res.details = u;
        res.alphabet = { id: 'hex', size: ALPHABETS.hex };
        if (u.randomBits !== null) {
          res.bits = u.randomBits;
          res.bitsKind = 'spec';
          res.counted = 32;
          res.basis = 'bits';
        } else res.basis = 'notApplicable';
        if (u.time) res.warnings.push({ id: 'uuidTime', time: u.time, version: u.version });
        return res;
      }
      const jwt = jwtInfo(text);
      if (jwt) {
        res.format = 'jwt';
        res.details = jwt;
        res.basis = 'notApplicable';
        return res;
      }
      const gh = githubInfo(text);
      if (gh) {
        res.format = 'github';
        res.details = gh;
        res.alphabet = { id: 'base62', size: 62 };
        res.counted = 30;
        res.bits = 30 * log2(62);
        res.bitsKind = 'spec';
        res.basis = 'bits';
        if (!gh.checksumOk) res.warnings.push({ id: 'githubChecksum' });
        return res;
      }
    }

    // 文字の集合
    let alphabet;
    if (override === 'custom') {
      const size = Number(options.customSize);
      alphabet = Number.isInteger(size) && size >= 2 && size <= 1114112 ? { id: 'custom', size } : null;
      if (!alphabet) {
        res.warnings.push({ id: 'badCustomSize' });
        return res;
      }
    } else if (override) {
      alphabet = { id: override, size: OVERRIDES[override] };
      if (!alphabet.size) return res;
    } else alphabet = detectAlphabet(chars);
    res.alphabet = alphabet;
    res.format = override ? 'specified' : alphabet.id;
    if (alphabet.id === 'nonAscii') {
      res.warnings.push({ id: 'nonAscii' });
      res.basis = 'unknown';
      return res;
    }
    const counted = countedChars(chars, alphabet.id);
    res.counted = counted.length;
    res.bits = counted.length * log2(alphabet.size);
    res.bitsKind = 'uniform';
    res.basis = 'bits';

    // 中身が読める文字列か（Base64・base64url・16進数）
    const bytes = alphabet.id === 'base64' || alphabet.id === 'base64url' ? base64Bytes(text, alphabet.id === 'base64url')
      : alphabet.id === 'hex' ? hexBytes(text) : null;
    const decoded = readableText(bytes);
    if (decoded !== null) res.warnings.push({ id: 'decodedText', preview: [...decoded].slice(0, 40).join(''), bytes: bytes.length });
    // 16進数でハッシュ値と同じ長さ
    if (alphabet.id === 'hex' && [32, 40, 64, 128].includes(chars.length)) res.warnings.push({ id: 'hashLength', bits: chars.length * 4 });
    // 接頭辞らしい部分（小文字2〜10文字＋ _ か - を3つまで、そのあとに英数字だけが16文字以上。例: sk_live_）
    // ランダムな base64url で偶然この形になるのは約0.2%（- と _ が接頭辞の外に1つもない場合に限るため）
    const pre = /^((?:[a-z]{2,10}[_-]){1,3})[A-Za-z0-9]{16,}$/.exec(text);
    if (!override && pre) {
      const rest = codePoints(text.slice(pre[1].length));
      const restAlphabet = detectAlphabet(rest);
      if (restAlphabet.size) res.warnings.push({ id: 'prefix', prefix: pre[1], bitsWithout: rest.length * log2(restAlphabet.size) });
    }
    res.warnings.push(...structureWarnings(counted, alphabet.size, shannon(counted)));
    if (res.warnings.some((w) => PATTERN_WARNINGS.includes(w.id))) res.basis = 'pattern';
    return res;
  }

  // 判定: meets（基準以上）・below（未満）・pattern（構造がある）・notApplicable（エントロピーで測る対象でない）・unknown・none
  function verdict(result, thresholdBits) {
    if (!result || result.empty) return 'none';
    if (result.basis !== 'bits') return result.basis;
    return result.bits >= thresholdBits ? 'meets' : 'below';
  }

  function standardBits(id) {
    const s = STANDARDS.find((x) => x.id === id);
    return s ? s.bits : null;
  }

  // 自由入力の基準（1〜1024の整数）。正しくなければ NaN
  function parseThreshold(raw) {
    const s = String(raw).trim();
    if (!/^[0-9]{1,4}$/.test(s)) return NaN;
    const v = Number(s);
    return v >= 1 && v <= 1024 ? v : NaN;
  }

  // 正の整数（上限つき）。正しくなければ NaN
  function parseCount(raw, max) {
    const s = String(raw).trim().replace(/,/g, '');
    if (!/^[0-9]{1,16}$/.test(s)) return NaN;
    const v = Number(s);
    return v >= 1 && v <= max ? v : NaN;
  }

  // 1秒あたりの回数（1e-6〜1e21、指数表記可）。正しくなければ NaN
  function parseRate(raw) {
    const s = String(raw).trim().replace(/,/g, '');
    if (!/^[0-9]+(\.[0-9]+)?(e[+-]?[0-9]{1,2})?$/i.test(s)) return NaN;
    const v = Number(s);
    return v >= 1e-6 && v <= 1e21 ? v : NaN;
  }

  // ===== 当たるまでの回数と時間（桁あふれしないよう log10 で持つ） =====
  // 候補 N＝2^bits のうち有効な値が K 個。重複なしで1つずつ試すとき、最初に当たるまでの回数の期待値は (N+1)/(K+1)、最悪は N−K+1
  function guesses(bits, valid = 1) {
    const K = Math.max(1, valid);
    if (bits <= 52) {
      const N = 2 ** bits;
      if (K >= N) return { avg: 0, worst: 0 };
      return { avg: Math.log10((N + 1) / (K + 1)), worst: Math.log10(N - K + 1) };
    }
    const lgN = bits * LOG10_2;
    return { avg: Math.max(0, lgN - Math.log10(K + 1)), worst: lgN };
  }

  function timeTable(bits, { valid = 1, gpus = 1, customRate = null } = {}) {
    const g = guesses(bits, valid);
    const rows = SCENARIOS.map((s) => ({ id: s.id, rate: s.gpu ? s.rate * gpus : s.rate }));
    if (customRate) rows.push({ id: 'custom', rate: customRate });
    return rows.map((r) => ({ ...r, avg: g.avg - Math.log10(r.rate), worst: g.worst - Math.log10(r.rate) }));
  }

  // 時間（log10 秒）を単位に分ける。年を超えたら年の log10 も返す
  function durationParts(log10Seconds) {
    if (log10Seconds < 0) return { unit: 'underSecond' };
    if (log10Seconds < 9) {
      const s = 10 ** log10Seconds;
      if (s < 60) return { unit: 'seconds', value: s };
      if (s < 3600) return { unit: 'minutes', value: s / 60 };
      if (s < 86400) return { unit: 'hours', value: s / 3600 };
      if (s < SECONDS_PER_YEAR) return { unit: 'days', value: s / 86400 };
    }
    const lgYears = log10Seconds - Math.log10(SECONDS_PER_YEAR);
    return { unit: 'years', log10: lgYears, universe: lgYears - Math.log10(UNIVERSE_YEARS) };
  }

  // 大きな数を、言語の区切り（日本語は4桁ごと、英語は3桁ごと）で分ける。上限を超えたら 10 の指数
  const SCALES = { ja: ['', 'man', 'oku', 'cho', 'kei'], en: ['', 'thousand', 'million', 'billion', 'trillion'] };
  function scaleNumber(log10Value, lang) {
    const step = lang === 'ja' ? 4 : 3;
    const names = SCALES[lang === 'ja' ? 'ja' : 'en'];
    const idx = Math.floor(Math.max(0, log10Value) / step);
    if (idx >= names.length) return { exp: Math.floor(log10Value), mantissa: 10 ** (log10Value - Math.floor(log10Value)) };
    return { value: 10 ** (log10Value - idx * step), scale: names[idx] };
  }

  // 表示用の丸め: 100以上は整数、10以上は小数1桁、それ未満は小数2桁（末尾の0は残さない）
  function roundForDisplay(v) {
    if (v >= 100) return String(Math.round(v));
    if (v >= 10) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 100) / 100);
  }

  // ===== 複数のトークンの一括分析（同じ作り方のトークンを並べて、位置ごとに比べる） =====
  const BATCH_MIN = 20; // これより少ないと、偶然の偏りと区別しにくい
  const BATCH_MAX = 1000;
  const BATCH_MAX_LENGTH = 200;
  const BATCH_WEAK_RATIO = 0.5; // 同じ個数の乱数の半分に満たない位置を「偏りのある位置」とする
  const BATCH_INCREASING = 0.95; // 前のものより大きい組の割合がこれ以上なら「増え続けている」

  // 決まった種の乱数（比べるための乱数。暗号の用途には使わない）
  function xorshift32(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  // n 個を k 種から一様に選んだとき、最も多い文字の割合から出す最小エントロピー（−log2 pmax）の平均。決まった種で rounds 回
  const baselineCache = new Map();
  function baselineMinEntropy(n, k, rounds = 200) {
    const key = `${n}:${k}`;
    if (baselineCache.has(key)) return baselineCache.get(key);
    const next = xorshift32(20261004);
    const counts = new Uint32Array(k);
    let sum = 0;
    for (let r = 0; r < rounds; r++) {
      counts.fill(0);
      let max = 0;
      for (let i = 0; i < n; i++) {
        const c = Math.floor(next() * k);
        counts[c]++;
        if (counts[c] > max) max = counts[c];
      }
      sum += -log2(max / n);
    }
    const v = sum / rounds;
    baselineCache.set(key, v);
    return v;
  }

  function batchAnalyze(text) {
    const lines = String(text).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const tokens = lines.slice(0, BATCH_MAX).map((l) => codePoints(l).slice(0, BATCH_MAX_LENGTH));
    const n = tokens.length;
    const res = { count: n, overLimit: lines.length > BATCH_MAX, warnings: [], positions: [] };
    if (!n) return res;
    const strings = tokens.map((t) => t.join(''));
    const lengths = tokens.map((t) => t.length);
    res.minLength = Math.min(...lengths);
    res.maxLength = Math.max(...lengths);
    res.duplicates = n - new Set(strings).size;
    for (let i = 0; i < res.maxLength; i++) {
      const counts = new Map();
      let present = 0;
      for (const t of tokens) {
        if (i >= t.length) continue;
        counts.set(t[i], (counts.get(t[i]) || 0) + 1);
        present++;
      }
      let max = 0;
      for (const c of counts.values()) max = Math.max(max, c);
      res.positions.push({ index: i, distinct: counts.size, present, minEntropy: -log2(max / present), constant: counts.size === 1 && present === n });
    }
    let prefix = 0;
    while (prefix < res.positions.length && res.positions[prefix].constant) prefix++;
    res.prefixLength = prefix;
    res.prefix = tokens[0].slice(0, prefix).join('');
    res.constantPositions = res.positions.filter((p) => p.constant).length;
    // 文字の集合は、文字が変わる位置の文字から選ぶ（UUID のハイフンのような固定の文字で集合を広げない）
    const varying = [];
    for (const t of tokens) {
      t.forEach((ch, i) => {
        if (!res.positions[i].constant) varying.push(ch);
      });
    }
    res.alphabet = detectAlphabet(varying.length ? varying : tokens.flat());
    let up = 0;
    for (let i = 1; i < n; i++) if (strings[i] > strings[i - 1]) up++;
    res.increasingShare = n > 1 ? up / (n - 1) : 0;
    res.sumMinEntropy = res.positions.reduce((a, p) => a + p.minEntropy, 0);
    res.capPerPosition = log2(n);
    // 1本の見積もり: それぞれのトークンを1本ずつ見積もった値の中央値（UUID v7 なら74ビット）
    const singles = strings.map((s) => analyze(s).bits).filter((b) => b !== null).sort((a, b) => a - b);
    res.singleBits = singles.length ? singles[Math.floor(singles.length / 2)] : null;
    const k = res.alphabet.size;
    let constantByChance = false;
    let duplicateByChance = false;
    if (k) {
      res.baselinePerPosition = baselineMinEntropy(n, k);
      res.baselineSum = res.baselinePerPosition * res.maxLength;
      // 固定の位置（それぞれの位置で全部が同じ文字）は、この個数・文字の数なら偶然には起きにくいか（期待値 L×k^(1−n)）
      constantByChance = Math.log10(res.maxLength) + (1 - n) * Math.log10(k) >= Math.log10(CHANCE_LIMIT);
      // 重複（期待値 n(n−1)/2 × k^(−L)）
      duplicateByChance = Math.log10((n * (n - 1)) / 2) - res.minLength * Math.log10(k) >= Math.log10(CHANCE_LIMIT);
      res.weakPositions = res.positions.filter((p) => !p.constant && p.minEntropy < BATCH_WEAK_RATIO * res.baselinePerPosition).length;
    }
    if (n < BATCH_MIN) res.warnings.push({ id: 'batchFew', min: BATCH_MIN });
    if (res.overLimit) res.warnings.push({ id: 'batchOverLimit', max: BATCH_MAX });
    if (res.duplicates && !duplicateByChance) res.warnings.push({ id: 'batchDuplicates', count: res.duplicates });
    if (res.minLength !== res.maxLength) res.warnings.push({ id: 'batchLengths', min: res.minLength, max: res.maxLength });
    if (n >= 2 && res.constantPositions && !constantByChance) res.warnings.push({ id: 'batchConstant', count: res.constantPositions, prefix: res.prefix });
    if (n >= BATCH_MIN && res.increasingShare >= BATCH_INCREASING) res.warnings.push({ id: 'batchIncreasing', share: res.increasingShare });
    if (n >= BATCH_MIN && res.weakPositions) res.warnings.push({ id: 'batchWeak', count: res.weakPositions });
    if (!k) res.warnings.push({ id: 'nonAscii' });
    // 構造が見つかったか（個数が足りないときは判定しない）
    const found = res.warnings.some((w) => ['batchDuplicates', 'batchConstant', 'batchIncreasing', 'batchWeak'].includes(w.id));
    res.verdict = found ? 'structure' : n < BATCH_MIN ? 'few' : 'none';
    return res;
  }

  // ===== 安全なトークンの作り方 =====
  const PRINTABLE = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).join(''); // 空白を除く印字できる ASCII
  const GEN_ALPHABETS = {
    hex: '0123456789abcdef',
    base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    base62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
    digits: '0123456789',
    printable: PRINTABLE
  };

  // 目標のビット数に必要な文字数
  function requiredLength(bits, k) {
    return Math.ceil(bits / log2(k) - 1e-9);
  }

  // 1バイト（0〜255）を k で割った余りで文字を選ぶときの偏り。余り r の文字だけ1回多く出る
  function moduloBias(k) {
    const r = 256 % k;
    if (!r) return { remainder: 0, ratio: 1, minEntropyLoss: 0 };
    const hi = Math.ceil(256 / k);
    const lo = Math.floor(256 / k);
    return { remainder: r, ratio: hi / lo, pHigh: hi / 256, pLow: lo / 256, minEntropyLoss: log2(k) + log2(hi / 256) };
  }

  // 乱数のバイト列（randomBytes(Uint8Array) で埋める関数）から、棄却法で偏りなく文字を選ぶ
  function generate(alphabetId, length, randomBytes) {
    const a = GEN_ALPHABETS[alphabetId];
    if (!a || !Number.isInteger(length) || length < 1 || length > 1024) return null;
    const k = a.length;
    const limit = 256 - (256 % k);
    const out = [];
    const buf = new Uint8Array(Math.max(16, length * 2));
    while (out.length < length) {
      randomBytes(buf);
      for (const b of buf) {
        if (b >= limit) continue;
        out.push(a[b % k]);
        if (out.length === length) break;
      }
    }
    return out.join('');
  }

  // UUID v7（RFC 9562）: 48ビットのミリ秒の時刻＋版7＋12ビットの乱数＋変種10＋62ビットの乱数
  function makeUuidV7(ms, randomBytes) {
    const r = new Uint8Array(10);
    randomBytes(r);
    const hex = (b) => b.toString(16).padStart(2, '0');
    const time = Math.floor(ms).toString(16).padStart(12, '0').slice(-12);
    const randA = ((r[0] & 0x0f) << 8) | r[1];
    const b = [...r.slice(2)];
    b[0] = (b[0] & 0x3f) | 0x80;
    const tail = b.map(hex).join('');
    return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${randA.toString(16).padStart(3, '0')}-${tail.slice(0, 4)}-${tail.slice(4, 16)}`;
  }

  root.TokenEntropy = {
    MAX_INPUT, ALPHABETS, OVERRIDES, STANDARDS, DEFAULT_STANDARD, SCENARIOS, SCANNERS, PATTERN_WARNINGS, SECONDS_PER_YEAR, UNIVERSE_YEARS,
    LOW_VARIETY_RATIO, codePoints, shannon, base64Bytes, hexBytes, utf8, readableText, crc32, base62, uuidInfo, jwtInfo, githubInfo,
    detectAlphabet, structureWarnings, scanners, analyze, verdict, standardBits, parseThreshold, parseCount, parseRate, guesses, timeTable,
    durationParts, scaleNumber, roundForDisplay, BATCH_MIN, BATCH_MAX, BATCH_MAX_LENGTH, BATCH_WEAK_RATIO, BATCH_INCREASING, xorshift32,
    baselineMinEntropy, batchAnalyze, GEN_ALPHABETS, requiredLength, moduloBias, generate, makeUuidV7
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
