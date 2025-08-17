// ===== Helpers =====
const $ = (id) => document.getElementById(id);

function log2(x){ return Math.log(x)/Math.log(2); }

function formatBigIntApprox(num){
  // num may be a BigInt or Number
  try{
    const s = num.toString();
    if (s.length <= 6) return s;
    // scientific-ish
    return s.slice(0,3) + "…" + ` ×10^${s.length-1}`;
  }catch{
    // Number fallback
    const n = Number(num);
    if (!isFinite(n)) return "∞";
    if (n === 0) return "0";
    const exp = Math.floor(Math.log10(n));
    const m = n / Math.pow(10,exp);
    return `${m.toFixed(2)} ×10^${exp}`;
  }
}

function formatDuration(seconds){
  if (!isFinite(seconds)) return "∞";
  if (seconds < 1e-6) return `${(seconds*1e9).toFixed(2)} ns`;
  if (seconds < 1e-3) return `${(seconds*1e6).toFixed(2)} µs`;
  if (seconds < 1) return `${(seconds*1e3).toFixed(2)} ms`;
  const units = [
    ["year", 365*24*3600],
    ["day", 24*3600],
    ["hour", 3600],
    ["min", 60],
    ["sec", 1],
  ];
  let rem = Math.floor(seconds);
  const parts = [];
  for (const [label, size] of units){
    if (rem >= size){
      const v = Math.floor(rem/size);
      parts.push(`${v} ${label}${v>1?"s":""}`);
      rem = rem % size;
      if (parts.length >= 2) break; // keep concise
    }
  }
  return parts.length ? parts.join(" ") : "0 sec";
}

function parseRate(s){
  // allow "1e9", "1000000", "2.5e12"
  const v = Number(s);
  return isFinite(v) && v>0 ? v : 1e9;
}

function parseThresholds(s){
  const [weak=64, ok=80, strong=100] = s.split(",").map(x=>Number(x.trim())).filter(x=>!isNaN(x));
  return {weak, ok, strong};
}

// ===== Alphabet detection =====
const ASCII_SYMBOLS = ` !"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`; // space included

function detectFormat(token){
  // UUID v4: 8-4-4-4-12 hex, version=4, variant in [8,9,a,b,A,B]
  const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (uuidRe.test(token)) return "UUIDv4";

  // Hex-only?
  const hexRe = /^[0-9a-fA-F]+$/;
  if (hexRe.test(token)) return "Hex";

  // Base64-ish? Allow A-Z a-z 0-9 + / with optional = padding at end
  const b64Re = /^(?:[A-Za-z0-9+/]{2,}={0,2})$/;
  if (b64Re.test(token)) return "Base64-ish";

  return "Generic";
}

function detectAlphabetSet(token){
  // detect used classes
  let size = 0;
  let labelParts = [];

  const hasLower = /[a-z]/.test(token);
  const hasUpper = /[A-Z]/.test(token);
  const hasDigit = /[0-9]/.test(token);
  const hasSpace = /[ ]/.test(token);
  const hasSymbol = /[ !"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/.test(token.replace(/[ ]/g,"")); // exclude space counted separately

  // special formats override
  const fmt = detectFormat(token);
  if (fmt === "UUIDv4"){
    // UUIDはダッシュを含む固定形。エントロピーは実際にはハイフン除いた122bit相当（version/variantで減少）
    // ここは教育上、hex 32桁相当から減算する単純近似を採用。
    return { format: fmt, label: "UUIDv4 (hex+hyphen)", size: 16, hyphen: true };
  }
  if (fmt === "Hex"){
    return { format: fmt, label: "Hex (0-9,a-f)", size: 16, hyphen: false };
  }
  if (fmt === "Base64-ish"){
    // 64種。ただし '=' はパディングとして計数しない想定
    return { format: fmt, label: "Base64-ish (A-Za-z0-9+/)", size: 64, hyphen: false };
  }

  // Generic: compose set
  if (hasLower){ size += 26; labelParts.push("a-z"); }
  if (hasUpper){ size += 26; labelParts.push("A-Z"); }
  if (hasDigit){ size += 10; labelParts.push("0-9"); }
  if (hasSymbol){
    // count distinct ASCII symbols present? → 教育用に「使用可能性」を前提に全記号33種とする
    size += ASCII_SYMBOLS.length - 1; // minus the space already separate (we'll add space if present)
    labelParts.push("symbols");
  }
  if (hasSpace){ size += 1; labelParts.push("space"); }

  // 何も当たらない（空など）
  if (size === 0){
    return { format: "Generic", label: "N/A", size: 0, hyphen: false };
  }
  return { format: "Generic", label: labelParts.join(" + "), size, hyphen: false };
}

// Shannon entropy (empirical) for reference
function shannonEntropyBits(str){
  if (!str || str.length === 0) return 0;
  const freq = new Map();
  for (const ch of str){ freq.set(ch, (freq.get(ch)||0)+1); }
  const n = str.length;
  let h = 0;
  for (const [_, c] of freq){
    const p = c / n;
    h += -p * log2(p);
  }
  return h * n; // total bits for the string
}

// exponentiation safely with BigInt when possible
function powBig(base, exp){
  // base, exp are integers (we'll round base)
  const b = BigInt(Math.max(0, Math.floor(base)));
  const e = BigInt(Math.max(0, Math.floor(exp)));
  if (b === 0n) return 0n;
  let result = 1n, a = b, k = e;
  while (k > 0n){
    if (k & 1n) result *= a;
    a *= a;
    k >>= 1n;
  }
  return result;
}

// ===== Main calculation =====
function analyze(){
  const token = $("token").value;
  const rate = parseRate($("rate").value);
  const {weak, ok, strong} = parseThresholds($("thresholds").value);

  // Reset
  setText("len","-");
  setText("alphabetLabel","-");
  setText("alphabetSize","-");
  setText("entropyBits","-");
  setText("empiricalEntropy","-");
  setText("space","-");
  setText("time","-");
  setText("rateEcho","-");
  setText("rating","-");
  $("rating").className = "badge";
  setText("notes","-");
  setBar(0);

  if (!token){
    setText("notes","入力が空です");
    return;
  }

  const n = token.length;
  setText("len", String(n));
  const d = detectAlphabetSet(token);

  // UUIDv4補正：UUIDのハイフン4文字を除去し、version/variantで2+3=5固定bits
  // 実効は 32 hex chars → 128bits - 固定5bits = ~123bits 相当
  // 教育簡略化として 122〜123bits 目安表示
  let Hbits;
  let note = d.format;
  if (d.format === "UUIDv4"){
    setText("alphabetLabel", d.label);
    setText("alphabetSize", "16 (hex)");
    // 実測表示（簡易）
    Hbits = 122; // 代表値として固定表示
    setText("entropyBits", "~122.0 bits（近似）");
    setText("empiricalEntropy", shannonEntropyBits(token).toFixed(2) + " bits（参考）");

    // 総当たり空間を 2^122 とみなす
    const spaceStr = "≈ 2^122";
    setText("space", spaceStr);

    // 中央値時間
    const seconds = Math.pow(2,122) / 2 / rate;
    setText("time", formatDuration(seconds));
    setText("rateEcho", `${rate} guesses/sec`);
  } else {
    setText("alphabetLabel", d.label);
    setText("alphabetSize", d.size ? String(d.size) : "-");

    if (d.size === 0 || n === 0){
      setText("notes","評価不能（サイズ0 or 長さ0）");
      return;
    }

    Hbits = n * log2(d.size);
    setText("entropyBits", Hbits.toFixed(2) + " bits");

    const Hemp = shannonEntropyBits(token);
    setText("empiricalEntropy", Hemp.toFixed(2) + " bits（参考）");

    // space = |Σ|^n
    let spaceStr = "";
    if (d.size <= 1 || n > 2048){
      spaceStr = "very large";
    } else {
      try{
        const space = powBig(d.size, n);
        spaceStr = formatBigIntApprox(space);
      }catch{
        // fallback to Number
        const spaceNum = Math.pow(d.size, n);
        spaceStr = formatBigIntApprox(spaceNum);
      }
    }
    setText("space", spaceStr);

    const seconds = Math.pow(2, Hbits) / 2 / rate;
    setText("time", formatDuration(seconds));
    setText("rateEcho", `${rate} guesses/sec`);
  }

  // rating
  let cls="badge", label="—";
  if (Hbits < weak){ cls+=" weak"; label="弱い"; }
  else if (Hbits < strong){ cls+=" ok"; label="ふつう"; }
  else { cls+=" strong"; label="強い"; }
  $("rating").className = cls;
  setText("rating", label);

  // bar (map bits to 0..100 based on thresholds)
  const pct = mapToBar(Hbits, weak, ok, strong);
  setBar(pct);

  // notes
  if (note === "Generic") note = "—";
  if (d.format === "Base64-ish"){
    note += "（パディング'='はアルファベットに含めず近似）";
  }
  setText("notes", note);
}

function mapToBar(bits, w, o, s){
  // 0% at 0 bits, 100% at s+40bits
  const max = s + 40;
  const pct = Math.max(0, Math.min(100, (bits / max) * 100));
  return pct;
}

function setText(id, text){
  $(id).textContent = text;
}

function setBar(pct){
  $("strengthBar").style.width = `${pct.toFixed(1)}%`;
}

// ===== Samples & UI =====
function fillSample(type){
  let v = "";
  if (type === "uuidv4"){
    v = "550e8400-e29b-41d4-a716-446655440000";
  } else if (type === "hex32"){
    v = "3f1a0b2c9d7e4a1f0c5b6d8e2a7c9b1d";
  } else if (type === "b64"){
    v = "QWxhZGRpbjpvcGVuIHNlc2FtZQ==";
  } else if (type === "alnum16"){
    v = "A7kLw39mQp8Zr2Tx";
  } else if (type === "alnum32"){
    v = "G5hQmT9Zs1BcK8rV2xY4nP7uD3jL6wEa";
  }
  $("token").value = v;
  analyze();
}

function clearAll(){
  $("token").value = "";
  analyze();
}

function bind(){
  $("btnAnalyze").addEventListener("click", analyze);
  $("btnClear").addEventListener("click", clearAll);
  document.querySelectorAll(".sample-buttons button").forEach(btn=>{
    btn.addEventListener("click", ()=> fillSample(btn.dataset.sample));
  });
}

bind();
analyze(); // initial
