import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, load, core } from './load.js';

const TE = core();
const { MESSAGES, t } = load('js/messages.js').TokenMessages;
const { TokenSamples: SAMPLES, TokenSampleOrder: ORDER } = load('js/samples.js');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const YEAR = TE.SECONDS_PER_YEAR;
const fmtBits = (b) => (b >= 100 ? b.toFixed(1) : b.toFixed(2));

const DOCS = {
  ja: {
    file: 'README.md', switcher: '[English](README.en.md) · 日本語', day: '**Day048 - 生成AIで作るセキュリティツール100**', images: /^assets\/screenshot\d*\.png$/,
    sec: { how: '🔬 見積もりの仕組み', time: '⏱️ 総当たりの時間', std: '📏 判定の基準', scan: '🔍 シークレット検出ツールから見えるか', tree: '📁 ディレクトリー構造',
      about: '🛠️ このツールについて' },
    heads: { charset: '文字の集合', format: '形式', samples: 'サンプル', scenario: '場面', std: '基準', rate: '長さ' },
    verdict: { meets: '以上', below: '届かない', pattern: '構造あり', notApplicable: '対象外' },
    claims: ['約584.5年', '約7553億年（宇宙の年齢の54.7倍）', '2022-02-22 19:22:22 UTC', '22字以下（log₂22≈4.46）', '`123456789`→`cbf43926`']
  },
  en: {
    file: 'README.en.md', switcher: 'English · [日本語](README.md)', day: '**Day048 - 100 Security Tools with Generative AI**',
    images: /^assets\/en\/screenshot\d*\.png$/,
    sec: { how: '🔬 How the estimate works', time: '⏱️ Brute-force time', std: '📏 Standards', scan: '🔍 Would secret scanners find it?',
      tree: '📁 Directory structure', about: '🛠️ About this tool' },
    heads: { charset: 'Character set', format: 'Format', samples: 'Sample', scenario: 'Scenario', std: 'Standard', rate: 'Length' },
    verdict: { meets: 'Meets', below: 'Short', pattern: 'Structure', notApplicable: 'Not applicable' },
    claims: ['about 584.5 years', 'about 755 billion years on average (54.7 times the age of the universe)', '2022-02-22 19:22:22 UTC',
      '22 characters or less (log₂22≈4.46)', '(`123456789` → `cbf43926`)']
  }
};
for (const d of Object.values(DOCS)) d.text = read(d.file).replace(/\r\n/g, '\n');

function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

// firstHeader で始まる表の本体の行（見出しと区切りの行を除く）を、セルの配列にする
function table(text, firstHeader) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  assert.ok(start >= 0, firstHeader);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
  return rows;
}

const noCode = (md) => md.replace(/```[\s\S]*?```/g, '');
const h2 = (md) => noCode(md).split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
const headings = (md) => noCode(md).split('\n').filter((l) => /^#{1,4} /.test(l));

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）。YAML は README.md だけに置く', () => {
  const m = DOCS.ja.text.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const yaml = m[1];
  const keys = [...yaml.matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en', 'category_ja', 'category_en',
    'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(yaml, new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(yaml, /^id: day048$/m);
  assert.match(yaml, /^slug: token-entropy-estimator$/m);
  assert.match(yaml, /^repo_url: "https:\/\/github.com\/ipusiron\/token-entropy-estimator"$/m);
  assert.match(yaml, /^demo_url: "https:\/\/ipusiron.github.io\/token-entropy-estimator\/"$/m);
  assert.match(yaml, /^hub: true$/m);
  assert.doesNotMatch(DOCS.en.text, /^<!--/);
});

test('日英の README は同じ見出しを同じ順に持つ（階層と絵文字がそろう）', () => {
  const ja = headings(DOCS.ja.text);
  const en = headings(DOCS.en.text);
  assert.equal(en.length, ja.length);
  ja.forEach((h, i) => {
    assert.equal(en[i].match(/^#+/)[0], h.match(/^#+/)[0], `${h} / ${en[i]}`);
    if (/^#{2,3} /.test(h)) assert.equal([...en[i].replace(/^#+ /, '')][0], [...h.replace(/^#+ /, '')][0], `${h} / ${en[i]}`);
  });
});

for (const [lang, d] of Object.entries(DOCS)) {
  test(`${d.file}: シリーズ標準の構成（前半と後半の見出しの順、Day の表記、言語の切り替え、プロジェクトのリンク）`, () => {
    const heads = h2(d.text);
    assert.ok(d.text.includes(d.switcher));
    assert.match(d.text, /\n# Token Entropy Estimator - .+\n/);
    assert.ok(d.text.includes(d.day));
    assert.ok(heads[0].startsWith('🌐'));
    assert.ok(heads[1].startsWith('📸'));
    assert.deepEqual(heads.slice(-4).map((h) => [...h][0]), ['📁', '💻', '📄', '🛠']);
    for (const icon of ['✨', '📖', '🎯', '🔒', '⚠', '🧪']) assert.ok(heads.some((h) => h.startsWith(icon)), icon);
    assert.match(section(d.text, d.sec.about), /https:\/\/akademeia\.info\/\?page_id=42163/);
    for (const b of ['stars', 'forks', 'last-commit', 'license']) assert.ok(d.text.includes(`img.shields.io/github/${b}/ipusiron/token-entropy-estimator`), b);
    // 監査で直した記載が戻っていない（改善提案の機能はない、meta の X-Frame-Options は効かない）
    assert.doesNotMatch(d.text, /改善提案|X-Frame-Options|7500億年|1秒以内で解読/);
  });

  test(`${d.file}: 強調は1節に2か所まで、箇条書きの項目名を太字にしない、文末にコロンを置かない`, () => {
    for (const h of h2(d.text)) {
      const n = (section(d.text, h).match(/\*\*[^*\n]+\*\*/g) || []).length;
      assert.ok(n <= 2, `${h}: ${n}`);
    }
    assert.doesNotMatch(d.text, /^\s*- \*\*/m);
    if (lang === 'ja') assert.doesNotMatch(noCode(d.text), /：$/m);
  });

  test(`${d.file}: 文字の集合・形式・サンプルの表は実装と一致する`, () => {
    const how = section(d.text, d.sec.how);
    const cs = table(how, d.heads.charset).slice(0, 5);
    const ids = ['digits', 'hex', 'base32', 'base64', 'base64url'];
    cs.forEach(([, size, bpc], i) => {
      const n = TE.ALPHABETS[ids[i]];
      assert.deepEqual([size, bpc], [String(n), Math.log2(n).toFixed(3)], ids[i]);
    });
    const fm = table(how, d.heads.format);
    const bitsOf = (s) => TE.analyze(s).bits;
    assert.equal(fm[0][1].replace(/ ?(ビット|bits)$/, ''), String(bitsOf(SAMPLES.uuid4)));
    assert.equal(fm[1][1].replace(/ ?(ビット|bits)$/, ''), String(bitsOf(SAMPLES.uuid7)));
    assert.equal(fm[4][1].replace(/ ?(ビット|bits)$/, ''), bitsOf(SAMPLES.github).toFixed(1));
    const rows = table(how, d.heads.samples);
    assert.equal(rows.length, ORDER.length);
    const names = { uuid4: 'Uuid4', uuid7: 'Uuid7', hex32: 'Hex32', base64: 'Base64', alnum16: 'Alnum16', alnum32: 'Alnum32', jwt: 'Jwt', github: 'Github',
      same: 'Same', password: 'Password' };
    rows.forEach(([name, format, bits, verdict], i) => {
      const r = TE.analyze(SAMPLES[ORDER[i]]);
      assert.equal(name, MESSAGES[lang][`ui.sample${names[ORDER[i]]}`], ORDER[i]);
      let f;
      if (r.format === 'uuid') f = t('format.uuid', { v: r.details.version }, lang);
      else if (r.format === 'jwt') f = t('format.jwt', { alg: r.details.alg }, lang);
      else if (r.format === 'github') f = t('format.github', { prefix: r.details.prefix }, lang);
      else f = t(`format.${r.format}`, {}, lang);
      assert.equal(format, f, ORDER[i]);
      assert.equal(bits, r.bits === null ? '—' : fmtBits(r.bits), ORDER[i]);
      assert.equal(verdict, d.verdict[TE.verdict(r, 128)], ORDER[i]);
    });
  });

  test(`${d.file}: 攻撃の場面の速さと判定の基準の表は、実装の値と一致する`, () => {
    const sc = table(section(d.text, d.sec.time), d.heads.scenario);
    assert.equal(sc.length, TE.SCENARIOS.length);
    const parse = (s) => {
      const ja = { 万: 1e4, 億: 1e8 };
      let m = s.match(/^([\d.]+)(万|億)?回\/(秒|時)$/);
      if (m) return Number(m[1]) * (m[2] ? ja[m[2]] : 1) / (m[3] === '時' ? 3600 : 1);
      m = s.match(/^([\d.,]+)( billion)? per (second|hour)$/);
      return Number(m[1].replace(/,/g, '')) * (m[2] ? 1e9 : 1) / (m[3] === 'hour' ? 3600 : 1);
    };
    sc.forEach(([, speed], i) => assert.ok(Math.abs(parse(speed) / TE.SCENARIOS[i].rate - 1) < 1e-3, `${speed} ${TE.SCENARIOS[i].rate}`));
    const st = table(section(d.text, d.sec.std), d.heads.std);
    assert.deepEqual(st.map((r) => Number(r[1])), TE.STANDARDS.map((s) => s.bits));
  });

  test(`${d.file}: 本文の数値（OWASP の例・7553億年・UUID v7 の時刻・22字・CRC-32 の検査値）は実装と一致する`, () => {
    for (const c of d.claims) assert.ok(d.text.includes(c), c);
    const owasp = TE.timeTable(64, { valid: 1e5 }).find((r) => r.id === 'onlineUnthrottled');
    assert.equal((10 ** (owasp.avg - Math.log10(YEAR))).toFixed(1), '584.5');
    const alnum = TE.timeTable(TE.analyze(SAMPLES.alnum16).bits, { customRate: 1e9 }).find((r) => r.id === 'custom');
    const p = TE.durationParts(alnum.avg);
    assert.equal(TE.roundForDisplay(TE.scaleNumber(p.log10, 'ja').value), '7553');
    assert.equal(TE.roundForDisplay(TE.scaleNumber(p.log10, 'en').value), '755');
    assert.equal(TE.roundForDisplay(10 ** p.universe), '54.7');
    assert.equal(TE.analyze(SAMPLES.uuid7).details.time, '2022-02-22T19:22:22.000Z');
    assert.ok(Math.log2(22) < 4.5 && Math.log2(23) > 4.5);
  });

  test(`${d.file}: シークレット検出の割合の表は、決まった種の乱数で再現する（各1万本、±2ポイント）`, () => {
    const rows = table(section(d.text, d.sec.scan), d.heads.rate);
    assert.deepEqual(rows.map((r) => r[0]), ['16', '20', '24', '32', '40']);
    const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = 48;
    const next = () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
    for (const [len, share] of rows) {
      let hit = 0;
      for (let i = 0; i < 10000; i++) {
        const tok = Array.from({ length: Number(len) }, () => B62[Math.floor(next() * 62)]);
        if (TE.scanners(tok).detectSecretsBase64.hit) hit++;
      }
      assert.ok(Math.abs(hit / 100 - Number(share.replace('%', ''))) <= 2, `${len}: ${hit / 100}% vs ${share}`);
      if (Number(len) <= 22) assert.equal(hit, 0, len);
    }
  });

  test(`${d.file}: ディレクトリー構造にすべてのファイルとディレクトリーが載り、全行に説明がある`, () => {
    const block = section(d.text, d.sec.tree).match(/```\n([\s\S]*?)```/)[1];
    const lines = block.split('\n').filter((l) => l.trim()).slice(1);
    const listed = new Set();
    for (const line of lines) {
      const m = line.match(/[├└]── ([^\s#]+)\s+# \S/);
      assert.ok(m, `説明のない行: ${line}`);
      listed.add(m[1].replace(/\/$/, ''));
    }
    const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
      .filter((x) => !['.git', 'node_modules', '.claude'].includes(x.name))
      .flatMap((x) => (x.isDirectory() ? [x.name, ...walk(path.join(dir, x.name))] : [x.name]));
    const all = walk('.');
    for (const name of all) assert.ok(listed.has(name), `ツリーにない: ${name}`);
    for (const name of listed) assert.ok(all.includes(name), `実在しない: ${name}`);
    assert.equal(new Set(lines.map((l) => l.indexOf(' # '))).size, 1);
  });
}

test('theory.md: 例の時間は 6.3e11 年（以前の 6.3e14 年ではない）、UUID は RFC 9562、基準の表は実装と同じ', () => {
  const doc = read('theory.md');
  assert.ok(doc.includes('6.3e11 年'));
  assert.doesNotMatch(doc, /6\.3e14/);
  assert.ok(doc.includes('RFC 9562'));
  const years = 2 ** 94 / 1e9 / YEAR;
  assert.equal(years.toExponential(1), '6.3e+11');
  for (const s of TE.STANDARDS) assert.ok(doc.includes(`| ${s.bits} |`), String(s.bits));
});

test('画像: 参照はすべて実在し、日本語版は assets/、英語版は assets/en/ の画像を使う。参照していない PNG は置かない', () => {
  const refs = {};
  for (const [lang, d] of Object.entries(DOCS)) {
    refs[lang] = [...d.text.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
    assert.equal(refs[lang].length, 4, lang);
    for (const r of refs[lang]) {
      assert.ok(fs.existsSync(path.join(ROOT, r)), r);
      assert.match(r, d.images, r);
      assert.ok(fs.statSync(path.join(ROOT, r)).size <= 300 * 1024, r);
    }
  }
  const pngs = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`).sort();
  assert.deepEqual(pngs('assets'), [...new Set(refs.ja)].sort());
  assert.deepEqual(pngs('assets/en'), [...new Set(refs.en)].sort());
});
