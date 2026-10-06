// Token Entropy Estimator の画面（DOM だけを扱う）。計算は js/entropy-core.js、文言は js/messages.js
// 画面に入れる文字列はすべて textContent で入れる（HTML として解釈しない）
(function () {
  'use strict';

  const TE = globalThis.TokenEntropy;
  const { t, getLanguage } = globalThis.TokenMessages;
  const $ = (id) => document.getElementById(id);
  const GAUGE_MAX = 256;
  const MAX_VALID = 1e16;
  const MAX_GPUS = 1e6;

  // 画面の状態。入力・前提を変えたら、ここを書き換えて render() で全体を描き直す
  const state = {
    token: '', charset: 'auto', customSize: '100', standard: TE.DEFAULT_STANDARD, customBits: '96', valid: '1', gpus: '1', customRate: '',
    batch: '', batchResult: null
  };

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') node.textContent = v;
      else if (k === 'className') node.className = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) node.append(c);
    return node;
  }

  function fmtBits(bits) {
    return bits >= 100 ? bits.toFixed(1) : bits.toFixed(2);
  }

  // 10 の指数を上付きの数字で書く（10²⁵）
  const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const superscript = (n) => String(n).replace(/[0-9]/g, (d) => SUPERSCRIPT[Number(d)]).replace('-', '⁻');

  // 大きな数を、言語の区切り（日本語は万・億・兆・京、英語は thousand…trillion）で書く。区切りを超えたら 10 の指数
  function bigNumber(log10Value, keyPlain, keyExp, extra = {}) {
    const s = TE.scaleNumber(log10Value, getLanguage());
    if (s.exp !== undefined) return t(keyExp, { ...extra, m: TE.roundForDisplay(s.mantissa), e: superscript(s.exp) });
    const scale = s.scale ? t(`scale.${s.scale}`) : '';
    return t(keyPlain, { ...extra, n: TE.roundForDisplay(s.value), scale });
  }

  // 宇宙の年齢との比は、1倍以上1億倍未満のときだけ添える（それより大きいと比べても実感がない）
  const UNIVERSE_MAX_LOG10 = 8;

  function duration(log10Seconds) {
    const p = TE.durationParts(log10Seconds);
    if (p.unit === 'underSecond') return t('dur.underSecond');
    if (p.unit !== 'years') return t(`dur.${p.unit}`, { n: TE.roundForDisplay(p.value) });
    let text = p.log10 < 0 ? t('dur.years', { n: TE.roundForDisplay(10 ** p.log10), scale: '' }) : bigNumber(p.log10, 'dur.years', 'dur.yearsExp');
    if (p.universe >= 0 && p.universe < UNIVERSE_MAX_LOG10) {
      text = t('dur.withUniverse', { time: text, universe: bigNumber(p.universe, 'dur.universe', 'dur.universe') });
    }
    return text;
  }

  function rateText(rate) {
    if (rate < 1) return t('rate.perHour', { n: TE.roundForDisplay(rate * 3600) });
    return bigNumber(Math.log10(rate), 'rate.perSecond', 'rate.perSecondExp');
  }

  // 入力欄の値を検証する。正しくなければ欄の下に知らせ、null を返す
  function checked(value, parse, errorId, errorKey) {
    const v = parse(value);
    const ok = !Number.isNaN(v);
    $(errorId).textContent = ok ? '' : t(errorKey);
    return ok ? v : null;
  }

  function settings() {
    const custom = state.standard === 'custom';
    $('customBitsField').hidden = !custom;
    $('customSizeField').hidden = state.charset !== 'custom';
    const threshold = custom ? checked(state.customBits, TE.parseThreshold, 'customBitsError', 'err.customBits') : TE.standardBits(state.standard);
    if (!custom) $('customBitsError').textContent = '';
    const valid = checked(state.valid, (v) => TE.parseCount(v, MAX_VALID), 'validError', 'err.valid');
    const gpus = checked(state.gpus, (v) => TE.parseCount(v, MAX_GPUS), 'gpusError', 'err.gpus');
    let customRate = null;
    if (state.customRate.trim()) customRate = checked(state.customRate, TE.parseRate, 'customRateError', 'err.customRate');
    else $('customRateError').textContent = '';
    return { threshold, valid, gpus, customRate };
  }

  function formatName(r) {
    if (r.format === 'uuid') {
      const d = r.details;
      if (d.kind === 'nil') return t('format.uuidNil');
      if (d.kind === 'max') return t('format.uuidMax');
      if (d.kind === 'uuidOther') return t('format.uuidOther');
      return t('format.uuid', { v: d.version });
    }
    if (r.format === 'jwt') return t('format.jwt', { alg: r.details.alg });
    if (r.format === 'github') return t('format.github', { prefix: r.details.prefix });
    return t(`format.${r.format}`);
  }

  function alphabetName(a) {
    if (!a || !a.size) return '—';
    if (a.id === 'custom') return t('cs.custom', { n: a.size });
    if (a.id === 'classes') return t('cs.classes', { list: a.classes.map((c) => t(`cls.${c}`)).join(t('cs.join')), n: a.size });
    return t(`cs.${a.id}`);
  }

  // 形式の説明（UUID の版・JWT・GitHub）
  function formatNotes(r) {
    if (r.format === 'jwt') return [t('fmt.jwt')];
    if (r.format === 'github') return [t('fmt.github') + (r.details.checksumOk ? t('fmt.githubOk') : '')];
    if (r.format !== 'uuid') return [];
    const d = r.details;
    if (d.kind === 'nil' || d.kind === 'max') return [t('fmt.uuidSpecial')];
    if (d.kind === 'uuidOther') return [t('fmt.uuidOther')];
    const byVersion = {
      4: 'fmt.uuid4', 7: 'fmt.uuid7', 1: 'fmt.uuidTime', 2: 'fmt.uuidTime', 6: 'fmt.uuidTime', 3: 'fmt.uuidName', 5: 'fmt.uuidName', 8: 'fmt.uuid8'
    };
    return [t(byVersion[d.version] || 'fmt.uuidOtherVersion')];
  }

  function warningText(w) {
    switch (w.id) {
      case 'truncated': return t('w.truncated', { max: TE.MAX_INPUT.toLocaleString('en-US') });
      case 'uuidTime': return t('w.uuidTime', { time: w.time.replace('T', ' ').replace('.000Z', '') });
      case 'decodedText': return t('w.decodedText', { bytes: w.bytes, preview: w.preview });
      case 'hashLength': return t('w.hashLength', { bits: w.bits, names: t(`hash.${w.bits}`) });
      case 'prefix': return t('w.prefix', { prefix: w.prefix, bits: fmtBits(w.bitsWithout) });
      case 'repeated': return t('w.repeated', { period: w.period });
      case 'sequence': case 'keyboard': return t(`w.${w.id}`, { run: w.run });
      default: return t(`w.${w.id}`);
    }
  }

  // 人が考えた文字列らしいか（記号を含む文字の組み合わせ、または32字以下の文字の組み合わせ）
  function looksHuman(r) {
    return r.alphabet && r.alphabet.id === 'classes' && (r.alphabet.classes.includes('symbols') || r.length <= 32);
  }

  function renderNotes(r) {
    const items = [...formatNotes(r), ...r.warnings.map(warningText)];
    if (looksHuman(r) && r.basis !== 'pattern') items.push(t('w.human'));
    if (!items.length && !r.empty) items.push(t('notes.none'));
    $('notes').replaceChildren(...items.map((s) => el('li', { text: s })));
  }

  function renderGauge(bits, threshold) {
    const fill = $('gaugeFill');
    const mark = $('gaugeMark');
    fill.style.width = `${bits === null ? 0 : (Math.min(bits, GAUGE_MAX) / GAUGE_MAX) * 100}%`;
    mark.hidden = threshold === null;
    if (threshold !== null) mark.style.left = `${(Math.min(threshold, GAUGE_MAX) / GAUGE_MAX) * 100}%`;
  }

  function renderTime(r, s) {
    const body = $('timeTable').querySelector('tbody');
    if (r.bits === null || s.valid === null || s.gpus === null) {
      body.replaceChildren();
      return;
    }
    const rows = TE.timeTable(r.bits, { valid: s.valid, gpus: s.gpus, customRate: s.customRate });
    body.replaceChildren(...rows.map((row) => {
      const gpu = (TE.SCENARIOS.find((x) => x.id === row.id) || {}).gpu;
      const name = t(`sc.${row.id}`) + (gpu && s.gpus > 1 ? t('sc.gpus', { n: s.gpus.toLocaleString('en-US') }) : '');
      return el('tr', {}, [
        el('th', { scope: 'row', text: name }), el('td', { 'data-label': t('ui.colRate'), text: rateText(row.rate) }),
        el('td', { 'data-label': t('ui.colAvg'), text: duration(row.avg) }), el('td', { 'data-label': t('ui.colWorst'), text: duration(row.worst) })
      ]);
    }));
  }

  function renderScanners(r) {
    const body = $('scanTable').querySelector('tbody');
    if (r.empty) {
      body.replaceChildren();
      return;
    }
    body.replaceChildren(...['detectSecretsBase64', 'detectSecretsHex', 'gitleaks'].map((id) => {
      const s = r.scanners[id];
      const value = s.applies ? s.entropy.toFixed(3) : '—';
      const hit = s.applies ? t(s.hit ? 'scan.hit' : 'scan.miss') : t('scan.na');
      return el('tr', { class: s.applies && s.hit ? 'hit' : '' }, [
        el('th', { scope: 'row', text: t(`scan.${id}`) }), el('td', { 'data-label': t('ui.colLimit'), text: String(TE.SCANNERS[id]) }),
        el('td', { 'data-label': t('ui.colValue'), text: value }), el('td', { 'data-label': t('ui.colHit'), text: hit })
      ]);
    }));
  }

  // ===== 複数のトークンの一括分析 =====
  // 結果は state.batchResult に持ち、言語を切り替えたときは計算し直さずに描き直す
  const cryptoBytes = (buf) => globalThis.crypto.getRandomValues(buf);

  function batchSample(kind) {
    if (kind === 'random') return Array.from({ length: 100 }, () => TE.generate('base62', 32, cryptoBytes)).join('\n');
    if (kind === 'counter') {
      const start = parseInt(TE.generate('hex', 7, cryptoBytes), 16);
      return Array.from({ length: 100 }, (_, i) => (start + i).toString(16).padStart(32, '0')).join('\n');
    }
    const now = Date.now();
    return Array.from({ length: 100 }, (_, i) => TE.makeUuidV7(now + i * 3, cryptoBytes)).join('\n');
  }

  function batchWarning(w) {
    switch (w.id) {
      case 'batchFew': return t('w.batchFew', { min: w.min });
      case 'batchOverLimit': return t('w.batchOverLimit', { max: w.max.toLocaleString('en-US') });
      case 'batchDuplicates': return t('w.batchDuplicates', { count: w.count });
      case 'batchLengths': return t('w.batchLengths', { min: w.min, max: w.max });
      case 'batchConstant': return w.prefix ? t('w.batchConstant', { count: w.count, prefix: w.prefix }) : t('w.batchConstantInside', { count: w.count });
      case 'batchIncreasing': return t('w.batchIncreasing', { share: Math.round(w.share * 100) });
      case 'batchWeak': return t('w.batchWeak', { count: w.count });
      default: return t(`w.${w.id}`);
    }
  }

  function renderBatchChart(r) {
    const chart = $('batchChart');
    if (!r.count || !r.alphabet || !r.alphabet.size) {
      chart.replaceChildren();
      return;
    }
    const top = Math.max(Math.log2(r.alphabet.size), r.baselinePerPosition, ...r.positions.map((p) => p.minEntropy));
    const bars = r.positions.map((p) => {
      const weak = !p.constant && p.minEntropy < TE.BATCH_WEAK_RATIO * r.baselinePerPosition;
      const bar = el('span', { className: `pbar${p.constant ? ' constant' : weak ? ' weak' : ''}` });
      bar.style.height = `${Math.max(1, (p.minEntropy / top) * 100)}%`;
      return bar;
    });
    const line = el('span', { className: 'batch-baseline' });
    line.style.bottom = `${(r.baselinePerPosition / top) * 100}%`;
    chart.replaceChildren(...bars, line);
  }

  function renderBatch() {
    const r = state.batchResult;
    const verdict = $('batchVerdict');
    const set = (id, text) => {
      $(id).textContent = text;
    };
    if (!r || !r.count) {
      verdict.textContent = t('batch.empty');
      verdict.className = 'verdict';
      for (const id of ['batchCount', 'batchLength', 'batchAlphabet', 'batchDup', 'batchSum', 'batchBaseline', 'batchSingle']) set(id, '—');
      $('batchNotes').replaceChildren();
      renderBatchChart({ count: 0 });
      return;
    }
    verdict.textContent = r.verdict === 'few' ? t('batch.few', { min: TE.BATCH_MIN }) : t(`batch.${r.verdict}`);
    verdict.className = `verdict ${r.verdict === 'structure' ? 'verdict-pattern' : r.verdict === 'none' ? 'verdict-meets' : ''}`.trim();
    set('batchCount', t('batch.count', { n: r.count.toLocaleString('en-US') }));
    const same = r.minLength === r.maxLength;
    set('batchLength', same ? t('batch.lengthSame', { n: r.maxLength }) : t('batch.lengthRange', { min: r.minLength, max: r.maxLength }));
    set('batchAlphabet', alphabetName(r.alphabet));
    set('batchDup', t('batch.count', { n: r.duplicates }));
    set('batchSum', t('batch.bits', { bits: fmtBits(r.sumMinEntropy) }));
    set('batchBaseline', r.baselineSum ? t('batch.bits', { bits: fmtBits(r.baselineSum) }) : '—');
    set('batchSingle', r.singleBits ? t('batch.bits', { bits: fmtBits(r.singleBits) }) : '—');
    const notes = r.warnings.length ? r.warnings.map(batchWarning) : [t('notes.none')];
    $('batchNotes').replaceChildren(...notes.map((text) => el('li', { text })));
    renderBatchChart(r);
  }

  function analyzeBatch() {
    state.batchResult = TE.batchAnalyze(state.batch);
    renderBatch();
  }

  function bindBatch() {
    const box = $('batch');
    let timer = null;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(analyzeBatch, 200);
    };
    box.addEventListener('input', (e) => {
      if (e.isComposing) return;
      state.batch = box.value;
      later();
    });
    box.addEventListener('compositionend', () => {
      state.batch = box.value;
      later();
    });
    $('batchClear').addEventListener('click', () => {
      box.value = '';
      state.batch = '';
      analyzeBatch();
      box.focus();
    });
    for (const btn of document.querySelectorAll('.batch-sample')) {
      btn.addEventListener('click', () => {
        box.value = batchSample(btn.dataset.batch);
        state.batch = box.value;
        analyzeBatch();
      });
    }
  }

  // ===== 安全なトークンを作る =====
  const GEN_IDS = ['hex', 'base32', 'base62', 'base64url', 'digits', 'printable'];
  const genName = (id) => t(id === 'printable' ? 'cs.printable94' : `cs.${id}`);

  // 選択肢と表は言語に合わせて作り直す（選んでいた値は残す）
  function renderGenControls() {
    const alpha = $('genAlphabet');
    const bits = $('genBits');
    const keepA = alpha.value || 'base62';
    const keepB = bits.value || String(TE.standardBits(TE.DEFAULT_STANDARD));
    alpha.replaceChildren(...GEN_IDS.map((id) => el('option', { value: id, text: genName(id) })));
    const label = (s) => t('gen.bitsOption', { bits: s.bits, name: t(`std.${s.id}`) });
    bits.replaceChildren(...TE.STANDARDS.map((s) => el('option', { value: String(s.bits), text: label(s) })));
    alpha.value = keepA;
    bits.value = keepB;
    const head = $('lengthTable').querySelector('thead tr');
    head.replaceChildren(el('th', { scope: 'col', text: t('ui.genColStandard') }), ...GEN_IDS.map((id) => el('th', { scope: 'col', text: genName(id) })));
    $('lengthTable').querySelector('tbody').replaceChildren(...TE.STANDARDS.map((s) => el('tr', {}, [
      el('th', { scope: 'row', text: label(s) }),
      ...GEN_IDS.map((id) => el('td', { 'data-label': genName(id), text: String(TE.requiredLength(s.bits, TE.GEN_ALPHABETS[id].length)) }))
    ])));
    renderGenInfo();
  }

  function genSettings() {
    const id = $('genAlphabet').value;
    const k = TE.GEN_ALPHABETS[id].length;
    const length = TE.requiredLength(Number($('genBits').value), k);
    return { id, k, length };
  }

  function renderGenInfo() {
    const { k, length } = genSettings();
    $('genLength').textContent = t('gen.length', { n: length, bits: fmtBits(length * Math.log2(k)) });
    const b = TE.moduloBias(k);
    $('genBias').textContent = b.remainder
      ? t('gen.bias', { k, r: b.remainder, ratio: TE.roundForDisplay(b.ratio), loss: b.minEntropyLoss.toFixed(3), total: (b.minEntropyLoss * length).toFixed(2),
        limit: 256 - b.remainder })
      : t('gen.biasNone', { k });
  }

  function say(key, vars = {}) {
    state.genStatus = { key, vars };
    $('genStatus').textContent = t(key, vars);
  }

  function bindGen() {
    renderGenControls();
    $('genAlphabet').addEventListener('change', renderGenInfo);
    $('genBits').addEventListener('change', renderGenInfo);
    $('genMake').addEventListener('click', () => {
      const { id, length } = genSettings();
      $('genOutput').value = TE.generate(id, length, cryptoBytes);
      say('gen.made', { n: length });
    });
    $('genCopy').addEventListener('click', async () => {
      const v = $('genOutput').value;
      if (!v) return;
      try {
        await navigator.clipboard.writeText(v);
        say('gen.copied');
      } catch (e) {
        $('genOutput').select();
        say('gen.copyFailed');
      }
    });
    // 送り先のタブに切り替え、送った先の見出しまで動かして、入力欄にフォーカスを置く
    $('genToResult').addEventListener('click', () => {
      const v = $('genOutput').value;
      if (!v) return;
      $('token').value = v;
      state.token = v;
      render();
      tabs.select('single');
      $('resultHeading').scrollIntoView({ block: 'start' });
      $('token').focus({ preventScroll: true });
    });
    $('genToBatch').addEventListener('click', () => {
      const { id, length } = genSettings();
      $('batch').value = Array.from({ length: 100 }, () => TE.generate(id, length, cryptoBytes)).join('\n');
      state.batch = $('batch').value;
      analyzeBatch();
      say('gen.sentBatch');
      tabs.select('batch');
      $('batchHeading').scrollIntoView({ block: 'start' });
      $('batch').focus({ preventScroll: true });
    });
  }

  // タブ（1本を調べる・まとめて比べる・作る・補講）。URL の #tab= か ?tab= で開くタブを選べる
  let tabs = null;

  function initTabs() {
    const TT = globalThis.TokenTabs;
    tabs = TT.init(document.querySelector('.tabs'));
    const first = TT.fromUrl(location.search, location.hash);
    if (first) tabs.select(first);
  }

  function render() {
    const s = settings();
    const r = TE.analyze(state.token, { override: state.charset, customSize: Number(state.customSize) });
    const v = s.threshold === null && r.basis === 'bits' ? 'noThreshold' : TE.verdict(r, s.threshold);
    const verdict = $('verdict');
    verdict.textContent = t(`verdict.${v}`, { std: s.threshold });
    verdict.className = `verdict verdict-${v}`;
    $('bits').textContent = r.bits === null ? t('bits.none') : t('bits.value', { bits: fmtBits(r.bits) });
    $('bitsKind').textContent = r.bits === null ? '' : t(r.bitsKind === 'spec' ? 'bits.spec' : 'bits.uniform');
    $('format').textContent = r.empty ? '—' : formatName(r);
    $('alphabet').textContent = alphabetName(r.alphabet);
    $('counted').textContent = r.counted ? t('counted.value', { counted: r.counted, length: r.length }) : '—';
    // 1文字あたりは、文字の集合で数えたときだけ（UUID は形式の決まりで数えるので、文字で割っても意味がない）
    const perChar = r.bits && r.counted && (r.bitsKind === 'uniform' || r.format === 'github');
    $('perChar').textContent = perChar ? t('perChar.value', { bits: (r.bits / r.counted).toFixed(3) }) : '—';
    $('shannon').textContent = r.empty ? '—' : t('shannon.value', { v: r.shannon.perChar.toFixed(3), max: r.shannon.maxPerChar.toFixed(3) });
    renderGauge(r.bits, s.threshold);
    renderNotes(r);
    renderTime(r, s);
    renderScanners(r);
    renderBatch();
  }

  function bind() {
    const token = $('token');
    // IME の変換中は描き直さない（変換が終わったときに描き直す）
    token.addEventListener('input', (e) => {
      if (e.isComposing) return;
      state.token = token.value;
      render();
    });
    token.addEventListener('compositionend', () => {
      state.token = token.value;
      render();
    });
    $('btnClear').addEventListener('click', () => {
      token.value = '';
      state.token = '';
      render();
      token.focus();
    });
    for (const btn of document.querySelectorAll('.sample-btn')) {
      btn.addEventListener('click', () => {
        const v = globalThis.TokenSamples[btn.dataset.sample];
        if (typeof v !== 'string') return;
        token.value = v;
        state.token = v;
        render();
      });
    }
    for (const id of ['charset', 'customSize', 'standard', 'customBits', 'valid', 'gpus', 'customRate']) {
      $(id).addEventListener(id === 'charset' || id === 'standard' ? 'change' : 'input', () => {
        state[id] = $(id).value;
        render();
      });
    }
  }

  // ヘルプ（dialog）。? ボタンの話題だけを見せ、閉じたら押したボタンへフォーカスを戻す
  function initHelp() {
    const dialog = $('helpDialog');
    let opener = null;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.help-icon');
      if (!btn) return;
      for (const topic of dialog.querySelectorAll('.help-topic')) topic.hidden = topic.dataset.helpTopic !== btn.dataset.help;
      $('helpTitle').textContent = btn.getAttribute('aria-label');
      opener = btn;
      dialog.showModal();
      $('helpClose').focus();
    });
    $('helpClose').addEventListener('click', () => dialog.close());
    // 背景（dialog の外側）を押したら閉じる
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (opener) opener.focus();
    });
  }

  // 言語の切り替え: 静的な文言を差し替え、入力と前提はそのままで結果を描き直す
  function initLanguage() {
    const I18N = globalThis.TokenI18n;
    const nav = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    I18N.use(I18N.initialLanguage(location.search, I18N.readSaved(), nav), document);
    $('btnLang').addEventListener('click', () => {
      const next = getLanguage() === 'ja' ? 'en' : 'ja';
      I18N.use(next, document);
      I18N.save(next);
      globalThis.TokenTheme.refresh($('btnTheme'), t);
      renderGenControls();
      if (state.genStatus) $('genStatus').textContent = t(state.genStatus.key, state.genStatus.vars);
      render();
    });
  }

  initLanguage();
  initTabs();
  bind();
  bindBatch();
  bindGen();
  initHelp();
  globalThis.TokenTheme.init($('btnTheme'), t);
  render();
  document.documentElement.setAttribute('data-ready', 'true');
})();
